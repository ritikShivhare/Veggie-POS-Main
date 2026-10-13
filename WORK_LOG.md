# Aatmyam POS deployment repairs

User authorized code changes, GitHub push, and a second verification on 2026-10-12.
Base commit: 6184b9450487b0f931a44d4221911ca8634912f5.
Work branch: fix/aatmyam-deployment. Do not modify or deploy third-party credentials.

Scope: resolve the 38 finding groups in the deployment audit. Security and core
financial/sync correctness take priority. Preserve customer records; migrations
must retain existing data and fail if pre-existing invalid cross-tenant links exist.

Audit reproduction tests are in the adjacent audit-repo checkout. Baseline had
208 passing tests and 30 failing targeted deployment/offline regression checks.
No AGENTS.md. Do not delegate to agents (not requested).

Push main only after build, typechecks and expanded tests pass. Hosted database
migrations and provider environment settings require separate verification; never
claim all live functions passed without that evidence.

Checkpoint 1 (2026-10-12): replaced unsafe Supabase compensation writes with atomic revision-checked RPC; added tenant-composite SQL keys/foreign keys and a Dexie v4→v5 copy migration. Login/admin bypasses, session token disclosure and global controls tightened. Order calculation moved inside transaction; cancellation reverses committed stock movements and requires manual refund confirmation. Financial snapshots are rejected; management changes are versioned. TypeScript passed before latest UI casts; baseline checkpoint 171 passed / 34 failed, mostly tests expecting retired financial snapshots or global Owner privileges. Do not publish until fixtures/new integration tests and UI are corrected and all checks pass.

Final local checkpoint (2026-10-13): staff transaction recursion fixed; clean
install, TypeScript, 258 tests/26 files, production build and dependency audit
passed. Added real legacy SQL/Dexie upgrades, OTP resend/email-failure/password
flow checks, owner profile edit, settlement-based atomic cash shift close and
historical staff deactivation. Added DEPLOYMENT.md and VERIFICATION.md. Required
hosted migrations 008/009 and verified HTTPS email have not been applied by this
workspace. Push/CI/live observations are reported separately after publication.

Resumed provider checkpoint (2026-10-13): user confirmed Render's My Workspace.
The supplied service still runs base commit 6184b94, auto-deploys main, has no
health-check path, and logs missing Supabase and real email credentials. The
active POS Supabase schema was created manually; added missing audit/version
columns and legacy function guards to migration 008 and reproduced its schema in
a metadata-only fixture. Valid upgrade/profile/settings operations pass; bad
references roll back without deleting records. Two compatible migrations applied
and verified: public legacy RPC/snapshot access closed; all 31 staff PINs hashed.
Row counts remain unchanged and Security Advisor returns no lints.

Additional read-only preflight: 13 orphan recipes, 37 missing ingredient links
inside those recipes, one orphan shift. Snapshots have no matching missing menu
or staff recovery candidates. Native JSON has PIN copies in five snapshot and
three object rows; no inspected plaintext password fields. The JSON PIN hashing
migration is locally tested but two hosted attempts returned an expired request
state. History/read-back confirm it is pending; do not bypass that failure through
another unreviewed provider write. Password authentication now enforces bcrypt's
72-byte UTF-8 bound. Final resumed suite: 266 tests/27 files, TypeScript and build
passed. GitHub integration returns write 403; no push, new CI or new live release.
Finish account authentication and data/email readiness before updating main.

Next authorized resume (2026-10-13): the fresh Supabase request successfully
applied `hash_legacy_json_pins` (native version 20261013081822). Read-back reports
zero numeric JSON PIN copies. All nine snapshots and 84 tenant objects are retained;
normalized non-PIN fingerprints match before/after. Staff/orders/recipes/shifts
counts remain unchanged and the temporary function is absent. Renamed the SQL
file to the actual hosted migration timestamp and updated the current report.
The first GitHub CLI device login did not save authorization: its process was
lost after a network/session error. Prepared a temporary private device-flow
handoff that saves its state and the received token before any API identity read,
so a failed read cannot discard an authorized token. No new GitHub push yet.
