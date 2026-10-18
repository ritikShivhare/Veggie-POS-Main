import {PLAN_LIMITS as backendPlans} from '../server/features/shared/subscription';
import {PLAN_LIMITS} from '../shared/planCatalog';
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("marketing claims and pricing", () => {
  it("uses the same plan catalog as the app subscription logic", () => {
    const pricingPage = read("../src/features/marketing/pages/PricingPage.tsx");
    const subscription = read("../server/features/shared/subscription.ts");
    const catalog = read("../shared/planCatalog.ts");

    expect(pricingPage).toContain("from \"../../../../shared/planCatalog\"");
    expect(pricingPage).toContain("PLAN_LIMITS");
    expect(backendPlans).toBe(PLAN_LIMITS);
    expect(catalog).toContain('price: 999');
    expect(catalog).toContain('price: 1999');
    expect(pricingPage).not.toMatch(/annualBilling|annualPrice|Save 20%/);
    expect(pricingPage).not.toMatch(/monthlyPrice:\s*(1999|3499)/);
  });

  it("does not publish unverified performance or service guarantees", () => {
    const pages = [
      "../src/features/marketing/components/MarketingFooter.tsx",
      "../src/features/marketing/pages/HomePage.tsx",
      "../src/features/marketing/pages/ContactPage.tsx",
      "../src/features/marketing/pages/AboutPage.tsx",
      "../src/features/marketing/pages/ProductPage.tsx",
      "../src/features/marketing/pages/SolutionsPage.tsx",
      "../src/features/marketing/pages/ResourcesPage.tsx",
      "../src/features/marketing/pages/RoiPage.tsx",
    ].map(read).join("\n");

    for (const claim of [
      "SOC-2",
      "99.8% order fulfillment accuracy",
      "99.98%",
      "99.2% Stock Precision",
      "100% KOT to Kitchen accuracy",
      "Sub-50ms sync latency",
      "sub-100ms response times",
      "Avg Punch Time: 6.8s",
      "Pantry Accuracy: 99.4%",
      "Drawer Variance: Rs. 0.00",
      "Margin Health: 68.2%",
      "Typical payback on leakage",
      "8 seconds. Bill state locked",
      "Diner scans & pays in 4 seconds",
      "Response guaranteed within 2 hours",
      "48-HOUR ONBOARDING GUARANTEE",
      "3-5% of monthly ingredient shrinkage",
      "35% faster counter throughput",
      "14 min faster table turnover",
      "Zero morning rush stockouts",
      "100% order fulfillment accuracy",
      "5-20 location restaurant groups",
      "Multi-Outlet Chains & Growing Groups",
      "Actual figures are validated against your outlet's historic P&L",
      "operations@veggiepos.com",
      "+91 98765 43210 (Direct WhatsApp Desk)",
    ]) {
      expect(pages).not.toContain(claim);
    }
  });
});
