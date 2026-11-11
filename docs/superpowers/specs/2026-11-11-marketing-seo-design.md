# Aatmyam marketing SEO and AI discovery

User authorized implementation and a PR, preserving visual design, with https://aatmyam-marketing-preview.onrender.com as the permanent public origin. Base: integration/aatmyam-v1 at 2cdbfe860872. No deployment, database changes or authentication redesign.

Use build-time rendering of the existing marketing/legal components. Compared with metadata-only CSR this exposes real page content without JavaScript; compared with runtime SSR it avoids new server rendering overhead and isolates the authenticated app. Existing client behavior and styling remain. Semantic anchor navigation must support normal clicks, modifier clicks and direct deep links.

A shared route catalog owns unique titles/descriptions, canonical URLs and truthful Organization/WebSite/SoftwareApplication/WebPage JSON-LD. It provides head HTML at build/HTTP time and updates metadata during SPA navigation. Public marketing and legal routes are rendered; login/signup/terminal/admin or session-oriented query variants use a noindex application shell. Nonexistent pages/assets/maps return404, and HEAD agrees with GET. No bot-specific cloaking or fabricated ratings/claims.

Generate robots.txt, sitemap.xml, a logo-based social image URL and a factual llms.txt with public links. llms.txt is optional agent guidance, not a ranking standard or promise of AI citations. Preserve robots access so crawlers can see private-page noindex directives; never include APIs or auth URLs in the sitemap. Search Console ownership/submission remain user actions after merge/deployment.

Validate real rendered HTML, route/status/cache behavior, client navigation and metadata, with and without JavaScript. Compare desktop/mobile screenshots against the base branch using identical browser conditions and stubbed unauthenticated APIs. Run lint, all tests and build; independent final review before preparing the PR.
