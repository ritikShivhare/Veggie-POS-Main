# Step 3–4 implementation baseline

Continues the user's approved Phase 4 v1.0 frozen design and direct instruction to implement on `integration/aatmyam-v1`. Main/live deployment is excluded.

- Free ₹0: Owner plus 3 active staff, 30 orders per anchored 30-day cycle, 5 open KOTs.
- Trial: once per tenant/mobile, 14 days, Owner plus 10 staff, 250 orders total, full inventory, 5 successful AI reports per IST day. Reused GSTIN/FSSAI/VPA requires review and remains Free.
- Pro ₹999 inclusive: Owner plus 10 staff, 500 orders per 30 days. Elite ₹1,999 inclusive: Owner plus 25 staff, unlimited orders subject to fair use.
- Trial/paid expiry downgrades to Free. Existing inventory/recipes remain readable and frozen; automatic deductions pause. Excess staff are temporarily inactive, Owner retained, Owner selects up to 3 to reactivate. No deletion/reset of PINs.
- On trial expiry snapshot open KOTs; immutable items/totals, settlement only for 12 hours. New orders follow Free limits. No offline or sync bypass.
- Paid renewal within 24-hour grace anchors prior expiry; after grace starts at verified payment. Mid-cycle Elite starts fresh 30 days with no proration.
- Cashfree replaces Stripe. Server prices and tenant identity. Links expire after 60 minutes; prior pending links cancelled before replacement. No real payment calls without explicit configured mode/credentials.
- Raw-body HMAC signature, provider API reconciliation, transaction-safe duplicate/replay protection. “Check Payment Status” never trusts browser success parameters. Refund/dispute events downgrade to Free and flag Financial Review; replay cannot reactivate a reviewed payment.
- No payment simulator in production. Keep payment ledger separate from restaurant Cash/manual-UPI receipts.

Operational checks: user-run cleanup verified schema 9, staff/orders/idempotency zero. One Auth user has server-controlled SUPER_ADMIN role; zero verified MFA factors, so first login enrollment remains required. Runtime job/telemetry objects may reappear after cleanup.


## User operational refinements (18 October)

- After the 12-hour trial KOT window, an active restaurant Owner may settle the immutable snapshot total in Cash/UPI or close unpaid with a required audit reason, on Free or paid plans. No fabricated revenue/payment or automatic stock correction on unpaid close. Recovery is tenant-scoped, transactional and audited.
- Downgrade retains the first three previously active staff by stable priority Cashier → Manager → other roles. Owner stays active; existing inactive staff are never silently reactivated. Owner can revise the three choices later.
- The Pro → Elite button must have an adjacent explicit fresh-30-day/no-proration/unused-Pro-credit note.
