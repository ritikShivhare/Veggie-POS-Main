# Operational notification routing

User-approved behavior: new order → Cook/Chef (KDS); explicitly served to customer
→ Cashier; ingredient stock at or below its own minimum/reorder level → Manager.
When the primary role has no active account OR nobody on an active shift, use the
configured fallback. Defaults use Owner. Fallback recipients may be off duty; if
that role has no active account, active Owners receive it.

Owners configure each alert's enabled state, recipient role and fallback role in
Settings → Operational Notifications → Save notification routing. This has its
own version and explicit-save endpoint, independent of general settings autosave.
Stale configuration edits return 409 and require a reload/review.

Kitchen workflow: Pending → Preparing → Ready → Mark Served to Customer. Only
that explicit final action sends the Cashier alert. It records service metadata
in tenant_objects; it never records a payment, changes financial order status,
or deducts stock again. Ready, version and tenant/day access are checked on the
server. An unpaid served bill remains available for cashier settlement.

Recipient filtering happens on the server. Staff can read/dismiss only their own
alerts, with independent per-person state. Historical untargeted reports are
visible only to Owner/Manager. Dispatch logs and clearing logs require Owner.
The Notification Center is available to authenticated staff through the sidebar
and header bell. New assigned alerts also display a toast during polling; old
alerts at login remain in the inbox rather than producing a toast flood.

Alerts are committed atomically with business writes using existing schema-9
transactions. They are not dependent on the demo EventBus simulation. Duplicate
order/serve retries do not duplicate alerts. Stock alerts fire when entering low
stock, not on every subsequent deduction, and rearm after restocking above the
threshold. A failed business transaction leaves no alert. No SQL migration,
credential reset, record purge, email, SMS or browser push subscription is needed.

Scope and limits: in-app alerts require the app open and authenticated. Polling
is about 10 seconds plus network latency; this is not OS push delivery. A shift
must be started to count as on duty. Routing changes affect future alerts;
existing reports are not backfilled. The existing financially sealed/paid order
workflow is unchanged; the new service confirmation is for Ready orders. Closed
or offline apps receive stored assigned alerts when they reconnect. The served
action itself requires online confirmation and does not claim offline success.

## Verification and deployment

Run `npm run lint`, `npm test`, `npm run build`, and `git diff --check`.
Tests cover absent/inactive/off-duty fallback, configured/disabled rules, stale
saves, cross-tenant headers, non-owner configuration denial, recipient inbox
isolation, separate read/dismiss state, concurrent dedupe, business rollback,
explicit service and unchanged financial data, ingredient thresholds and both
saveAll/update restock paths. PostgreSQL integration verifies an actual order
transaction persists its recipient notification. UI tests verify explicit saves
and truthful failed service/settings requests.

Review found a purchase/update restock path that bypassed alert rearming. A
failing regression reproduced it; calling stock evaluation in the same update
transaction made the regression pass. The sidebar billing gate was removed so
inventory-only recipients can reach the inbox.

Deploy this branch through the existing Render auto-deploy; verify exact commit
and `/api/health` schema 9. Manual acceptance: use separate Cook, Cashier, Manager
and Owner sessions with active shifts; place an unpaid order, mark Ready, confirm
Served, then check Cashier inbox and settle normally. Cross stock below its
minimum, restock, and cross again. End the primary shift and repeat to verify
fallback. Confirm another restaurant sees none of these alerts. Live browser
acceptance requires authenticated restaurant sessions and is separate from
local automated HTTP/PostgreSQL evidence. Rollback code to the previous commit
if required; preserve stored notification/service metadata and all business data.
