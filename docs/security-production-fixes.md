# Production security fixes

No frontend components, styling, layout or dependency declarations changed.

- Admin login requires SAAS_OWNER_PASSWORD_HASH (bcrypt) and successful email OTP delivery. Configure EMAIL_ALERT_ADDRESS, or SMTP_USER/GMAIL_USER, as the owner destination. A caller cannot choose another OTP recipient. Missing email configuration or failed delivery returns 503 and creates no session. Expired challenges cannot be revived; successful OTPs are single-use.
- Google admin sign-in returns 401 until a real identity verifier is implemented. Decoded JWT claims or client-supplied email are never accepted as identity proof. Use password plus email OTP instead.
- MASTER_VERIFICATION_CODE has no built-in fallback. Redis credentials come exclusively from environment variables; rotate the previously embedded credential if it was real. Removing it from this revision does not remove Git history.
- Production serves client assets from dist/assets and explicitly public root files. Backend bundles, source maps and missing asset paths return 404. Extensionless document deep links retain SPA rendering.
- Stripe webhooks accept /api/stripe/webhook and the existing /api/webhooks/stripe alias. Both preserve the raw request bytes before JSON parsing and require STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and a valid Stripe-Signature. Configure the matching URL in Stripe. Invoice events preserve the existing subscription plan; cancellation still downgrades it.

## Validation

Run npm run lint, npm test -- --maxWorkers=2, and npm run build. The test suite retains the original 208 tests plus regression coverage in tests/securityProduction.test.ts and tests/productionStatic.test.ts. Regression coverage includes real Stripe HMAC verification, tampering/missing-signature rejection, OTP delivery/replay/expiry, and backend/static path isolation.

The cloud verification harness additionally runs 38 mocked integration tests and 22 production HTTP smoke checks from /workspace/environment-setup/verification. External APIs remain mocked; configure and validate Supabase persistence, real email delivery and provider credentials before live deployment. Browser rendering works, but the environment's blocked Google Fonts requests, guest-session 401s and missing favicon still produce console resource errors. These checks do not claim the separate zero-console-error deployment gate has passed.
