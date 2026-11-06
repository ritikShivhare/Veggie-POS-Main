# Supabase super-admin setup and release

Integration branch: `integration/aatmyam-v1`, based on `4095cb5e` plus the marketing,
branding, receipt fixes and Enterprise price of INR 1,999/month. Main is not merged.

## Account setup (owner action)

1. In the intended Supabase project, Authentication > Users, create your own admin
   email/password account. Set the password privately in the provider interface.
   There are currently no Auth users in the veggi Pos project (checked 18 Oct).
2. Copy the exact user UUID. Set that user's **app metadata**, via the trusted
   provider Admin API, to include `role: SUPER_ADMIN`. Never use user metadata.
   Do not grant this role to a restaurant staff member or public signup.
3. Set backend `SUPER_ADMIN_USER_ID` to that UUID. Keep the service-role key on
   the backend. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the same
   project's URL and public key, then rebuild. These VITE variables are public.
4. Open the SaaS administrator page (`/?subdomain=saas`), enter your approved
   email/password, and enroll an authenticator app with the displayed QR.
   Verify its six-digit code. Keep the QR/secret private; do not share screenshots.
5. Subsequent sign-ins use password plus the existing authenticator factor.
   The server separately verifies identity, role, signed claims and `aal2`.

No default admin account/password is created. No auth.users records are deleted
by the cleanup script. No password-only or legacy Google admin fallback remains.
For lost MFA, use the provider's trusted recovery process; do not add a bypass.

## Database cleanup

`cleanup-veggi-pos.sql` is an explicit operator script, not a schema migration.
Target **only** veggi Pos (`zeebnbkqfueprhwjfhbs`), schema 9. Owner waived backup
verification for this dummy-data reset. Existing test preview DB is separate.

1. Verify the original Render service's SUPABASE_URL matches that project.
2. Stop/suspend every writer connected to it, including any AI Studio/dev backend.
   Stop browser activity. Do not run cleanup while an API transaction can commit.
3. Execute the reviewed script once. It locks the application tables, deletes
   application records, and verifies zero rows before COMMIT. Revision rows are
   deleted last because entity DELETE triggers regenerate them.
4. Restart the backend before allowing clients back. The server reads sessions
   and staff from the database and rejects deleted, inactive or stale staff.
   Admin guards reject all old identity-less sessions. No demo tenants are seeded.
5. On old devices, clear Aatmyam site data/IndexedDB, localStorage and installed
   PWA data. These are device-local actions; cloud SQL cannot erase those stores.
6. Verify all table counts and schema 9, old sessions/PINs rejected, and old offline
   outbox requests rejected. Only then reopen signup and create clean restaurants.

A running service can recreate empty telemetry/registry objects after restart;
that is distinct from resurrecting old restaurant records. Database/API readiness
and email delivery remain release requirements even when build/tests pass.

## Release verification

Run `npm ci`, `npm run lint`, `npm test`, `npm run build`, and `git diff --check`.
Tests cover invalid UID/role/token, user metadata spoofing, aal1, expiry, legacy
session rejection, cookie/header mismatch, enrollment failures, MFA exchange and
cleanup with actual PostgreSQL DELETE triggers (PGlite).

Live checks need a real owner account and authenticator: aal1 must fail exchange;
aal2 must access tenant administration; normal restaurant staff must be denied.
Revalidate restaurant PIN/permissions, offline rejection and two-tenant isolation.
Do not merge main or deploy the integration over the existing service until the
runtime variables and account are configured and these live checks are completed.
