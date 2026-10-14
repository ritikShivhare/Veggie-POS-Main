-- This app uses server sessions, not Supabase Auth. All data access is mediated by
-- the server; no anon/authenticated Data API grant is needed. A browser header is
-- not a tenant claim. Do not add policies based on request.headers.x-tenant-id.
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS TEXT
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '');
$$;
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['ingredients','menu_items','purchases','recipes','staff','orders','order_items','payments','inventory_movements','customers','shifts','settings','tenant_objects','idempotency_keys'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY service_role_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon, authenticated;
