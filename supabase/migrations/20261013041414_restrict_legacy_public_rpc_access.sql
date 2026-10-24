-- Compatible security patch for the existing hosted application.
-- No rows, foreign keys or function bodies are changed. Server access is retained.
BEGIN;
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
