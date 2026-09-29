-- VeggiePOS Migration 007: Database-Authoritative Idempotency & Concurrency Hardening
-- Adds request payload hashing, status tracking, and expiration leases to idempotency_keys

ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS request_hash VARCHAR;
ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'COMPLETED';
ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_idempotency_status ON idempotency_keys(status);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency_keys(expires_at);
