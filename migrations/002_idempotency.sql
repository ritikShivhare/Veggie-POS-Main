-- VeggiePOS Idempotency Schema Migration
-- Enforces idempotent request processing with unique constraint on (tenant_id, idempotency_key)

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id VARCHAR PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    idempotency_key VARCHAR NOT NULL,
    status_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    request_path VARCHAR,
    request_method VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_tenant_idempotency_key UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_tenant_key ON idempotency_keys(tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON idempotency_keys(created_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON idempotency_keys;
CREATE POLICY service_role_all ON idempotency_keys FOR ALL TO service_role USING (true) WITH CHECK (true);
