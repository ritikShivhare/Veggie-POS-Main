-- Aatmyam POS: atomic writes, complete schema, server-only access, tenant keys.
-- Apply 001..008 in order. Runs as one transaction; never discards existing rows.
BEGIN;
-- Some hosted installations were created manually and never applied 003/005/007.
-- Add their missing columns before the atomic writer starts sending audit fields.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ingredients','menu_items','purchases','recipes','staff','orders','order_items','payments','inventory_movements','customers','shifts','settings','tenant_objects','idempotency_keys'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS version integer DEFAULT 1',t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now()',t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()',t);
  END LOOP;
END $$;
ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS request_hash varchar;
ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS status varchar DEFAULT 'COMPLETED';
ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS "passwordHash" varchar;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone varchar;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS status varchar DEFAULT 'active';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "customerId" varchar;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "discountReason" varchar;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "authorizerName" varchar;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "cancellationReason" varchar;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "cancelledBy" varchar;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "cancelledAt" varchar;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "redeemedPoints" numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "earnedPoints" numeric DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "openingCash" numeric DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "expectedCash" numeric;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "physicalCashCount" numeric;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS variance numeric;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "closingNotes" varchar;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "managerOverrideBy" varchar;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS data jsonb;
-- Fold the original split settings into one representation for both direct/trx saves.
UPDATE settings s SET data = (to_jsonb(s) - 'tenant_id' - 'data' - 'created_at' - 'updated_at' - 'version')
  || COALESCE((SELECT value FROM tenant_objects WHERE tenant_id=s.tenant_id AND key='settings_extra'),'{}'::jsonb)
  || COALESCE((SELECT value FROM tenant_objects WHERE tenant_id=s.tenant_id AND key='settings'),'{}'::jsonb)
WHERE s.data IS NULL;

-- Remove global-id foreign keys before replacing primary keys. Recreate every
-- relationship with tenant_id so a valid id in another restaurant cannot satisfy it.
DO $$
DECLARE r record; t text; key text;
BEGIN
  FOR r IN SELECT conrelid::regclass AS rel,conname FROM pg_constraint
    WHERE contype='f' AND connamespace='public'::regnamespace AND conrelid::regclass::text IN
      ('purchases','recipes','orders','order_items','payments','inventory_movements','shifts') LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',r.rel,r.conname);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['ingredients','menu_items','purchases','recipes','staff','orders','order_items','payments','inventory_movements','customers','shifts','idempotency_keys'] LOOP
    key := CASE WHEN t='recipes' THEN 'menuItemId' ELSE 'id' END;
    FOR r IN SELECT conname FROM pg_constraint WHERE conrelid=('public.'||t)::regclass AND contype='p' LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',t,r.conname);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (tenant_id,%I)',t,key);
  END LOOP;
END $$;
ALTER TABLE purchases ADD CONSTRAINT purchases_tenant_ingredient_fk FOREIGN KEY (tenant_id,"ingredientId") REFERENCES ingredients(tenant_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE recipes ADD CONSTRAINT recipes_tenant_menu_fk FOREIGN KEY (tenant_id,"menuItemId") REFERENCES menu_items(tenant_id,id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE order_items ADD CONSTRAINT items_tenant_order_fk FOREIGN KEY (tenant_id,order_id) REFERENCES orders(tenant_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE order_items ADD CONSTRAINT items_tenant_menu_fk FOREIGN KEY (tenant_id,menu_item_id) REFERENCES menu_items(tenant_id,id) ON DELETE SET NULL (menu_item_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE payments ADD CONSTRAINT payments_tenant_order_fk FOREIGN KEY (tenant_id,order_id) REFERENCES orders(tenant_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE payments ADD CONSTRAINT payments_tenant_staff_fk FOREIGN KEY (tenant_id,cashier_id) REFERENCES staff(tenant_id,id) ON DELETE SET NULL (cashier_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE inventory_movements ADD CONSTRAINT movements_tenant_ingredient_fk FOREIGN KEY (tenant_id,ingredient_id) REFERENCES ingredients(tenant_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE inventory_movements ADD CONSTRAINT movements_tenant_staff_fk FOREIGN KEY (tenant_id,performed_by) REFERENCES staff(tenant_id,id) ON DELETE SET NULL (performed_by) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE orders ADD CONSTRAINT orders_tenant_staff_fk FOREIGN KEY (tenant_id,"cashierId") REFERENCES staff(tenant_id,id) ON DELETE SET NULL ("cashierId") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE shifts ADD CONSTRAINT shifts_tenant_staff_fk FOREIGN KEY (tenant_id,"staffId") REFERENCES staff(tenant_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX IF NOT EXISTS idx_purchases_ingredient ON purchases(tenant_id,"ingredientId");
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_order ON order_items(tenant_id,order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_menu ON order_items(tenant_id,menu_item_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_order ON payments(tenant_id,order_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_cashier ON payments(tenant_id,cashier_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant_ingredient ON inventory_movements(tenant_id,ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant_staff ON inventory_movements(tenant_id,performed_by);
CREATE INDEX IF NOT EXISTS idx_orders_cashier ON orders(tenant_id,"cashierId");
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_staff ON shifts(tenant_id,"staffId");
-- One settlement per order. Refund state changes the same ledger entry.
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_settlement ON payments(tenant_id,order_id) WHERE status IN ('Completed','Refunded');

CREATE TABLE IF NOT EXISTS tenant_revisions (tenant_id varchar PRIMARY KEY, revision bigint NOT NULL DEFAULT 0);
ALTER TABLE tenant_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tenant_revisions FROM PUBLIC, anon, authenticated;
GRANT ALL ON tenant_revisions TO service_role;
CREATE OR REPLACE FUNCTION bump_tenant_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE t text;
BEGIN
  t := CASE WHEN TG_OP='DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
  PERFORM pg_advisory_xact_lock(hashtextextended(t,0));
  INSERT INTO tenant_revisions(tenant_id,revision) VALUES(t,1)
    ON CONFLICT(tenant_id) DO UPDATE SET revision=tenant_revisions.revision+1;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bump_tenant_revision() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION get_tenant_revision(p_tenant_id text) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE((SELECT revision FROM tenant_revisions WHERE tenant_id=p_tenant_id),0);
$$;
REVOKE ALL ON FUNCTION get_tenant_revision(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_revision(text) TO service_role;

CREATE OR REPLACE FUNCTION commit_tenant_transaction(p_tenant_id text,p_expected_revision bigint,p_changes jsonb,p_objects jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE change jsonb; obj jsonb; row_data jsonb; t text; key text; cols text; updates text; rev bigint;
BEGIN
  IF p_tenant_id IS NULL OR length(p_tenant_id)=0 OR length(p_tenant_id)>160 THEN RAISE EXCEPTION 'Invalid tenant' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id,0));
  SELECT COALESCE((SELECT revision FROM tenant_revisions WHERE tenant_id=p_tenant_id),0) INTO rev;
  IF rev<>p_expected_revision THEN RAISE EXCEPTION 'STALE_TENANT_REVISION' USING ERRCODE='PT409'; END IF;
  IF jsonb_typeof(p_changes)<>'array' OR jsonb_typeof(p_objects)<>'array' THEN RAISE EXCEPTION 'Invalid changes' USING ERRCODE='22023'; END IF;
  SET CONSTRAINTS ALL DEFERRED;
  FOR change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    t := change->>'table';
    IF t IS NULL OR NOT (t = ANY(ARRAY['ingredients','menu_items','purchases','recipes','staff','orders','order_items','payments','inventory_movements','customers','shifts','idempotency_keys'])) THEN
      RAISE EXCEPTION 'Unsupported table' USING ERRCODE='42501';
    END IF;
    key := CASE WHEN t='recipes' THEN 'menuItemId' ELSE 'id' END;
    IF jsonb_typeof(change->'rows')<>'array' THEN RAISE EXCEPTION 'Invalid rows' USING ERRCODE='22023'; END IF;
    FOR row_data IN SELECT value FROM jsonb_array_elements(change->'rows') LOOP
      IF row_data->>'tenant_id' IS DISTINCT FROM p_tenant_id OR NULLIF(row_data->>key,'') IS NULL THEN
        RAISE EXCEPTION 'Invalid tenant or row id' USING ERRCODE='42501';
      END IF;
      IF EXISTS(SELECT 1 FROM jsonb_object_keys(row_data) c WHERE NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=('public.'||t)::regclass AND attname=c AND attnum>0 AND NOT attisdropped)) THEN
        RAISE EXCEPTION 'Unknown column' USING ERRCODE='22023';
      END IF;
      SELECT string_agg(format('%I',c),','), string_agg(format('%I=EXCLUDED.%I',c,c),',') FILTER (WHERE c NOT IN ('tenant_id',key)) INTO cols,updates FROM jsonb_object_keys(row_data) c;
      EXECUTE format('INSERT INTO public.%I AS target(%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) ON CONFLICT(tenant_id,%I) DO UPDATE SET %s WHERE target IS DISTINCT FROM EXCLUDED',t,cols,cols,t,key,updates) USING row_data;
    END LOOP;
    EXECUTE format('DELETE FROM public.%I WHERE tenant_id=$1 AND %I NOT IN (SELECT value->>%L FROM jsonb_array_elements($2))',t,key,key) USING p_tenant_id,change->'rows';
  END LOOP;
  FOR obj IN SELECT value FROM jsonb_array_elements(p_objects) LOOP
    IF NULLIF(obj->>'key','') IS NULL OR length(obj->>'key')>200 THEN RAISE EXCEPTION 'Invalid object key' USING ERRCODE='22023'; END IF;
    IF obj->>'key'='settings' THEN
      INSERT INTO settings(tenant_id,data) VALUES(p_tenant_id,obj->'value') ON CONFLICT(tenant_id) DO UPDATE SET data=EXCLUDED.data,version=settings.version+1,updated_at=now();
    ELSE
      INSERT INTO tenant_objects(tenant_id,key,value) VALUES(p_tenant_id,obj->>'key',obj->'value') ON CONFLICT(tenant_id,key) DO UPDATE SET value=EXCLUDED.value,version=tenant_objects.version+1,updated_at=now();
    END IF;
  END LOOP;
  SET CONSTRAINTS ALL IMMEDIATE;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION commit_tenant_transaction(text,bigint,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION commit_tenant_transaction(text,bigint,jsonb,jsonb) TO service_role;

DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['ingredients','menu_items','purchases','recipes','staff','orders','order_items','payments','inventory_movements','customers','shifts','settings','tenant_objects','idempotency_keys'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS revision_changed ON public.%I',t);
    EXECUTE format('CREATE TRIGGER revision_changed AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION bump_tenant_revision()',t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY service_role_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT NULLIF(auth.jwt()->'app_metadata'->>'tenant_id',''); $$;
-- Guard missing helpers and every signature: manual installations differ from 004/006.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN ('save_multi_slice_transaction','set_tenant_context','current_tenant_id','acquire_tenant_lock','release_tenant_lock') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
    EXECUTE format('ALTER FUNCTION %s SET search_path=public,pg_temp',f.signature);
  END LOOP;
  IF to_regclass('public.restaurant_sync') IS NOT NULL THEN
    ALTER TABLE public.restaurant_sync ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.restaurant_sync FROM PUBLIC,anon,authenticated;
    GRANT ALL ON public.restaurant_sync TO service_role;
  END IF;
END $$;
COMMIT;
