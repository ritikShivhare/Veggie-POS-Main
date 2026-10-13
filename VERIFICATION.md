# Deployment repair verification — 2026-10-13

Base: `6184b9450487b0f931a44d4221911ca8634912f5`.
This commit repairs the audited application and records local evidence.
It is not a certification that every hosted integration or device works.

Release remains blocked: code is committed locally but has not been pushed;
Render still runs the old commit; application migrations 008/009 and real OTP
delivery have not been completed. Three compatible Supabase security repairs have
been applied and verified.

## Checks completed locally

- Clean `npm ci` with the checked-in lockfile.
- TypeScript: `npm run lint` passed.
- Vitest: **266 tests in 27 files passed** with two workers.
- Production client and server build passed.
- Compiled production server smoke passed against a local mock Supabase endpoint:
  client assets, app manifest/service worker, CSP, anonymous sync rejection and
  exclusion of the server bundle/source map from the public static directory.
- `npm audit`: **0 known vulnerabilities** in the installed dependency tree.
- Additional probes cover actual HTTP routes, PostgreSQL via PGlite, WebSocket
  isolation and IndexedDB via fake-indexeddb. All mail in tests is mocked.
- The observed manually-created hosted schema is reproduced without production
  data: missing audit/version columns are filled, settings/profile writes succeed,
  and an invalid legacy reference causes the entire upgrade to roll back.
- Password checks reject both ASCII and multibyte inputs exceeding bcrypt's 72-byte
  bound. A password sharing the first 72 bytes with a valid owner/admin password
  cannot authenticate or obtain an admin OTP challenge.

The former worker crash was an infinite recursion in `StaffRepository.add`:
its override discarded the transaction parameter used by `BaseRepository.add`.
Forwarding that parameter allows the original PIN and API regression checks to
complete. It was not fixed by increasing the heap or skipping tests.

## Repairs and evidence

| Audit groups | Result in this commit | Verification or remaining limit |
| --- | --- | --- |
| F01–F04, F07–F09 | Verified admin identity; hashed password plus OTP; no default accounts; owner-only session management; protected leads/infrastructure; public staff fields | HTTP RBAC, tenant isolation, PIN and deployment regression tests; live Google identity needs configured OAuth |
| F05–F06, F13–F15, F27–F28 | Server-only Data API/RPC access; explicit SQL field mapping; tenant composite keys/FKs; atomic revision-checked SQL commit; paginated reads; unified settings | PostgreSQL fresh install and upgrades from original 001–007 and observed manual schema; anon/authenticated RPC rejection, failed-FK rollback, 1205-row pagination, stale revision |
| F10–F12 | Owner password used; hashed durable OTP challenge; no tracked signup file; email failure reported; failed resend preserves the old challenge; verified signup is atomic | Mock-email HTTP signup/resend/verification/PIN/password sequence and SQL signup consumption. Real inbox delivery remains a release gate |
| F16–F19, F23, F34 | Calculation inside transactions; one financial command path; immutable submitted totals; dedicated settlement/cancellation; reverse original stock ledger; manual refund confirmation; atomic idempotency | Concurrent stock, payment ledger, cancellation, integrity and idempotency tests. Shift close counts settlements during the shift and rolls back if audit fails |
| F20–F22 | Scoped IndexedDB keys; durable order/payment queue; dependent command ordering; validate success JSON; preserve pending orders; recover expired auth | Offline queue tests and a real v3→v5 upgrade test preserving orders/commands while stripping credentials |
| F24 | Fresh role/version checks on sessions; revoked WebSocket disconnected; global actions restricted | Session/RBAC tests and a revoked-WebSocket event probe |
| F25–F26, F31, F35–F37 | Removed false deletion/backup/integration assurances; provider actions return explicit unsupported responses; app shell caching; deployment readiness; accurate branding/plans | Cloud deletion and managed backups still require operator/provider work. Fresh offline authentication, delivery/SMS/hardware and external providers are not completed integrations |
| F29–F30 | Stripe raw-body handling before JSON parsing; subscription plan metadata; server-side global provider settings | Cash/manual UPI are the tested payment scope. Recurring billing, real webhook delivery and external alert providers still need live configuration/tests |
| F32–F33, F38 | Correct staff API path; explicit versioned removals; staff deactivation preserves financial/shift history; authenticated management screens; numeric/version validation; visible queue recovery | HTTP staff edit/delete checks, PostgreSQL historical-shift preservation, management merge tests and TypeScript build |

Legacy device settings and nested queued commands are scrubbed of PIN/password/
session credentials during upgrade. Commands that contained such credentials
remain visible for review rather than silently replaying removed credentials.

## Hosted inspection and compatible security changes

- The user's confirmed Render workspace contains the supplied POS service, linked
  to repository `main`. Its live commit is still the base revision above. No new
  deploy or environment update was triggered.
- Hosted logs report missing Supabase keys and an in-memory database. Logs also
  report missing real SMTP credentials and failed email dispatch. The current
  health response reports only status/time and cannot establish persistence.
- The active POS-named Supabase database matches the legacy schema. It was created
  manually, without recorded application migrations or all expected audit columns.
- `restrict_legacy_public_rpc_access` was applied: anonymous and authenticated roles
  cannot execute the three legacy definer RPCs or read/write `restaurant_sync`.
  Service-role access is preserved; function search paths are fixed.
- `hash_legacy_staff_pins` was applied: all **31 staff PINs are bcrypt hashes**,
  compared with 23 plaintext and eight hashed values before the repair. A synthetic
  native pgcrypto hash verified successfully with the application bcryptjs verifier;
  no real PIN values were read or printed.
- Security Advisor now reports no lints. This does not certify the application,
  email provider or all legacy data.
- Row counts are preserved: 31 staff, 22 orders, 14 recipes, five shifts, 84 tenant
  objects and nine legacy snapshots. No business records were deleted or invented.
- `hash_legacy_json_pins` was applied on a fresh authorized resume after two earlier
  attempts failed with an expired request state. Numeric PIN copies are now zero,
  compared with five affected snapshot rows and three object rows beforehand.
  No plaintext password fields were found by the inspected JSON paths. The SQL
  transformation passed nested-data, order-preservation and repeat-run tests.
  Read-back confirms all nine snapshots and 84 objects remain. Fingerprints with
  PIN fields normalized match the before values, proving the other JSON unchanged.
  The temporary transformation helper is removed; migration history matches.
- Data preflight finds **13 orphan recipes** containing **37 missing ingredient
  links**, and **one orphan shift**. All missing ingredient links belong to the
  orphan recipes; none references another tenant's existing ingredient. The recipe
  for the surviving menu item has valid ingredient links. Legacy snapshots did not
  provide matching missing menu/staff rows. The upgrade retains those records and
  stops safely rather than guessing a replacement.

## Still required on the hosted installation

Apply migrations **008 and 009** to the existing Supabase project and configure
Render's required environment values from [DEPLOYMENT.md](DEPLOYMENT.md).
Resolve the historical references first. The current GitHub connection rejects
tree creation with HTTP 403
`Resource not accessible by integration`; no GitHub push or new CI run is claimed.
The new server refuses production startup if the database/schema or email setup
is missing. A passing old `/api/health` that only reports time does not prove the
new schema is installed.

Confirm the new commit/schema on the live health endpoint, then verify real OTP
in an inbox you control, two restaurants/two devices, and the actual printer/UPI
workflow. The local PostgreSQL adapter does not test Supabase's hosted network,
SMTP, Resend delivery events, or Render's service settings. Historical Git
credentials from the removed signup file must be invalidated if previously used.

Only the three compatible security migrations listed above were applied to the
hosted database. Application migrations, provider email configuration,
backup/restore and real hardware actions remain incomplete. High-load operation
and multi-instance hosting remain unverified. The build still reports a large
main JavaScript chunk; bundle performance work is separate from these correctness
repairs.
