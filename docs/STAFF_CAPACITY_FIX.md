# Active staff capacity fix

Base: `fix/aatmyam-deployment` at `913027ccd638288ceab53d49eba4d687cdfc7ff9`.
Isolated branch: `fix/active-staff-capacity`. This change does not require a database
migration or production data repair. It does not reset credentials or physically
remove staff rows. Review and deploy the complete branch, not a partial copy onto
an older AI Studio/main snapshot.

## Problem and resulting behavior

An Owner plus two inactive soft-deleted staff rows was counted as three occupied
seats by billing and creation, while the staff directory showed one. Usage and
capacity now count active members consistently. The Owner occupies one active seat.
Inactive and suspended members occupy no seats and cannot authenticate. Existing
records with omitted/null status retain the application's legacy active behavior;
title-case legacy statuses are recognized. Newly created records explicitly store
`active`. Unknown status values do not authorize login; incoming status mutations
accept only the three supported lowercase values.

## Exact filenames and before/after changes

The PR's Files changed view is the full before-and-after diff for every file.

| File | Before | After |
| --- | --- | --- |
| `routes/billing.routes.ts` | `staffCount: staffList.length` | `staffCount: countActiveStaff(staffList || [])` |
| `routes/pos.routes.ts` | Pre-transaction `staffList.length >= limit`; missing delete target reached update; delete resubmitted the full stored staff row | Repository enforces active capacity inside transaction; missing target returns 404; soft-delete updates only id/status with version; Owner protection remains |
| `server/features/staff/StaffRepository.ts` | add/update only hashed PIN and delegated persistence | add/update enforce active capacity and reactivation in the tenant transaction; unrelated existing credential fields are retained |
| `src/features/shared/staffStatus.ts` | No shared status predicate | Shared `isActiveStaff` and `countActiveStaff` for browser/server |
| `src/features/shared/types.ts` | Unspecified string status | Documents actual active/inactive/suspended status values and legacy forms |
| `src/features/staff/StaffShifts.tsx` | Counted all props; ignored refresh HTTP failures; could announce creation after failed refresh | Counts/renders active staff; checks HTTP and success/array shape; truthful partial-success errors; blocks additional writes until reload after uncertain refresh |
| `routes/auth.routes.ts` | Separate status comparisons | Same active predicate for PIN/password candidates and public directory |
| `server/features/auth/SessionService.ts` | Separate inactive/suspended checks | Same active predicate when validating existing sessions |
| `server/features/auth/PinSecurityService.ts` | PIN matcher itself accepted disabled members if a caller forgot filtering | Shared predicate in constant-time matcher; still compares every candidate |
| `server/features/shared/security.ts` | Sync hid inactive only | Sync uses the same active predicate |
| `server/features/shared/SyncService.ts` | Sync could grow/re-enable staff without a seat check | Capacity check before staff slice commit, including reactivation |
| `server/features/shared/validation.ts` | No status value validation | Reject unsupported status mutation values |
| `server/features/shared/database.ts` | Generic 403 handler labeled seat errors as cross-tenant violations | Preserves the specific `PLAN_LIMIT_EXCEEDED` 403 error; tenant checks remain unchanged |

Database mapping was inspected in `server/features/shared/schema.ts`: `staffList`
maps to SQL table `staff`, and `status` maps directly to `status` in both directions.
No invented `isActive` database field, new column, schema migration, or SQL deletion
is needed. Mapping remains unchanged and has a regression test.

Core counting change:

```ts
// Before: all retained history occupied seats
const count = staffList.length;

// After: the actual status field determines active seats
export function isActiveStaff(staff: Pick<StaffMember, 'status'>): boolean {
  return staff.status == null ||
    (typeof staff.status === 'string' && staff.status.toLowerCase() === 'active');
}
export function countActiveStaff(staff: Pick<StaffMember, 'status'>[] = []): number {
  return staff.filter(isActiveStaff).length;
}
```

Refresh failure handling:

```ts
// Before: HTTP status was ignored and creation success could still be announced
const fresh = await (await ApiClient.authenticatedFetch('/api/staff')).json();
if (fresh.success) onUpdateStaffList(fresh.data);
setFormSuccess('Registered ...');

// After: no synchronized-list success on HTTP, JSON, or API failure
const response = await ApiClient.authenticatedFetch('/api/staff');
const result = await response.json();
if (!response.ok || !result.success || !Array.isArray(result.data)) {
  throw new Error('Staff list refresh failed.');
}
onUpdateStaffList(result.data.filter(isActiveStaff));
```

A successful create/delete followed by a failed refresh is explicitly reported as
"created/deactivated, but the staff list could not refresh". Creation/deletion
failure leaves the displayed list unchanged. This distinguishes a committed write
from a failed follow-up read and avoids a false success indication.

## Tests

Validation on the focused patch: **289 tests / 30 files passed**, including 12 new
regressions; TypeScript, production client/server build and diff checks passed.
Live deployment has not been changed by this branch.

`tests/activeStaffCapacity.test.ts` covers real local HTTP endpoints and repository
transactions: one active plus two inactive rows; two available replacements then
403; concurrent final-seat creation; reactivation and sync bypass rejection;
soft-delete retention and unchanged credential hash; Owner and cross-tenant
protection; inactive authentication/session rejection; real SQL status mapping;
empty/failed production-read behavior without demo creation.

`tests/staffMutationUi.test.tsx` renders the actual React component: active-only
capacity; rejected creation; creation with failed refresh; deletion with failed
refresh. API calls are mocked only for these UI tests. Backend tests use local
synthetic fixtures. No real tenant or production credential is used.

```sh
npm ci --include=dev
npm run lint
npm test
npm run build
```

Legitimate tenant onboarding continues through the existing verified atomic signup
flow. Production empty/failed staff reads must never auto-create demo accounts;
that safeguard already exists in this base branch and is preserved. New tenant
signup is not replaced by a demo seeder.

## Safe deployment / rollback

1. Review this focused PR against `fix/aatmyam-deployment`; main/AI Studio can still
   contain older unmerged code. Do not replace newer backend files with AI Studio
   exports. Run the checks above on the final reviewed commit.
2. No staff SQL update/delete is necessary. Preserve existing inactive rows and
   Owner credentials. Do not clear pending offline operations as part of this fix.
3. Deploy the complete reviewed branch to a preview/test service with the existing
   schema 9 and private environment. Do not auto-merge or change the live service
   branch just to test the patch.
4. With owner-controlled test credentials, verify usage 1/3 for one active plus two
   inactive rows, create two members, reject a fourth active member, soft-delete a
   non-Owner and confirm a seat opens. Check inactive login is denied, Owner login
   still works, and another restaurant's staff remain separate.
5. Simulate rejected/failed create/delete and failed follow-up refresh. Confirm no
   false success, unchanged displayed list on rejected writes, and explicit reload
   guidance on committed-write/read-failure cases. Test concurrent creation and
   reactivation at the limit.
6. After these gates pass, merge this focused PR into its repair base; that base is
   currently associated with live auto-deployment, so its merge is a deployment
   step. Keep the original release's other outstanding readiness gates separate.
7. If rollback is needed, redeploy the prior reviewed code commit. The patch makes
   no schema change and preserves rows, so it requires no destructive data rollback.
   The previous code may again overcount inactive rows; verify before onboarding.

This patch does not certify the unrelated pending payment, two-device/offline
release checks or the separate PIN/permission-editor save workflow.
