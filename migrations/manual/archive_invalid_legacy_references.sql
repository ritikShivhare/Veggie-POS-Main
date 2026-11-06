-- MANUAL, APPROVAL REQUIRED: archive a reviewed batch of orphan references
-- before 008. Do not include this in automatic migration execution.
-- Original rows remain recoverable in a private archive; other rows are untouched.
-- The operator supplies app.recovery_expected_recipes and
-- app.recovery_expected_shifts as session settings after private preflight review.
BEGIN;
LOCK TABLE public.recipes,public.shifts,public.menu_items,public.staff IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE recipe_count integer; shift_count integer; expected_recipes integer; expected_shifts integer;
BEGIN
  expected_recipes:=NULLIF(current_setting('app.recovery_expected_recipes',true),'')::integer;
  expected_shifts:=NULLIF(current_setting('app.recovery_expected_shifts',true),'')::integer;
  IF expected_recipes IS NULL OR expected_shifts IS NULL OR expected_recipes<0 OR expected_shifts<0 THEN
    RAISE EXCEPTION 'Set the reviewed expected recovery counts before proceeding.';
  END IF;
  SELECT count(*) INTO recipe_count FROM public.recipes r WHERE NOT EXISTS (
    SELECT 1 FROM public.menu_items m WHERE m.tenant_id=r.tenant_id AND m.id=r."menuItemId"
  );
  SELECT count(*) INTO shift_count FROM public.shifts s WHERE s."staffId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff f WHERE f.tenant_id=s.tenant_id AND f.id=s."staffId"
  );
  IF NOT ((recipe_count=expected_recipes AND shift_count=expected_shifts) OR (recipe_count=0 AND shift_count=0)) THEN
    RAISE EXCEPTION 'Recovery scope changed: % orphan recipes, % orphan shifts. Review before proceeding.',recipe_count,shift_count;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.deployment_recovery_archive (
  batch text NOT NULL,
  tenant_id text NOT NULL,
  source_table text NOT NULL CHECK (source_table IN ('recipes','shifts')),
  source_id text NOT NULL,
  record jsonb NOT NULL,
  reason text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(batch,tenant_id,source_table,source_id)
);
ALTER TABLE public.deployment_recovery_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.deployment_recovery_archive FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.deployment_recovery_archive TO service_role;
INSERT INTO public.deployment_recovery_archive(batch,tenant_id,source_table,source_id,record,reason)
SELECT 'legacy-reference-repair',r.tenant_id,'recipes',r."menuItemId",to_jsonb(r),'Missing menu record; original ingredient references retained'
FROM public.recipes r WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_items m WHERE m.tenant_id=r.tenant_id AND m.id=r."menuItemId"
);
INSERT INTO public.deployment_recovery_archive(batch,tenant_id,source_table,source_id,record,reason)
SELECT 'legacy-reference-repair',s.tenant_id,'shifts',s.id,to_jsonb(s),'Missing staff record; historical shift retained outside active reports'
FROM public.shifts s WHERE s."staffId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.staff f WHERE f.tenant_id=s.tenant_id AND f.id=s."staffId"
);
-- Move only rows whose complete original record has already been preserved.
DELETE FROM public.recipes r USING public.deployment_recovery_archive a
WHERE a.batch='legacy-reference-repair' AND a.source_table='recipes'
  AND a.tenant_id=r.tenant_id AND a.source_id=r."menuItemId" AND a.record=to_jsonb(r)
  AND NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.tenant_id=r.tenant_id AND m.id=r."menuItemId");
DELETE FROM public.shifts s USING public.deployment_recovery_archive a
WHERE a.batch='legacy-reference-repair' AND a.source_table='shifts'
  AND a.tenant_id=s.tenant_id AND a.source_id=s.id AND a.record=to_jsonb(s)
  AND s."staffId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.staff f WHERE f.tenant_id=s.tenant_id AND f.id=s."staffId");
COMMIT;
