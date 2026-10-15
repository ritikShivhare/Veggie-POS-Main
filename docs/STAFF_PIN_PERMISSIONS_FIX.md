# Explicit staff PIN and permission saves

This scoped extension is on `fix/active-staff-capacity`, alongside the active-seat
fix in PR #2. It is based on the unmerged repair branch, not the older main/AI
Studio snapshot. No production records or credentials are modified by preparing
this code. No database migration is required.

## Findings

The referenced screenshots show a sync request rejected with HTTP 400, a sync
read timeout, and a settings version conflict. The staff editor changed global
staff state on every PIN digit/checkbox click. The shared management auto-save then
included staff and settings, submitting incomplete PINs and racing polled versions.
This was not an intentional Save interaction. The old editor also removed staff
locally before any server-confirmed deactivation.

## Exact files and behavior

- `src/features/staff/StaffAccessEditor.tsx`: new per-member editor. Blank masked
  new-PIN input, local drafts, explicit Save, complete 4–6 digit validation, leading
  zero preservation, and a versioned `PUT /api/staff/:id`. Permission-only edits
  omit PIN entirely. No draft PIN is put in shared state, sync, offline cache or logs.
- `src/features/shared/components/SettingsPanel.tsx`: replaces the immediate-write
  staff controls with the new editor. Functional staff-list updates prevent one
  member's response overwriting another's response. Keying by restaurant and
  ignoring unmounted-row results prevent a late response updating a different tenant.
- `src/features/shared/hooks/useSyncState.ts`: staff is excluded from the automatic
  management-save payload; staff creation/deactivation already use their endpoints.
  Menu/inventory/settings behavior remains on its existing path.
- `routes/pos.routes.ts`: access changes require a version; validation, staff update
  and targeted session revocation share one tenant transaction. Stale versions are
  rejected. Empty/incomplete PIN mutations fail. Duplicate active PINs are rejected
  on update. Owner demotion/deactivation or permission removal is rejected. Responses
  contain the safe canonical record, never PIN/hash fields.
- `server/features/shared/security.ts`: safe staff responses include the legacy
  default version 1 so a previously unversioned record can be edited safely.

Before:

```tsx
onChange={event => setStaffList(staffList.map(staff =>
  staff.id === id ? {...staff, pin: event.target.value} : staff
))}
// The shared /sync effect later submits this partial PIN automatically.
```

After:

```tsx
// Input changes only the row's local draft.
onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
// Explicit Save submits only the selected staff record and expected version.
body: JSON.stringify({version, ...(pin ? {pin} : {}), permissions})
```

The real component additionally protects Owner permissions and omits permissions
from Owner PIN updates. Blank PIN means retain the existing credential. A failed
request preserves drafts and shows an error, not success. A 409 does not silently
retry or overwrite newer data: select Load latest record, review the latest
permissions, and enter changes again. Loading latest deliberately clears the local
new-PIN draft, with an explicit review/re-entry message.

Only sessions belonging to the changed staff member are revoked, including their
WebSocket connections through the existing session event mechanism. Editing other
staff does not revoke Owner sessions. Saving one's own PIN intentionally requires
sign-in again; Owner permissions cannot be removed through this editor. This is a
security requirement, not the previous unexpected per-keystroke refresh.

## Verification and deployment

Final local result: **297 tests / 31 files passed**, TypeScript passed, production
client/server build passed, and diff checks passed. The focused extension adds eight
regressions beyond the staff-capacity checkpoint. No live deployment was performed.

Regression tests render the real editor and exercise local HTTP endpoints:
- Partial digits never send, and a complete leading-zero PIN saves once on click.
- Permission-only update sends no PIN; failed saves preserve drafts and show errors.
- 409 requires explicit reload/review and never auto-retries.
- Owner permission controls are protected; own PIN saves trigger intentional logout.
- Three independent staff updates revoke target sessions while Owner stays logged in.
- Incomplete PINs, stale versions and Owner permission removal are rejected.
- Staff state changes never enter the automatic sync payload.

Run `npm run lint`, `npm test`, `npm run build` and `git diff --check` on the final
reviewed commit. Existing onboarding, capacity, tenant-boundary and payment tests
must remain green.

Deploy the complete branch to a preview/test service first. Use user-controlled
test credentials to update three different staff PINs/permissions, one at a time,
with the Save buttons. Verify the Owner stays logged in while editing others,
changed staff must sign in again, permissions are enforced, two-device stale edits
return a reviewable conflict, and another restaurant remains unaffected. Verify
that only an explicit own-PIN save signs out the Owner. Do not clear pending offline
commands, reset PINs automatically, or copy an old AI Studio export over this branch.

PR #2 targets `fix/aatmyam-deployment`; merging into it can trigger live deployment.
Do not merge it solely because unit tests pass. Existing release gates remain.
The general settings autosave path and infrastructure read timeouts are separate
from this staff-editor repair; this change does not claim to resolve every settings
revision conflict or hosting/network delay.

## Deployment diagnostic follow-up

The production build succeeded but the provider Data API returned HTTP 504 /
PGRST003 during the startup schema check. A direct administrator SQL query can
succeed while the PostgREST API connection pool is unavailable. Do not replay
already-applied migrations based only on this transport error.

`server-startup-validation.ts` now distinguishes pool/network/permission failures
from a missing schema-version RPC and an actually old/invalid schema. It remains
fail-closed: API unavailability never skips readiness checks or enables an
in-memory production fallback. `tests/startupDatabaseReadiness.test.ts` covers
these cases without exposing provider error text. Updated local validation:
305 tests across 32 files, TypeScript and production build passed.

This diagnostic change does not repair a provider connection pool by itself.
Restore Data API availability, then verify the exact deployed commit and health.
