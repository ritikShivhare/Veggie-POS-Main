# Aatmyam POS search and AI discovery

Public origin: https://aatmyam-marketing-preview.onrender.com. The owner explicitly chose this hostname as the public website. The PR targets integration/aatmyam-v1, not the older main branch. It does not deploy the site or submit anything to a search service.

## What changes

- Existing marketing/legal components are rendered at build time for 11 public routes. Their visible copy, CSS classes and layout stay the same; ordinary navigation remains client-side.
- Real links support discovery, direct visits, new tabs, modifier clicks, browser Back/Forward and JavaScript-disabled browsing.
- Each public page has its own title, description, canonical URL, social metadata and truthful Organization/WebSite/SoftwareApplication/WebPage structured data. No ratings, reviews or unverified business claims are fabricated.
- Login, signup, terminal and account-oriented query variants receive an empty application shell with noindex metadata and an X-Robots-Tag. Private views displayed at / after authentication/signup also switch to noindex client metadata. Unknown pages/assets and source maps return real404s.
- robots.txt, sitemap.xml and llms.txt are generated from the same public route catalog. APIs/account URLs are excluded from the sitemap. Login pages remain crawlable so compliant crawlers can read their noindex instruction; robots.txt is not an authorization mechanism.
- llms.txt is a factual navigation summary for automated readers. It is optional guidance, not an established ranking requirement or a guarantee that any AI system will recommend/cite the site. Existing resource summaries are public; modal-only full guides are not separate search landing pages.

## Build and configuration

Use the existing supported Node version and `npm ci --include=dev`, then `npm run build`. The build now runs Vite, renders the public components through a separate SSR build, emits documents/crawler files, and bundles the backend. No dependencies or lockfile changes are required.

Client assets/documents remain in dist/client. The generic authenticated shell is dist/server-shell.html and the SSR build is dist/ssr; neither is publicly served. Hashed assets retain immutable caching. Documents, crawler files and service worker retain revalidation. The service worker never caches API responses or user data; navigation remains network-first.

The origin and public descriptions are maintained in shared/marketing-seo.ts. If the owner later moves to a custom hostname, change that one source, rebuild and arrange permanent redirects from the old public site. Do not index multiple hostnames with conflicting canonical URLs.

## After merge and authorized deployment

1. Confirm the deployed commit and database readiness through /api/health. This PR does not resolve a Render service pinned to an older commit or apply Supabase migrations.
2. Fetch /, /product, /pricing and /contact without JavaScript. Confirm real page content, one correct canonical/title and valid JSON-LD. Check /robots.txt is text and /sitemap.xml is XML, and unknown paths return404.
3. Verify a Google Search Console **URL-prefix** property for https://aatmyam-marketing-preview.onrender.com/. Use an ownership-verification method offered by Search Console; an HTML verification file may be placed in public/ when supplied by the verified site owner. No verification code or account credentials are invented here.
4. Submit https://aatmyam-marketing-preview.onrender.com/sitemap.xml, inspect the homepage/product/pricing URLs and monitor coverage. Review mobile performance using Lighthouse and real-user Search Console data. No SEO score or ranking position is inferred from a passing build.
5. Publish accurate, useful product documentation, pricing, limitations, contact/organization information and original restaurant guides. Seek legitimate mentions and references; keep factual claims consistent across the website and external profiles. These ongoing editorial/authority factors are outside a technical PR.

Search and AI discovery require accessible, indexable and useful content. Ranking, indexing timelines and AI citations are controlled by the respective systems; structured data, robots access and llms.txt do not guarantee inclusion.

## Verification

Run `npm run lint`, `npm test`, and `npm run build`. Regression tests cover server-rendered content, private state/queries and generated index aliases, canonical normalization, metadata updates, modifier-click links, static404/HEAD behavior and cache revalidation. Build checks use the actual public React components, not placeholder marketing text.

Cloud QA additionally compares the built client against the original integration commit at desktop/mobile widths, tests all public routes with JavaScript disabled, and exercises pricing/back/login/private-session metadata. API responses in local visual tests are explicitly stubbed; no live PIN, payment, customer or email data is changed. Existing anonymous session-check401 console messages are separate from uncaught runtime exceptions and remain outside this SEO change.
