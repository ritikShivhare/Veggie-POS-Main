# Marketing Content Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement the approved roadmap task-by-task.

**Goal:** Publish accurate single-outlet marketing, complete public product answers, six original guides and a café solution page using the current design.

**Architecture:** Reuse the current React marketing shell. Render every product/FAQ panel in HTML while retaining selection controls. Centralize typed guide data and public routes so client navigation, SSR, canonicals and sitemap stay aligned.

**Tech Stack:** React 19, TypeScript, existing Vite prerender, Vitest/JSDOM and Playwright. No added dependencies.

**Spec:** `docs/superpowers/specs/2026-11-12-marketing-content-design.md`; derived from the owner's instruction to work according to the revised plan. Builder check found no material open implementation questions.

## Global Constraints

- Preserve existing colors, fonts, layout structures, six-card resource grid and interactions.
- No changes to POS/auth/database/subscription behavior or plan prices; no live leads or transactions.
- Preserve Google verification and private noindex; use the existing public hostname.
- Publish no invented contact, operator credentials, competitor facts, guaranteed results, universal hardware support or automatic customer UPI verification.
- Owner confirmed 30-day ₹999/₹1,999 prices and existing seven-day refund terms. A real support inbox remains an external dependency.

## Review Focus

- Inactive module and FAQ answers must exist before clicks without becoming simultaneously visible.
- New nested routes must work through direct visits, native links, SPA navigation and browser Back.
- Sitemap/metadata/prerender must include the same pages without exposing private routes or removing the ownership tag.
- Guides must distinguish illustrative calculations, product functions, requirements and untested physical compatibility.
- Contact/policy wording must not promise an unavailable support inbox, automatic renewal/cancellation, bank verification or refund transfer functionality.

### Task 1: Complete initial HTML with retained interactions

**Files:** `ProductPage.tsx`, `PricingPage.tsx`; tests `marketingContentRendering.test.tsx`, `marketingContentNavigation.test.tsx`.

**Interfaces:** Tab buttons reference persistent `role=tabpanel` elements by aria-controls; FAQs reference persistent answer IDs and aria-expanded. Existing callbacks remain unchanged.

- [x] Write and run failing SSR/interaction regressions for panel presence, selected visibility and FAQ answer availability.
- [x] Render panels persistently; hide inactive ones while preserving current styles and tab/accordion state.
- [x] Run targeted tests and confirm their behavior passes.

### Task 2: Original guides and café discovery

**Files:** new `shared/marketing-guides.ts`, `GuidePage.tsx`, `CafePage.tsx`; update `types.ts`, `MarketingApp.tsx`, `ResourcesPage.tsx`, footer/solution links and `shared/marketing-seo.ts`.

**Interfaces:** Guide data supplies stable path, title, summary, category, updated date, takeaway and sections; guide reader consumes it and PLAN_LIMITS for the cost comparison. A single marketing route list is shared by the client route guard. Public metadata includes every new page. Resource cards link directly to real guide URLs.

- [x] Run existing-entry-point tests showing the seven new routes and guide links are absent on the original code.
- [x] Add complete original guide content, reusable reader, café page and typed route/catalog integration.
- [x] Replace summary modals with normal guide links using the existing card styles; point the café format/footer link to its page.
- [x] Verify direct SSR, client navigation and Back with meaningful content and correct canonical URLs.

### Task 3: Truthful editorial/policy alignment and release verification

**Files:** existing Home/About/Product/Solutions/Pricing/Contact/Resources/Footer/Legal components; implementation docs and evidence outside checkout.

- [x] Update headline/scope, QR/manual-payment distinction, hardware requirements, pricing allowances and refund-cycle copy; retain confirmed commercial terms.
- [x] Remove unverified speed, multi-outlet, field-impact, universal hardware, template-download and automatic offline-success promises. Keep resource examples explicitly illustrative.
- [x] Review copy against actual code and user-confirmed facts; keep support email and physical hardware certification outstanding rather than inventing them.
- [x] Run lint, the complete test suite, production build and compiled HTTP/browser checks for every public route, metadata, Google tag, private noindex, controls and mobile overflow.
- [x] Obtain a read-only code review, fix substantive findings with regressions, and prepare the branch for review. This phase does not create third-party listings or silently deploy the next content release.

## Verification and review result

All 13 new rendering/navigation regressions failed on the baseline and passed after implementation. Final lint, all 594 tests across 74 files and production build pass. Thirty compiled HTTP checks pass across 18 public pages and discovery/private/missing-asset cases. Fifty-six browser cases pass across desktop, mobile and JavaScript-disabled rendering, including resource links, history, filters, downloads and keyboard navigation. The Google ownership tag remains intact.

Independent review found no Critical/Important issues and identified two refinements, both addressed: keyboard focus into the active product panel and shared-catalog derivation of the guide allowance. The keyboard focus check failed before correction and passed afterward. JavaScript-disabled Chromium reports its blocked module preloads as CSP failures; these were diagnosed separately, all five referenced JS/CSS assets return HTTP 200, and no unexpected asset failures were ignored.

GitHub's REST API returns Forbidden in this environment. Native Git access is available; prepare/push the branch and provide its review URL if automated PR creation remains unavailable. The owner-created public support inbox and later roadmap dependencies remain outstanding.
