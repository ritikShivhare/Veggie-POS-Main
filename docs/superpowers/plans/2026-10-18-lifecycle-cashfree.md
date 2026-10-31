# Subscription Lifecycle and Cashfree Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; implementation stays in the existing isolated integration worktree.

**Goal:** Implement approved Step 3 subscription enforcement and Step 4 Cashfree automation.
**Architecture:** Shared plan catalog; transactional tenant subscription state and command-level quota checks; provider adapter isolated from entitlement transitions. Webhooks and owner status checks use the same reconciliation function and persisted ledger.
**Tech Stack:** TypeScript, Express, existing Supabase transaction RPC/schema 9, native fetch/crypto, React, Vitest.
**Spec:** docs/superpowers/specs/2026-10-18-lifecycle-cashfree.md

## Global Constraints
- Preserve MFA, tenant isolation, staff/PIN history and INR 999/1999 inclusive prices.
- Use existing tenant_objects and revision/CAS transactions; no production schema change or deployment.
- Fixed 30-day windows, 14-day trial, 12-hour frozen-KOT settlement, 24-hour paid renewal grace, 60-minute links.

## Review Focus
- Concurrent quota/order and link creation on multiple servers: existing CAS retries, stable provider idempotency, no duplicate entitlement.
- Provider timeout after creation: persist intent before API call; retry same identity, never create an untracked payable link.
- Old/reversed payment after newer renewal: never grant twice or clear Financial Review automatically.
- Offline commands and sync must use current server entitlements.
- Downgrade must preserve Owner, PIN hashes, inventory history and allow billing recovery.

### Task 1: Lifecycle
Files: shared/planCatalog.ts; server/features/shared/subscription.ts; new SubscriptionLifecycle.ts; staff, pricing, financial commands, sync/auth/AI integrations; tests/subscriptionLifecycle.test.ts.
Interfaces: getSubscription(tenantId), getPlanLimits(subscription), assertOrderCreation(tenantId, rawOrder), assertSettlement(tenantId, orderId), startTrial(tenantId).
- [x] Write boundary tests (anchored cycles, owner exclusion, trial expiry snapshots/settlement, lifetime eligibility, AI success/day cap, inventory freeze).
- [x] Run tests red; implement transactional state and enforce inside command/sync boundaries.
- [x] Run targeted and full regression tests.

### Task 2: Cashfree
Files: new server/features/billing/CashfreeClient.ts and CashfreeBilling.ts; replace routes/billing.routes.ts; raw webhook registration/context; tests/cashfreeBilling.test.ts.
Interfaces: createPaymentLink(tenantId, plan, requestId, customer); reconcilePayment(tenantId, linkId); verifyCashfreeSignature(raw, signature, timestamp, secret); processCashfreeEvent(event, hash).
- [x] Write provider-boundary tests for HMAC, full amount/currency, duplicate webhook/status, cancellation and expiry, refund/dispute, tenant authorization.
- [x] Run red; implement adapter plus persistent intents and reconciliation.
- [x] Run targeted and full tests.

### Task 3: Product and delivery
Files: BillingSettings.tsx; landing and copilot pricing; env/deployment documentation.
- [x] Match app/website Owner+staff limits, trial and Cashfree UI. Display pending link, Check Payment Status, review/freeze state, downgrade staff selection.
- [x] Test UI and regression; lint/build/diff checks; fresh review.
- [ ] Push same branch and update Draft PR #3 with exact automated and live limitations.


Execution evidence and operational limitations: `ops/LIFECYCLE_CASHFREE_SETUP.md`. Focused reviewer findings were reproduced and fixed (Free billing with retained frozen inventory; trial bypass of Financial Review; expired intent recovery; frozen KOT capacity). Reviewer final pass was interrupted by an agent usage limit; author completed the remaining review and automated checks. This is not a completed independent security audit.
