-- Return stale revisions to the caller as HTTP 409. SQLSTATE 40001 can be
-- automatically retried by PostgREST with the same stale arguments forever.
-- Preserve the complete existing function, tenant locks, validation and ACLs.
DO $migration$
DECLARE
  definition text;
  old_guard text := 'RAISE EXCEPTION ''STALE_TENANT_REVISION'' USING ERRCODE=''40001''';
  new_guard text := 'RAISE EXCEPTION ''STALE_TENANT_REVISION'' USING ERRCODE=''PT409''';
BEGIN
  definition := pg_get_functiondef('public.commit_tenant_transaction(text,bigint,jsonb,jsonb)'::regprocedure);
  IF position(old_guard IN definition) > 0 THEN
    EXECUTE replace(definition, old_guard, new_guard);
  ELSIF position(new_guard IN definition) = 0 THEN
    RAISE EXCEPTION 'Unrecognized tenant revision guard; manual review required';
  END IF;
END
$migration$;
