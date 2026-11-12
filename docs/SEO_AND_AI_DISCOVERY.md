# Aatmyam POS search and AI discovery

Public origin: https://aatmyam-marketing-preview.onrender.com. The owner explicitly chose this hostname as the public website. Main contains the Aatmyam application and search discovery baseline. The marketing content phase adds café and guide destinations through the same public route catalog. Sitemap submission was reported complete by the owner; Google indexing/performance metrics require Search Console evidence.

## What changes

- Marketing/legal components are rendered at build time for 18 public routes, including a café solution page and six complete guides. The current design is retained; ordinary navigation remains client-side.
- Real links support discovery, direct visits, new tabs, modifier clicks, browser Back/Forward and JavaScript-disabled browsing.
- Each public page has its own title, description, canonical URL, social metadata and truthful Organization/WebSite/SoftwareApplication/WebPage structured data. No ratings, reviews or unverified business claims are fabricated.
- Login, signup, terminal and account-oriented query variants receive an empty application shell with noindex metadata and an X-Robots-Tag. Private views displayed at / after authentication/signup also switch to noindex client metadata. Unknown pages/assets and source maps return real404s.
- robots.txt, sitemap.xml and llms.txt are generated from the same public route catalog. APIs/account URLs are excluded from the sitemap. Login pages remain crawlable so compliant crawlers can read their noindex instruction; robots.txt is not an authorization mechanism.
- llms.txt is a factual navigation summary for automated readers. It is optional guidance, not an established ranking requirement or a guarantee that any AI system will recommend/cite the site. Six resource cards now link to full guides at stable public URLs, with original examples, updated dates, related links and accurate article/breadcrumb data. A recipe-cost CSV is available as a normal static download.

## Build and configuration

Use the existing supported Node version and `npm ci --include=dev`, then `npm run build`. The build now runs Vite, renders the public components through a separate SSR build, emits documents/crawler files, and bundles the backend. No dependencies or lockfile changes are required.

Client assets/documents remain in dist/client. The generic authenticated shell is dist/server-shell.html and the SSR build is dist/ssr; neither is publicly served. Hashed assets retain immutable caching. Documents, crawler files and service worker retain revalidation. The service worker never caches API responses or user data; navigation remains network-first.

The origin and public descriptions are maintained in shared/marketing-seo.ts; original guide content and its metadata are maintained in shared/marketing-guides.ts. Café and guide routes are included in the client route guard and prerender catalog. Important product/FAQ answers remain in the response HTML while their current selection controls choose the visible panel. If the owner later moves to a custom hostname, change that one source, rebuild and arrange permanent redirects from the old public site. Do not index multiple hostnames with conflicting canonical URLs.

## After merge and authorized deployment

1. Confirm the deployed commit and database readiness through /api/health. This PR does not resolve a Render service pinned to an older commit or apply Supabase migrations.
2. Fetch /, /product, /pricing and /contact without JavaScript. Confirm real page content, one correct canonical/title and valid JSON-LD. Check /robots.txt is text and /sitemap.xml is XML, and unknown paths return404.
3. Retain the owner-supplied Google verification meta tag in index.html, outside the dynamically replaced SEO block. Confirm it remains in the live homepage head after a deployment. The selected Search Console **URL-prefix** property is https://aatmyam-marketing-preview.onrender.com/.
4. The owner reported sitemap submission complete. The same sitemap URL automatically includes new public pages after an authorized release. Inspect the homepage/product/pricing and new content URLs and record Google coverage, query and performance exports as available. Review mobile performance using Lighthouse and real-user data; build/browser checks do not establish a ranking position.
5. Publish accurate, useful product documentation, pricing, limitations, contact/organization information and original restaurant guides. Seek legitimate mentions and references; keep factual claims consistent across the website and external profiles. These ongoing editorial/authority factors are outside a technical PR.

Search and AI discovery require accessible, indexable and useful content. Ranking, indexing timelines and AI citations are controlled by the respective systems; structured data, robots access and llms.txt do not guarantee inclusion.

## Verification

Run `npm run lint`, `npm test`, and `npm run build`. Regression tests cover server-rendered content, private state/queries and generated index aliases, canonical normalization, metadata updates, modifier-click links, static404/HEAD behavior and cache revalidation. Build checks use the actual public React components, not placeholder marketing text.

Current content QA checks all 18 public pages at desktop/mobile widths and with JavaScript disabled, plus product/FAQ controls, guide navigation/back, resource filters, CSV download, metadata and private/noindex behavior. API responses are explicitly mocked; no live PIN, payment, customer or email data is changed. Expected anonymous-session401 responses and browser-enforced JavaScript-disabled preload blocks are distinguished from uncaught exceptions or missing assets. A real public support inbox and physical device/printer verification remain owner/operational dependencies.
