# Marketing clarity and original guides

The owner reported sitemap submission complete and instructed us to continue the revised marketing plan. The previous release e81b520 is live with Google verification and the confirmed-enquiry fix. This phase implements the next independent editorial and discovery work for Indian independent restaurants and cafés.

## Scope

- Keep existing page layout, colors, typography, card grid and tab/accordion presentation. Update text to describe current single-outlet, early-access software accurately.
- Explain configured amount-specific UPI QR generation separately from staff-recorded customer payments and backend-verified Cashfree subscription payments. No automatic customer bank reconciliation, savings, speed or universal hardware claims.
- Keep all five product descriptions and every pricing FAQ answer in initial HTML. Existing tabs/accordions still choose the visible content; use accessible controls.
- Make the six resource cards lead to six complete, original guides through normal links; preserve the six-card layout. One guide covers the approved cost/hardware checklist. Add a substantive café solution page. All new pages use the existing site's visual language, share navigation, work without JavaScript, and receive generated metadata, canonicals and sitemap entries.
- Use illustrative inputs explicitly for original recipe-cost calculations. Use PLAN_LIMITS for plan prices/allowances instead of introducing another pricing source. Reading times reflect actual content.
- Publish only confirmed business facts. The owner confirmed ₹999/₹1,999 per 30 days and a seven-day refund-request window with approved refunds processed in 5–7 business days. No support inbox or business phone exists yet; do not invent one or present demo leads as support tickets. Business email setup advice has been given; keep that dependency visible.

## Agreed approach and implementation choices

The approved roadmap calls for accurate copy and crawlable public information before new conversion experiments. Reuse existing React components and styles, centralize guide data, add a reusable guide reader, and extend the existing public-route catalog. Avoid a new CMS, UI redesign, duplicate topic URLs, dependency changes, and changes to POS/auth/database/billing behavior.

Implementer choices: six guide URLs preserve the six existing topic cards, including `/resources/restaurant-pos-cost-guide`; the café URL is `/solutions/cafes`. The existing main navigation remains unchanged; existing relevant cards/footer links provide discovery. Update client route recognition, SSR and metadata together so direct visits and browser navigation agree.

## New public pages

- `/solutions/cafes`
- `/resources/restaurant-food-cost-calculation`
- `/resources/restaurant-order-payment-workflow`
- `/resources/restaurant-staff-access-checklist`
- `/resources/restaurant-pos-cost-guide`
- `/resources/single-outlet-setup-checklist`
- `/resources/kot-vs-kds`

## Validation

Exercise actual React rendering and interaction: all module/FAQ content present before interaction, selected panels accessible, resource navigation/deep visits/Back supported, new URLs served as public HTML with correct metadata and canonical, private paths still noindex, Google ownership tag retained, no layout overflow at mobile/desktop widths, and no uncaught browser exceptions. Run lint, full tests and production build.

## Remaining roadmap dependencies

Owner-created working support email/operator details; Search Console exports for actual indexing/query/performance baselines; physical device/printer tests; a separately scoped real-product recording; permitted live competitor research and source-based comparisons; eligible owner-controlled external profiles. Do not describe these as completed or fabricate their evidence. No new analytics, public sandbox, sticky CTA, WhatsApp service or third-party listing is created in this phase.
