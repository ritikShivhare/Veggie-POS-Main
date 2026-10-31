-- Legacy RPC retired. Use commit_tenant_transaction (migration 008).
-- The former implementation accepted arbitrary table names and deleted data.
CREATE OR REPLACE FUNCTION save_multi_slice_transaction(p_tenant_id VARCHAR, p_slices JSONB DEFAULT NULL, p_objects JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Use commit_tenant_transaction from migration 008' USING ERRCODE = '0A000';
END;
$$;
REVOKE ALL ON FUNCTION save_multi_slice_transaction(VARCHAR, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Tenant identity must be resolved by the authenticated application server' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION set_tenant_context(TEXT) FROM PUBLIC, anon, authenticated;
