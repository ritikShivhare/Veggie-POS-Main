# Deployment repair verification — 2026-10-13

Base: `6184b9450487b0f931a44d4221911ca8634912f5`.
This commit repairs the audited application and records local evidence.
It is not a certification that every hosted integration or device works.

## Checks completed locally

- Clean `npm ci` with the checked-in lockfile.
- TypeScript: `npm run lint` passed.
- Vitest: **258 tests in 26 files passed** with two workers.
- Production client and server build passed.
- Compiled production server smoke passed against a local mock Supabase endpoint:
  client assets, app manifest/service worker, CSP, anonymous sync rejection and
  exclusion of the server bundle/source map from the public static directory.
- `npm audit`: **0 known vulnerabilities** in the installed dependency tree.
- Additional probes cover actual HTTP routes, PostgreSQL via PGlite, WebSocket
  isolation and IndexedDB via fake-indexeddb. All mail in tests is mocked.

The former worker crash was an infinite recursion in `StaffRepository.add`:
its override discarded the transaction parameter used by `BaseRepository.add`.
Forwarding that parameter allows the original PIN and API regression checks to
complete. It was not fixed by increasing the heap or skipping tests.

## Repairs and evidence

| Audit groups | Result in this commit | Verification or remaining limit |
| --- | --- | --- |
| F01–F04, F07–F09 | Verified admin identity; hashed password plus OTP; no default accounts; owner-only session management; protected leads/infrastructure; public staff fields | HTTP RBAC, tenant isolation, PIN and deployment regression tests; live Google identity needs configured OAuth |
| F05–F06, F13–F15, F27–F28 | Server-only Data API/RPC access; explicit SQL field mapping; tenant composite keys/FKs; atomic revision-checked SQL commit; paginated reads; unified settings | PostgreSQL fresh install and upgrade from original 001–007; anon/authenticated RPC rejection, failed-FK rollback, 1205-row pagination, stale revision |
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

## Still required on the hosted installation

Apply migrations **008 and 009** to the existing Supabase project and configure
Render's required environment values from [DEPLOYMENT.md](DEPLOYMENT.md).
The new server refuses production startup if the database/schema or email setup
is missing. A passing old `/api/health` that only reports time does not prove the
new schema is installed.

Confirm the new commit/schema on the live health endpoint, then verify real OTP
in an inbox you control, two restaurants/two devices, and the actual printer/UPI
workflow. The local PostgreSQL adapter does not test Supabase's hosted network,
SMTP, Resend delivery events, or Render's service settings. Historical Git
credentials from the removed signup file must be invalidated if previously used.

No production database migrations, email credentials, backup/restore or real
hardware actions were performed during this verification. High-load operation
and multi-instance hosting remain unverified. The build still reports a large
main JavaScript chunk; bundle performance work is separate from these correctness
repairs.
