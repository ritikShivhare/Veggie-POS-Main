-- Preserve the existing login PIN while removing plaintext credential storage.
-- PostgreSQL pgcrypto bcrypt was verified against the application's bcryptjs verifier.
-- Already-hashed PINs are excluded; rerunning this migration makes no changes.
BEGIN;
UPDATE public.staff
SET pin=extensions.crypt(pin,extensions.gen_salt('bf',10)),
    version=COALESCE(version,1)+1,
    updated_at=now()
WHERE pin ~ '^[0-9]{4,6}$';
COMMIT;
