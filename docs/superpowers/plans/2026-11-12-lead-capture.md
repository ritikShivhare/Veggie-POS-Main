# Confirmed Demo Lead Capture Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this task. Steps use checkbox syntax for tracking.

**Goal:** Display demo-enquiry success only after the API confirms a saved lead, and retain an editable form on failure.

**Architecture:** Keep the existing React form and API contract. Validate HTTP status, boolean success and a nonempty server lead ID; browser storage supplies draft fields only. Add a bounded request and an in-flight guard without modifying the backend or page layout.

**Tech Stack:** React 19, TypeScript, Vitest, JSDOM, existing fetch API.

**Spec:** User request of 12 November 2026: backend-confirmed enquiry capture, a real error state on network/API failure, and no local mock success IDs. Prior analysis and mocked reproductions are in `/workspace/environment-setup/marketing-research-2026-11-12/REVISED_PLAN.md`.

## Global Constraints

- Preserve the existing frontend layout, colors, fields and success presentation; add an accessible inline error only when needed.
- No live lead submissions, production database writes, deployment, new dependencies or automatic retries.
- The existing backend awaits lead persistence before returning success; use that response as the confirmation boundary.

## Review Focus

- HTTP errors with misleading success-shaped bodies must fail closed.
- Missing/malformed confirmation, HTML responses and rejected fetches retain input.
- Cached legacy fake IDs and previously saved records must not independently produce a success screen.
- Storage failures must not invalidate a server-confirmed enquiry.
- Pending/duplicate submissions and stalled requests must not fabricate confirmation or leave the form permanently disabled.

### Task 1: Verified submission and recovery

**Files:** Modify `src/features/marketing/pages/ContactPage.tsx`; create `tests/leadCapture.test.tsx`.

**Interfaces:** Consume `POST /api/leads/walkthrough` with the existing DemoRequest; accept only a successful HTTP response with `{ success: true, lead: { id: string } }` and a nonblank ID. No new public interfaces.

- [x] Write React component regressions for rejected/malformed/pending/confirmed responses, retry, unavailable storage, cached records, duplicates and stalled requests.
- [x] Run `npm test -- tests/leadCapture.test.tsx`; confirm the relevant regressions fail against current code.
- [x] Implement guarded submission, a 15-second abort deadline, accessible failure feedback and prefill-only cache restoration.
- [x] Run the targeted regressions; require all cases to pass.
- [x] Run `npm run lint`, `npm test`, `npm run build`; require successful exit codes and investigate any failures.
- [x] Smoke-test the compiled contact page with mocked API failures and success at mobile/desktop widths. Check no uncaught exceptions, error recovery and server-ID-only confirmation.
- [x] Review the complete diff and leave a push-ready patch. Publishing is outside this request.

## Verified result

Initial regressions: 16 failed, 2 passed on original code; all 18 passed after the correction. Independent review identified misleading expired-cache text; its added regression failed before the wording was corrected. Final full suite: 72 files, 581 tests passed, including all 19 lead-capture cases. Type checking and production build passed. Ten compiled-client browser scenarios passed across desktop/mobile, with mocked APIs, zero uncaught exceptions and no live writes.

Follow-up authorization: the owner supplied the Google Search Console HTML verification tag and requested merging this fix together with that tag into main and pushing it to trigger Render deployment. The no-deployment constraint above describes the original implementation task; the follow-up explicitly authorizes this release.
