// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.aatmyampos.in/"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_CONSENT_KEY, createWebsiteAnalytics, getAnalyticsPage } from "../src/features/marketing/websiteAnalytics";
import { WEBSITE_MEASUREMENT_ID } from "../shared/websiteAnalyticsConfig";

let analytics: ReturnType<typeof createWebsiteAnalytics>;
const browser = window as unknown as Record<string, any>;
const commands = () => (browser.dataLayer || []).map((item: IArguments) => Array.from(item));
const views = () => commands().filter((item: unknown[]) => item[0] === "event" && item[1] === "page_view");
const script = () => document.querySelector<HTMLScriptElement>("#aatmyam-website-google-tag");
beforeEach(() => {
  localStorage.clear();
  document.head.querySelectorAll("#aatmyam-website-google-tag").forEach(node => node.remove());
  delete browser.dataLayer; delete browser.gtag;
  history.replaceState({}, "", "/");
  analytics = createWebsiteAnalytics(window);
});
afterEach(() => { vi.restoreAllMocks(); analytics.dispose(); });

describe("Website visit statistics", () => {
  it("sends nothing and loads no Google script before consent or before guest/session readiness", () => {
    analytics.setScopeAllowed(true);
    expect(script()).toBeNull(); expect(views()).toHaveLength(0);
    analytics.setScopeAllowed(false); analytics.choose("granted");
    expect(script()).toBeNull();
    analytics.setScopeAllowed(true);
    expect(script()?.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${WEBSITE_MEASUREMENT_ID}`);
    expect(commands()).toContainEqual(["set", "send_page_view", false]);
    expect(views()).toHaveLength(0);
  });
  it("respects refusal and allows changing it later", () => {
    analytics.setScopeAllowed(true); analytics.choose("denied");
    expect(script()).toBeNull(); expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("denied");
    analytics.choose("granted"); script()!.dispatchEvent(new Event("load"));
    expect(views()).toHaveLength(1);
    analytics.choose("denied"); analytics.syncPage();
    expect(browser[`ga-disable-${WEBSITE_MEASUREMENT_ID}`]).toBe(true);
    expect(views()).toHaveLength(1);
  });
  it("deduplicates render effects and sends public SPA views after guarded navigation", () => {
    analytics.installNavigationGuards(); analytics.setScopeAllowed(true); analytics.choose("granted"); script()!.dispatchEvent(new Event("load"));
    analytics.syncPage(); analytics.setScopeAllowed(true);
    expect(views()).toHaveLength(1);
    history.pushState({}, "", "/pricing");
    expect(browser[`ga-disable-${WEBSITE_MEASUREMENT_ID}`]).toBe(true);
    analytics.syncPage();
    expect(views()).toHaveLength(2);
    expect(views()[1][2].page_location).toBe("https://www.aatmyampos.in/pricing");
    expect(commands().filter((x: unknown[]) => x[0] === "config").every((x: any[]) => x[2].send_page_view === false)).toBe(true);
  });
  it("blocks private navigation before Google's automatic history listener can observe it", () => {
    analytics.installNavigationGuards(); analytics.setScopeAllowed(true); analytics.choose("granted"); script()!.dispatchEvent(new Event("load"));
    const guardedPush = history.pushState;
    const googleHistoryListener = vi.fn(() => browser[`ga-disable-${WEBSITE_MEASUREMENT_ID}`]);
    vi.spyOn(history, "pushState").mockImplementation(function (...args) { guardedPush.apply(history, args); googleHistoryListener(); });
    history.pushState({}, "", "/terminal?tenant=synthetic&token=private");
    expect(googleHistoryListener).toHaveLastReturnedWith(true);
    analytics.setScopeAllowed(false); analytics.syncPage();
    expect(views()).toHaveLength(1);
    expect(JSON.stringify(commands())).not.toContain("synthetic");
    expect(JSON.stringify(commands())).not.toContain("private");
  });
  it("does not queue a page view if a session becomes private while the Google script is loading", () => {
    analytics.setScopeAllowed(true); analytics.choose("granted");
    history.pushState({}, "", "/login?token=private"); analytics.setScopeAllowed(false);
    script()!.dispatchEvent(new Event("load"));
    expect(views()).toHaveLength(0);
    expect(browser[`ga-disable-${WEBSITE_MEASUREMENT_ID}`]).toBe(true);
  });
  it("keeps safe email/WhatsApp campaign labels when consent is granted on a later public page", () => {
    analytics.dispose(); history.replaceState({}, "", "/?utm_source=whatsapp&utm_medium=social&utm_campaign=restaurant_outreach");
    analytics = createWebsiteAnalytics(window); analytics.setScopeAllowed(true);
    history.pushState({}, "", "/product"); analytics.choose("granted"); script()!.dispatchEvent(new Event("load"));
    const config = commands().find((x: unknown[]) => x[0] === "config");
    expect(config[2]).toMatchObject({ campaign_source: "whatsapp", campaign_medium: "social", campaign_name: "restaurant_outreach", page_location: "https://www.aatmyampos.in/product?utm_source=whatsapp&utm_medium=social&utm_campaign=restaurant_outreach" });
    analytics.syncPage(); expect(views()).toHaveLength(1);
    expect(JSON.stringify(commands())).not.toMatch(/user_id|user_properties|phone|email_address|pin/);
  });
  it("honours browser privacy opt-out", () => {
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, get: () => undefined });
    vi.spyOn(navigator, "doNotTrack", "get").mockReturnValue("1");
    analytics.setScopeAllowed(true); analytics.choose("granted");
    expect(script()).toBeNull();
  });
  it("does not break the website when preference storage or Google's script fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => analytics.choose("granted")).not.toThrow(); expect(script()).toBeNull();
    vi.restoreAllMocks(); analytics.choose("granted"); analytics.setScopeAllowed(true);
    script()!.dispatchEvent(new Event("error"));
    expect(script()).toBeNull(); expect(views()).toHaveLength(0);
  });
});

describe("Analytics address filtering", () => {
  it.each([
    "/login", "/signup", "/terminal", "/?tenant=private", "/?token=private", "/?email=person@example.com", "/?code=secret", "/#access_token=private", "/?utm_source=person@example.com", "/?utm_source=whatsapp&utm_source=person@example.com", "/unknown", "/api/health",
  ])("excludes accounts, private queries and unknown pages: %s", path => {
    expect(getAnalyticsPage("https://www.aatmyampos.in" + path)).toBeNull();
  });
  it("uses only public page titles and safe campaign labels on either hostname", () => {
    expect(getAnalyticsPage("https://aatmyam-marketing-preview.onrender.com/pricing?utm_source=email&utm_medium=email&utm_campaign=november")).toMatchObject({ location: "https://aatmyam-marketing-preview.onrender.com/pricing?utm_source=email&utm_medium=email&utm_campaign=november" });
    expect(getAnalyticsPage("https://unrelated.example/")).toBeNull();
  });
});
