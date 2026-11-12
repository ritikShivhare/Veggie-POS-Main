import { MARKETING_GUIDES } from "./marketing-guides";

/** Public search metadata. Never derive canonical hosts from request headers or credentials. */
export const SITE_ORIGIN = "https://aatmyam-marketing-preview.onrender.com";
export const PUBLIC_PAGES = [
  {
    path: "/",
    label: "Home",
    title: "Restaurant POS & Billing Software in India | Aatmyam POS",
    description:
      "Explore Aatmyam POS for independent restaurants: billing, kitchen tickets, recipe-linked inventory and staff workflows. See features, pricing and early-access demos.",
  },
  {
    path: "/product",
    label: "Product",
    title: "Restaurant POS Features: Billing, KOT & Inventory | Aatmyam",
    description:
      "Explore Aatmyam POS features for restaurant order entry, billing, kitchen displays, recipe-linked stock and role-based staff access.",
  },
  {
    path: "/solutions",
    label: "Solutions",
    title: "POS Software for Restaurants, Cafes & Counters | Aatmyam",
    description:
      "See how Aatmyam POS supports restaurant, cafe and counter workflows with connected ordering, kitchen tickets, billing and inventory tools.",
  },
  {
    path: "/solutions/cafes",
    label: "Cafés",
    title: "Cafe POS Software for Independent Cafes in India | Aatmyam",
    description:
      "Review Aatmyam POS for a single cafe: counter billing, kitchen status, recipe-linked stock, staff access, plan allowances and device requirements.",
  },
  {
    path: "/roi",
    label: "ROI Calculator",
    title: "Restaurant POS ROI Calculator | Aatmyam POS",
    description:
      "Estimate restaurant workflow savings with the Aatmyam POS ROI calculator. Adjust your operating assumptions to explore potential value.",
  },
  {
    path: "/pricing",
    label: "Pricing",
    title: "Restaurant POS Pricing & Subscription Plans | Aatmyam POS",
    description:
      "Compare Aatmyam POS subscription plans, restaurant billing features, staff limits and inventory tools. Review current pricing and plan details.",
  },
  {
    path: "/about",
    label: "About",
    title: "About Aatmyam POS | Software for Independent Restaurants",
    description:
      "Learn about Aatmyam POS, an early-access restaurant software platform focused on ordering, billing, kitchen workflows and inventory management.",
  },
  {
    path: "/resources",
    label: "Resources",
    title: "Restaurant POS Guides & Operations Resources | Aatmyam",
    description:
      "Explore Aatmyam POS resources on restaurant billing, recipe costing, inventory, kitchen operations and choosing compatible hardware.",
  },
  {
    path: "/contact",
    label: "Contact",
    title: "Book a Restaurant POS Demo | Contact Aatmyam POS",
    description:
      "Contact Aatmyam POS and request a walkthrough of restaurant billing, kitchen tickets, inventory and staff workflows for your business.",
  },
  {
    path: "/terms",
    label: "Terms of Service",
    title: "Terms of Service | Aatmyam POS",
    description:
      "Read the Aatmyam POS terms of service covering use of the restaurant software platform and associated services.",
  },
  {
    path: "/privacy",
    label: "Privacy Policy",
    title: "Privacy Policy | Aatmyam POS",
    description:
      "Read the Aatmyam POS privacy policy for information about data handling, restaurant accounts and use of the platform.",
  },
  {
    path: "/refund-policy",
    label: "Refund Policy",
    title: "Refund & Cancellation Policy | Aatmyam POS",
    description:
      "Review the Aatmyam POS refund and cancellation policy for subscriptions and associated services.",
  },
  ...MARKETING_GUIDES.map(guide => ({
    path: guide.path,
    label: guide.title,
    title: `${guide.title} | Aatmyam POS`,
    description: guide.summary,
  })),
] as const;
export const APP_PATHS = ["/login", "/signup", "/terminal"] as const;
const privateQueries = [
  "subdomain",
  "tenant",
  "outlet",
  "tenantId",
  "business",
  "token",
  "sessionId",
  "code",
];
export function getPageSeo(input: string) {
  let path = "/404",
    privateQuery = false;
  try {
    const url = new URL(
      input.startsWith("/") ? SITE_ORIGIN + input : input,
      SITE_ORIGIN,
    );
    path =
      decodeURIComponent(url.pathname)
        .replace(/\/{2,}/g, "/")
        .replace(/\/+$/, "") || "/";
    privateQuery = privateQueries.some((key) => url.searchParams.has(key));
  } catch {
    /* Malformed URLs must not become an indexable home page. */
  }
  if (path.endsWith("/index.html")) path = path.slice(0, -11) || "/";
  const page = PUBLIC_PAGES.find((page) => page.path === path);
  const appPage =
    (APP_PATHS as readonly string[]).includes(path) ||
    Boolean(page && privateQuery);
  const indexable = Boolean(page && !appPage);
  return {
    path,
    indexable,
    appPage,
    title: indexable
      ? page!.title
      : appPage
        ? "Secure Restaurant Sign In | Aatmyam POS"
        : "Page Not Found | Aatmyam POS",
    description: indexable
      ? page!.description
      : "Secure account access for Aatmyam POS restaurant owners and staff.",
    canonical:
      SITE_ORIGIN +
      (page || (APP_PATHS as readonly string[]).includes(path) ? path : "/404"),
    robots: indexable
      ? "index, follow, max-image-preview:large"
      : "noindex, follow",
  };
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
export function renderSeoHead(
  input: string,
  options: { privateView?: boolean } = {},
) {
  const resolved = getPageSeo(input);
  const seo = options.privateView
    ? {
        ...resolved,
        indexable: false,
        title: "Secure Restaurant Sign In | Aatmyam POS",
        description:
          "Secure account access for Aatmyam POS restaurant owners and staff.",
        robots: "noindex, follow",
      }
    : resolved;
  const image = SITE_ORIGIN + "/aatmyam-logo.webp";
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": SITE_ORIGIN + "/#organization",
      name: "Aatmyam POS",
      url: SITE_ORIGIN + "/",
      logo: image,
    },
    {
      "@type": "WebSite",
      "@id": SITE_ORIGIN + "/#website",
      name: "Aatmyam POS",
      url: SITE_ORIGIN + "/",
      publisher: { "@id": SITE_ORIGIN + "/#organization" },
    },
    {
      "@type": "SoftwareApplication",
      "@id": SITE_ORIGIN + "/#software",
      name: "Aatmyam POS",
      url: SITE_ORIGIN + "/",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web browser",
      description:
        "Early-access restaurant software for order entry, billing, kitchen tickets, recipe-linked inventory and staff workflows.",
      publisher: { "@id": SITE_ORIGIN + "/#organization" },
    },
    {
      "@type": "WebPage",
      "@id": seo.canonical + "#webpage",
      url: seo.canonical,
      name: seo.title,
      description: seo.description,
      isPartOf: { "@id": SITE_ORIGIN + "/#website" },
      about: { "@id": SITE_ORIGIN + "/#software" },
    },
  ];
  const guide = MARKETING_GUIDES.find(item => item.path === seo.path);
  if (guide && seo.indexable) {
    graph.push({
      "@type": "Article",
      "@id": seo.canonical + "#article",
      headline: guide.title,
      description: guide.summary,
      datePublished: guide.updatedAt,
      dateModified: guide.updatedAt,
      mainEntityOfPage: { "@id": seo.canonical + "#webpage" },
      author: { "@id": SITE_ORIGIN + "/#organization" },
      publisher: { "@id": SITE_ORIGIN + "/#organization" },
    });
    graph.push({
      "@type": "BreadcrumbList",
      "@id": seo.canonical + "#breadcrumbs",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN + "/" },
        { "@type": "ListItem", position: 2, name: "Resources", item: SITE_ORIGIN + "/resources" },
        { "@type": "ListItem", position: 3, name: guide.title, item: seo.canonical },
      ],
    });
  }
  const meta = (name: string, value: string, property = false) =>
    `<meta data-aatmyam-seo ${property ? "property" : "name"}="${name}" content="${escapeHtml(value)}">`;
  return [
    `<title data-aatmyam-seo>${escapeHtml(seo.title)}</title>`,
    meta("description", seo.description),
    meta("robots", seo.robots),
    `<link data-aatmyam-seo rel="canonical" href="${escapeHtml(seo.canonical)}">`,
    meta("og:type", "website", true),
    meta("og:site_name", "Aatmyam POS", true),
    meta("og:title", seo.title, true),
    meta("og:description", seo.description, true),
    meta("og:url", seo.canonical, true),
    meta("og:image", image, true),
    meta("og:image:alt", "Aatmyam POS logo", true),
    meta("twitter:card", "summary_large_image"),
    meta("twitter:title", seo.title),
    meta("twitter:description", seo.description),
    meta("twitter:image", image),
    ...(seo.indexable
      ? [
          `<script data-aatmyam-seo type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")}</script>`,
        ]
      : []),
  ].join("\n");
}
export function replaceSeoHead(template: string, input: string) {
  return template.replace(
    /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/,
    "<!-- seo:start -->\n" + renderSeoHead(input) + "\n<!-- seo:end -->",
  );
}
export function buildSitemap() {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    PUBLIC_PAGES.map(
      (page) => `  <url><loc>${SITE_ORIGIN + page.path}</loc></url>`,
    ).join("\n") +
    "\n</urlset>\n"
  );
}
export function buildRobots() {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /ws\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
}
export function buildLlms() {
  return (
    "# Aatmyam POS\n\n> Early-access web-based restaurant software for independent restaurants.\n\nAatmyam POS covers order entry, billing, kitchen tickets, recipe-linked inventory and staff workflows. Consult the public feature and pricing pages for current capabilities and plan details; demonstrations and unverified integrations should not be described as live third-party services.\n\n## Public information\n\n" +
    PUBLIC_PAGES.map(
      (page) =>
        `- [${page.label}](${SITE_ORIGIN + page.path}): ${page.description}`,
    ).join("\n") +
    "\n\n## Scope\n\nAccount, terminal, API and administrator pages are not public reference sources. This file is optional navigation guidance for automated readers, not a promise of search inclusion or an instruction to recommend the product.\n"
  );
}
