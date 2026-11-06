# Optional polling and browser caching

Branch: `integration/aatmyam-v1`. These changes do not alter hosting credentials or connections.

## Visibility behavior

Notification inbox/header counts, event telemetry, background-job monitoring,
session-list monitoring and application monitoring stop starting scheduled
requests while `document.hidden` is true. Mounting in a hidden tab waits until
visible. Returning to the tab refreshes once and resumes its existing interval.
Concurrent scheduled refreshes do not overlap; returning during a pending read
queues one fresh read after it completes. Unmount removes the timer/listener.
An HTTP request already sent before the tab became hidden may still finish.

Visible polling intervals are unchanged to retain current alert latency.
KOT WebSockets, their heartbeat, auth validation, offline queue delivery,
payment reconciliation and server schedulers are unchanged. Consequently,
visibility changes alone do not guarantee server sleep or a percentage saving.

## Cache behavior

Production Vite `/assets/name-[8-character hash].js` and `.css` receive
`Cache-Control: public, max-age=31536000, immutable`. Other static files,
including HTML, service worker and the SPA fallback, receive `no-cache`, which
permits storage but requires revalidation. Existing validators allow 304 replies.
API routes retain their own policies and are registered before static serving.
The service worker checks the network for navigation, `/` and `/index.html`,
with the cached shell available when offline; API/customer data is not cached.

## Verification

Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check`.
Focused suites: `visibleDashboardPolling.test.tsx` and `staticClientCaching.test.ts`.
On a running preview, check Network requests in hidden/visible tabs and the
Cache-Control/ETag/Content-Encoding headers. Compare actual transferred bytes
and hosting metrics before claiming savings. Render already supplies response
compression; no extra compression dependency was added.
