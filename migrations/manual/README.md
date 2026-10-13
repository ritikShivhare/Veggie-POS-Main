# Proposed recovery of the inspected legacy records

Status: prepared and tested; **not executed on the hosted database**.
Requires the user's approval because moving a historical shift changes which
records appear in the app's active shift reports.

The database contains 13 recipes without their menu rows and one shift without
its staff row. Those recipes also contain 37 missing ingredient references.
Restoring authoritative missing records is preferable when a valid backup exists;
the inspected legacy snapshots did not contain matching missing menu/staff rows.

`archive_invalid_legacy_references.sql` is an alternative for this exact batch:

- Preserves all fields of the 13 recipes and the one shift as JSON in a private
  `deployment_recovery_archive` table, with tenant, source ID, reason and time.
- Moves those rows out of active recipes/shifts only after preserving their exact
  content. The existing valid recipe, other shifts, staff, orders and payments
  are retained in their active tables. No stock balances or financial totals change.
- Uses one transaction and locks the related tables. Changed scope, duplicate
  archive records or any failure roll back the entire operation.
- Accepts exactly 13 orphan recipes plus one orphan shift, or no remaining orphans
  on a repeat run. Any other count requires renewed review.
- Denies anonymous/authenticated Data API access to the archive; only server-role
  or database administrator access is allowed.

This file is outside both automatic Supabase migrations and the numbered
application migration sequence. Do not automatically apply it or remove records
to bypass migration 008. Tests reproduce the exact batch, compare full original
rows with the archive, check public-role denial, retry safely, and then install
schema 9. A changed batch is rejected without moving data.

After approval, take a provider backup/export, run this file, inspect the archive
and active row counts, run `../PREFLIGHT.sql`, then apply 008 and 009. Keep the
archive until recovery/reconciliation is complete. It is not a replacement for
a full database backup or point-in-time recovery.

Recovery remains possible after the genuine missing menu/ingredient/staff records
are restored. The database administrator can reinsert the retained original fields
for the corresponding tenant using the archive; the tenant foreign keys must pass.
Do not overwrite a newly created record with the same ID or invent a login account
to satisfy the old reference. Restored records need deliberate version/audit handling.
