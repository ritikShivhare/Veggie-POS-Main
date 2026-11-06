# Manual recovery archive

This is an operator-reviewed alternative when historical recipe/menu or shift/staff
references are broken and authoritative recovery records are unavailable. It is
outside automatic Supabase and numbered application migrations.

The SQL retains each complete original row in a private recovery table before
moving it out of active recipes/shifts. A moved historical shift leaves ordinary
app reports, so obtain the data owner's decision first. Existing valid records,
stock balances, orders, payments and financial totals are retained.

Before execution, take a backup/export and privately inspect PREFLIGHT.sql. Set
app.recovery_expected_recipes and app.recovery_expected_shifts to the reviewed
counts as session settings. The script rejects unset/negative expected counts or
changed scope and rolls back. A repeat with no remaining orphans preserves the
archive without moving additional data. Duplicate archive records fail safely.

For a synthetic batch only, the settings could be:

```sql
SET app.recovery_expected_recipes = '2';
SET app.recovery_expected_shifts = '1';
```

Use the actual privately reviewed values, not this example. Run the SQL, inspect
preserved/active rows, rerun preflight, then upgrade the numbered application schema.
Archive access is restricted to the service role or database administrator.

Tests compare all original fields, reject public roles and changed scope, retry
safely, and then upgrade the full schema. Recovery remains possible after restoring
authoritative missing parent records; do not overwrite new rows, invent credentials
or bypass tenant constraints. The archive does not replace a full database backup.
