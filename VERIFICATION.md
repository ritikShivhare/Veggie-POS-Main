# Aatmyam POS repair verification

This document describes code and reproducible checks. Live account findings and
operator decisions belong in the private deployment report.

## Automated validation

- Clean install using the checked-in npm lockfile.
- TypeScript: `npm run lint`.
- Vitest: 271 tests across 27 files at the expanded checkpoint.
- Production client/server build and a compiled-server smoke with mock Supabase.
- Dependency audit and GitHub Actions checks are visible on [PR #1](https://github.com/ritikShivhare/Veggie-POS-Main/pull/1).
- Email providers in automated tests are mocked; inbox delivery needs a real provider.

Tests exercise HTTP permissions, tenant isolation, session/WebSocket revocation,
PostgreSQL migrations and atomic transactions, financial ledgers, IndexedDB upgrades,
command ordering/retry, preserved offline records, password/PIN validation and OTP
resend failure behavior. Synthetic legacy fixtures contain no production rows,
account identifiers or real credentials.

## Core repairs

Authentication verifies the configured SaaS owner, hashes password/OTP challenges,
checks current staff roles and versions, strips private staff fields, and removes
shared default credentials. Password inputs obey bcrypt's UTF-8 length bound;
user-provided text in verification email templates is escaped.

Database writes use explicit field mapping, tenant-composite keys, atomic
revision-checked commits, pagination and complete schema upgrades. Direct browser
access to business Data API tables and privileged RPCs is denied. The hosted-schema
fixture covers manually-created older schemas and complete rollback on invalid links.

Financial commands calculate pricing and stock inside transactions, settle once,
reverse the original stock ledger on cancellation, and require manual refund
confirmation. Paid legacy bills without an original settlement record require
reconciliation; unpaid completed kitchen bills remain cancellable.

Offline storage uses tenant-scoped keys, preserves pending orders/commands through
upgrade, strips credentials, orders dependent commands, validates success responses
and exposes failed commands for recovery. Fresh authentication requires connectivity.

The manual archive option is parameterized by privately reviewed expected counts.
Tests verify exact row preservation, public access denial, safe retry, changed-scope
rejection and a subsequent full schema upgrade. It is outside automatic migrations
and requires the operator's data-handling decision.

## Release validation

Follow DEPLOYMENT.md: migrations and private provider environment must be ready
before deploying. Confirm schema/commit health, real OTP delivery, two restaurants
and devices, cash/manual UPI billing and offline replay. Hardware, external providers,
high-load and multi-instance operation require separate real-world validation.
Automated checks do not certify that every hosted integration or device works.
