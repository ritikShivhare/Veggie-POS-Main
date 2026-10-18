# Step 3 & Step 4: verification and release

Branch: `integration/aatmyam-v1`, Draft PR #3. Do not merge main or change the live service branch as part of code review.

## Implemented rules

| Plan | Price | Active staff in addition to Owner | Accepted orders | Duration |
| --- | --- | --- | --- | --- |
| Free Starter | ₹0 | 3 | 30 | Anchored 30-day cycle; 5 open KOTs |
| Trial | ₹0 | 10 | 250 total | Once, 14 days |
| Professional Pro | ₹999 inclusive | 10 | 500 | 30 days |
| Enterprise Elite | ₹1,999 inclusive | 25 | Unlimited, fair use | 30 days |

The backend counts accepted creation time rather than a browser-supplied bill date. The order command checks allowances inside the existing tenant transaction/CAS mechanism, including outbox replay. Owner is outside the staff slots; extra Owner accounts cannot be used to bypass the cap. Inactive staff never consume capacity or authenticate.

Expiry applies on the next server access and in the subscription scheduler. This is authoritative even if a browser stays open or a free Render instance sleeps. Expiry returns the account to Free, freezes inventory, and pauses stock validation/deduction; Free billing continues against menu prices. No historical data is deleted. Excess nonowner staff become inactive; Owner chooses up to three in Billing. Existing PIN hashes remain intact. Upgrading does not silently reactivate staff who may have been removed for security reasons; Owner can reactivate them explicitly in Staff.

Trial KOTs are snapshotted on expiry: items and totals cannot be discounted/cancelled/edited; settlement is allowed for 12 hours from expiry. Expired snapshots remain in the ledger but no longer consume Free open-KOT capacity. Paying for a plan does not silently reopen the expired settlement window. Contact support for unresolved old bills.

Eligible registration starts one trial. One lifetime trial per tenant/mobile. Reused registered GSTIN/FSSAI/VPA enters Review Required on Free; MFA super-admin may approve with an audit reason. Mobile matching uses registered contact details; this does not introduce SMS verification or establish the person's ownership of that number. Identifiers added only after trial activation cannot retroactively prevent the trial; eligibility approval should check business details during onboarding.

Trial and paid AI reports share a cap of five successful provider-generated reports per IST day (00:00 reset). Failed or simulated reports release the reservation; concurrent generation is capped. Basic reports and public product help do not grant private tenant access.

Same-plan paid renewal within the 24-hour grace anchors the old expiry; an early payment extends paidUntil without resetting the active cycle usage. A verified mid-cycle Elite purchase starts a fresh 30 days without proration. Paid entitlement is never granted from browser return query parameters.

## Required Render configuration

Keep the existing backend Supabase URL and server-only service-role key. Step 2 additionally needs SUPER_ADMIN_USER_ID, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY; the latter must be a public/publishable key, never the service role.

For Cashfree sandbox validation add **server-only** variables:

```
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=<sandbox-app-id>
CASHFREE_SECRET_KEY=<sandbox-secret>
APP_URL=https://<separate-branch-preview-host>
```

Do not paste secrets into GitHub, frontend `VITE_*` variables, chat, or screenshots. This branch uses native server fetch; no Cashfree SDK installation is needed. Stripe endpoints and payment simulators cannot grant access.

In Cashfree's webhook configuration, point to:

```
https://<separate-branch-preview-host>/api/webhooks/cashfree
```

Enable Payment Link, Refund Status and Dispute notifications. Link create requests also carry the HTTPS notify_url when APP_URL is set. Production mode requires approved production credentials and Cashfree account activation; sandbox success is not production payment verification.

Each link is tenant-specific, server-priced and valid for 60 minutes, without partial payments. Creating another cancels the prior pending link; uncertain cancellation blocks replacement. After a creation timeout, use Recover checkout with the original intent; it reuses the same provider ID. If the intent never reached Cashfree and expires, Check Payment Status releases it only after Cashfree confirms not-found. A provider outage leaves intent pending instead of making an extra payable link.

The webhook verifies timestamp + exact raw bytes with HMAC-SHA256 and constant-time comparison. Link status, full amount/currency, paid order and successful payment time are fetched from Cashfree before activation. The per-tenant ledger activates each invoice once. Check Payment Status and the scheduler use that same reconciliation. Refund reconciliation also detects a missed successful-refund webhook. Refund/dispute notifications place the account on Free + Financial Review; a payment replay cannot clear it. MFA admin resolves the review with an audit reason, leaving access on Free. New verified payment is required for paid access; no refunds are initiated by this app.

Scheduler reconciliation depends on the server running and provider connectivity. Free Render can sleep; keep webhooks enabled and use Check Payment Status if delivery is delayed. A merchant should review disputed/aged unmatched payments in Cashfree. The app does not claim a permanent worker or instant payment-state convergence during outages.

## Preview verification

1. Deploy **this branch to a separate preview service** backed by schema 9. Preserve the existing live service branch. Do not reuse the older marketing preview database without its schema readiness check.
2. Open `/?subdomain=saas`, sign in with the approved Supabase owner, enroll and verify TOTP locally. Confirm a second/unapproved account and legacy login are rejected.
3. Register a test restaurant using an email inbox you control. Confirm 14-day trial and Owner+10 staff; verify duplicate mobile does not get another trial. Inspect Review Required separately.
4. Test Cashfree sandbox checkout for ₹999 and ₹1,999. Return URL alone must not upgrade; Check Payment Status or verified webhook must upgrade exactly once. Repeated clicks/webhook deliveries must not add days twice.
5. Create another pending link and confirm the previous one is cancelled. Test failed/expired payments, simulated provider outage and retry. Never use a production card/payment to substitute for sandbox validation.
6. Use isolated test tenant timestamps/fixtures to check trial expiry, 12-hour KOT settlement, Free five-open cap, 30-order limit, staff selection, frozen stock and offline replay. Do not change real tenant billing timestamps casually.
7. In sandbox, refund or dispute the test payment. Confirm Free + Financial Review; payment-status replay and Start Trial cannot regain paid access. Confirm admin review resolution is audited.
8. Before a production release, independently verify real provider webhooks, SMTP/signup, actual MFA login and two-tenant/device behavior. Automated/local provider mocks do not establish those live checks.

## Current production observations

Read-only checks after the user's manual cleanup found schema 9, staff 0, orders 0 and idempotency keys 0; one Auth account has server-owned SUPER_ADMIN role. No verified TOTP factor existed at the time of that check. Telemetry, job objects, an empty tenant registry, and their revisions may reappear while the old backend is running; those are not restored restaurant demo records. Render UUID/env readiness and live MFA/Cashfree provider behavior have not been independently verified by this change.
