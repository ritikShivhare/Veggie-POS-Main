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
