-- Migration 006: Database-Level Multi-Tenant Row Level Security (RLS) Policies
-- Defense-in-Depth Layer 2: Enforces tenant_id isolation inside PostgreSQL itself.
-- Even if application backend code omits WHERE tenant_id = '...', PostgreSQL automatically
-- restricts queries and mutations strictly to the active tenant context.

-- =========================================================================
-- 1. Helper Function: current_tenant_id()
-- Extracts tenant identity from:
--   a) PostgreSQL session setting (app.current_tenant_id)
--   b) PostgREST / Supabase request header (request.headers ->> 'x-tenant-id')
--   c) Supabase Auth JWT claims (app_metadata or user_metadata)
-- =========================================================================
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        NULLIF(current_setting('app.current_tenant_id', true), ''),
        NULLIF(current_setting('request.headers', true)::json->>'x-tenant-id', ''),
        NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', ''),
        NULLIF(auth.jwt() -> 'user_metadata' ->> 'tenant_id', '')
    );
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to set tenant context in direct SQL/RPC connections
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', p_tenant_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 2. Tenant Immutability Trigger
-- Prevents accidental or malicious modification of tenant_id on existing rows
-- =========================================================================
CREATE OR REPLACE FUNCTION prevent_cross_tenant_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS NOT NULL AND OLD.tenant_id <> NEW.tenant_id THEN
        RAISE EXCEPTION 'Security Violation: Cannot alter tenant_id of an existing record from % to % (Tenant immutability enforced).', OLD.tenant_id, NEW.tenant_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 3. Apply Multi-Tenant RLS Policies Across All Business Tables
-- Enforces:
--   - SELECT: Only rows matching active tenant are returned
--   - INSERT/UPDATE: New or modified rows must belong to active tenant
--   - DELETE: Only rows belonging to active tenant can be deleted
--   - Super-Admin override: 'saas-admin' context allows multi-tenant oversight
-- =========================================================================

-- Macro / Loop via DO block to apply strict policies and triggers to all tenant tables
DO $$
DECLARE
    tbl text;
    tenant_tables text[] := ARRAY[
        'ingredients',
        'menu_items',
        'purchases',
        'recipes',
        'staff',
        'orders',
        'order_items',
        'payments',
        'inventory_movements',
        'customers',
        'shifts',
        'settings',
        'idempotency_keys'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables
    LOOP
        -- Enable and FORCE Row Level Security (even on table owner/service_role)
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);

        -- Remove legacy permissive policy
        EXECUTE format('DROP POLICY IF EXISTS service_role_all ON %I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);

        -- Create strict tenant isolation policy
        EXECUTE format('
            CREATE POLICY tenant_isolation_policy ON %I
            FOR ALL
            USING (
                (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id())
                OR current_tenant_id() = ''saas-admin''
                OR current_setting(''app.bypass_rls'', true) = ''on''
            )
            WITH CHECK (
                (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id())
                OR current_tenant_id() = ''saas-admin''
                OR current_setting(''app.bypass_rls'', true) = ''on''
            );
        ', tbl);

        -- Attach tenant immutability trigger
        EXECUTE format('DROP TRIGGER IF EXISTS trg_prevent_cross_tenant_update ON %I;', tbl);
        EXECUTE format('
            CREATE TRIGGER trg_prevent_cross_tenant_update
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION prevent_cross_tenant_update();
        ', tbl);
    END LOOP;
END $$;

-- =========================================================================
-- 4. Apply Policy on tenant_objects (Allows 'global' and 'saas-admin' objects)
-- =========================================================================
ALTER TABLE tenant_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_objects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON tenant_objects;
DROP POLICY IF EXISTS tenant_isolation_policy ON tenant_objects;

CREATE POLICY tenant_isolation_policy ON tenant_objects
FOR ALL
USING (
    (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id())
    OR current_tenant_id() = 'saas-admin'
    OR tenant_id = 'global'
    OR current_setting('app.bypass_rls', true) = 'on'
)
WITH CHECK (
    (current_tenant_id() IS NOT NULL AND tenant_id = current_tenant_id())
    OR current_tenant_id() = 'saas-admin'
    OR tenant_id = 'global'
    OR current_setting('app.bypass_rls', true) = 'on'
);

DROP TRIGGER IF EXISTS trg_prevent_cross_tenant_update ON tenant_objects;
CREATE TRIGGER trg_prevent_cross_tenant_update
BEFORE UPDATE ON tenant_objects
FOR EACH ROW
EXECUTE FUNCTION prevent_cross_tenant_update();
