# Aatmyam POS deployment

This release requires database migrations and real email configuration before
production startup. A successful GitHub build alone does not verify a live restaurant.

## Apply the database changes before starting the new server

Use your existing Supabase project. Take a provider backup/export first.
Run the read-only `migrations/PREFLIGHT.sql` before upgrading an existing database.
For an installation that already applied 001–007, or the observed manually-created
equivalent with the same tables, run:

1. `migrations/008_deployment_integrity.sql`
2. `migrations/009_atomic_registration.sql`

For a new database, run all migration files 001–009 in numeric order in the
Supabase SQL editor as the database administrator. Each new migration uses a
transaction. Do not delete data to bypass a foreign-key or duplicate-payment error;
inspect the affected old records and correct them before retrying.
An older installation may have invalid references. Restore authoritative missing
records or obtain the data owner's archive decision before proceeding. A tested,
parameterized manual alternative is documented in migrations/manual/README.md;
moved historical shifts leave ordinary app reports, while their original fields
remain in a private recovery table. It is not an automatic migration.
Migration 008 preserves rows, changes entity keys to `(tenant_id, id)`, merges
legacy settings, and closes the unsafe public RPCs. It deliberately rejects
pre-existing invalid links or duplicate completed settlements.

Verify with `SELECT public.deployment_schema_version();` (expected: `9`).
The backend uses the service-role key; direct anonymous/authenticated Data API
access to business tables is denied. Keep the service-role key out of frontend
variables, screenshots and source control.

Compatible security repairs are documented in
`supabase/README.md`. Those repairs do not replace application migrations 008/009.

## Configure the Render service

Use Node 24. Build: `npm ci --include=dev && npm run build`.
Start: `npm start`. Health check: `/api/health`.
The frontend is served from `dist/client`; the server bundle remains private in `dist`.
The updated `render.yaml` describes these settings for Blueprint-managed services.
For a manually-created service, update its dashboard settings explicitly. Publish
and review the repair branch before merging/deploying, and confirm database/mail
readiness first. Editing render.yaml alone does not configure an existing service.

Required production variables:

| Variable | Value to configure |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_URL` | Your public HTTPS origin, e.g. `https://veggie-pos-main.onrender.com` |
| `ALLOWED_ORIGINS` | Comma-separated trusted frontend origins |
| `SUPABASE_URL` | Your project's Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service-role key |
| `RESEND_API_KEY` | Real Resend API key for email delivery |
| `EMAIL_FROM` | Sender address on a domain verified with Resend |

Render free web services block outbound ports 25/465/587, so Gmail SMTP on those
ports cannot deliver OTP from that plan. Use the HTTPS Resend integration.
The `onboarding@resend.dev` sandbox sender is rejected. Provider acceptance does
not guarantee inbox delivery: check its delivery events and the recipient's spam
folder. A rejected send returns an error and a failed resend preserves the last code.
A time-only health response does not establish persistence. Configure the private
provider environment and confirm connected database/schema readiness before real
onboarding tests. Keep API keys in the server environment, outside frontend code,
source control and public discussion.

SaaS admin sign-in now requires Supabase Auth email/password plus authenticator MFA.
Set `SUPER_ADMIN_USER_ID` on the backend and `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` at build time. These must use the same project as the backend.
Only the approved UID with server-controlled `app_metadata.role = SUPER_ADMIN`
and a provider-verified `aal2` token can exchange for a server session. Retired
password/email-OTP and Google admin endpoints return HTTP 410. Store signup OTP
is unchanged. See `ops/SUPER_ADMIN_SETUP.md` for enrollment and release checks.
Admin sessions have a fixed expiry bounded by their verified Supabase token;
changing the configured approved UID immediately rejects prior admin sessions.
No legacy SaaS Owner session is accepted by the new backend.

Optional settings are listed in `.env.example`. Redis, AI and Cashfree credentials
are not required for cash/manual UPI billing. Do not use a Gemini API key as a
Google login client ID. Do not put real secrets in `.env.example`.

## Verify after deployment

1. `/api/health` must return `status: "ok"`, `database: "connected"` and
   `schemaVersion: 9`. On Render, `commit` identifies the deployed Git revision.
2. Register a test restaurant using an email inbox you control. Receive the OTP;
   test resend, verification, PIN login, owner password login and logout.
3. Create a menu item, ingredient and recipe. Place a bill, settle Cash/manual UPI,
   and check exactly one payment and one stock deduction. Cancel an unpaid bill;
   confirm stock returns. Refund a paid bill manually before confirming cancellation.
4. Open two restaurant workspaces and two devices. Verify tenant boundaries,
   stale-write rejection, staff role changes and session/WebSocket revocation.
5. In an already signed-in tab, disconnect networking, create a bill and payment,
   reconnect, and check the queue drains once in order. Resolve visible failed
   commands explicitly. Do not clear browser data while commands are pending.
6. Test actual printer, scanner and drawer separately if used. Set a real UPI VPA;
   UPI receipt confirmation is manual, not verified by a payment gateway.

## Current limits

One outlet/branch per restaurant. Cash and manually confirmed UPI are supported.
Orders and purchases use commands; financial history cannot be replaced with a
bulk sync. Discounts must be applied before submitting a bill. Manager PIN
approval requires a live connection and is never written to the offline queue.

Offline billing is supported in an existing authenticated tab. Fresh login and
session restoration require the server; a cached app shell does not grant offline
authentication. Unsynced bills remain provisional until the server accepts pricing,
stock and permissions. Reloading while offline can display the shell, but requires
reconnection to restore the authenticated session.

Cloud account deletion, managed backup/PITR, delivery marketplaces, SMS and drawer
hardware are not completed integrations. The interface reports those limits;
provider backups/restores and cloud deletion require actual operational work.
Manual cash refunds across shift boundaries need reconciliation by the operator.
Legacy paid bills without original settlement ledgers require payment-history
reconciliation before cancellation; the application does not fabricate settlements
or refunds for imported history.
Cashfree payment links, signed webhooks, refunds/disputes and external AI providers need live provider tests. See `ops/LIFECYCLE_CASHFREE_SETUP.md` for Step 3–4 sandbox validation and limits.
Free hosting availability and high-load/multiple-instance operation have not been
certified by the local automated tests.

A plaintext pending-signup file was removed from the repository. Historical Git
commits can still contain its old contents; invalidate any credentials taken from
that old file rather than treating deletion of the latest file as history removal.

Platform references: [Render free limitations](https://render.com/docs/free),
[Blueprint settings](https://render.com/docs/blueprint-spec),
[Node version](https://render.com/docs/node-version).
