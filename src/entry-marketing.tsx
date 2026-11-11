import React from "react";
import { renderToString } from "react-dom/server";
import MarketingApp from "./features/marketing/MarketingApp";
import LegalPage from "./features/shared/components/LegalPage";
import type { MarketingRoute } from "./features/marketing/types";
import { PUBLIC_PAGES } from "../shared/marketing-seo";

/** Public-only build renderer. No AppContext, user state, cookies, APIs or account components. */
export function renderMarketingPage(path: string) {
  if (!PUBLIC_PAGES.some((page) => page.path === path))
    throw new Error("Cannot prerender a private or unknown page");
  const noop = () => {};
  if (["/terms", "/privacy", "/refund-policy"].includes(path)) {
    return renderToString(
      <LegalPage
        page={path.slice(1) as "terms" | "privacy" | "refund-policy"}
        onBack={noop}
      />,
    );
  }
  return renderToString(
    <MarketingApp
      initialRoute={path as MarketingRoute}
      onOpenLogin={noop}
      onOpenSignup={noop}
      onOpenLegal={noop}
    />,
  );
}
