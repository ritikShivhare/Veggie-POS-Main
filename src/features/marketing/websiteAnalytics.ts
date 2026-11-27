import { getPageSeo } from "../../../shared/marketing-seo";
import { GOOGLE_TAG_ORIGIN, WEBSITE_ANALYTICS_HOSTS, WEBSITE_MEASUREMENT_ID } from "../../../shared/websiteAnalyticsConfig";

export const ANALYTICS_CONSENT_KEY = "aatmyam_website_statistics_v1";
export const WEBSITE_NAVIGATION_EVENT = "aatmyam:website-navigation";
export type StatisticsChoice = "granted" | "denied" | null;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
const campaignKeys = new Set(["utm_source", "utm_medium", "utm_campaign"]);

/** A public page's address, never a restaurant record, query token or arbitrary referrer path. */
export function getAnalyticsPage(address: string) {
  try {
    const url = new URL(address);
    if (url.protocol !== "https:" || !WEBSITE_ANALYTICS_HOSTS.includes(url.hostname) || url.hash || url.username || url.password) return null;
    for (const key of url.searchParams.keys()) if (!campaignKeys.has(key)) return null;
    const seo = getPageSeo(url.pathname);
    if (!seo.indexable) return null;
    const location = new URL(seo.path, url.origin);
    for (const key of campaignKeys) {
      const value = url.searchParams.get(key);
      // Campaign labels, not email addresses, phone numbers, customer names or free text.
      if (url.searchParams.getAll(key).length > 1 || (value !== null && !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(value))) return null;
      if (value) location.searchParams.set(key, value);
    }
    return { location: location.href, title: seo.title };
  } catch {
    return null;
  }
}

export function createWebsiteAnalytics(win: Window, measurementId = WEBSITE_MEASUREMENT_ID) {
  const browser = win as AnalyticsWindow;
  const disabledKey = `ga-disable-${measurementId}`;
  const flags = browser as unknown as Record<string, unknown>;
  let scopeAllowed = false, loaded = false, configured = false, navigationInstalled = false;
  let script: HTMLScriptElement | null = null;
  let lastLocation = "", previousPage = "";
  const landing = getAnalyticsPage(win.location.href);
  const campaign = landing ? new URL(landing.location).searchParams : new URLSearchParams();
  const campaignParameters = Object.fromEntries([
    ["campaign_source", campaign.get("utm_source")],
    ["campaign_medium", campaign.get("utm_medium")],
    ["campaign_name", campaign.get("utm_campaign")],
  ].filter(([, value]) => Boolean(value)));
  const navigationCleanups: (() => void)[] = [];
  const block = () => { flags[disabledKey] = true; };
  block();

  const readChoice = (): StatisticsChoice => {
    try {
      const value = win.localStorage.getItem(ANALYTICS_CONSENT_KEY);
      return value === "granted" || value === "denied" ? value : null;
    } catch { return null; }
  };
  const browserOptOut = () => {
    const nav = win.navigator as Navigator & { globalPrivacyControl?: boolean };
    return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
  };
  function command(..._args: unknown[]) {
    browser.dataLayer ||= [];
    browser.dataLayer.push(arguments);
  }
  const referrer = () => {
    if (previousPage) return new URL(previousPage).origin + new URL(previousPage).pathname;
    try { return win.document.referrer ? new URL(win.document.referrer).origin + "/" : ""; }
    catch { return ""; }
  };
  function syncPage() {
    const page = getAnalyticsPage(win.location.href);
    if (!scopeAllowed || readChoice() !== "granted" || browserOptOut() || !page) { block(); return; }
    if (!loaded) {
      if (script) return;
      browser.gtag = command;
      command("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      script = win.document.createElement("script");
      script.id = "aatmyam-website-google-tag";
      script.async = true;
      script.referrerPolicy = "origin";
      script.src = `${GOOGLE_TAG_ORIGIN}/gtag/js?id=${encodeURIComponent(measurementId)}`;
      script.onload = () => { loaded = true; syncPage(); };
      script.onerror = () => { block(); script?.remove(); script = null; };
      win.document.head.append(script);
      return;
    }
    flags[disabledKey] = false;
    if (lastLocation === page.location) return;
    if (!configured) { command("js", new Date()); configured = true; }
    command("consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    const parameters = { page_location: page.location, page_title: page.title, page_referrer: referrer() };
    command("config", measurementId, { ...parameters, ...campaignParameters, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    command("event", "page_view", { ...parameters, send_to: measurementId });
    lastLocation = page.location;
    previousPage = page.location;
  }

  /** Block Google's automatic history events before a URL can become a private app route. */
  function installNavigationGuards() {
    if (navigationInstalled) return;
    navigationInstalled = true;
    for (const method of ["pushState", "replaceState"] as const) {
      const original = win.history[method].bind(win.history);
      const guarded = (...args: Parameters<History[typeof method]>) => {
        block();
        original(...args);
        win.dispatchEvent(new Event(WEBSITE_NAVIGATION_EVENT));
      };
      win.history[method] = guarded;
      navigationCleanups.push(() => { if (win.history[method] === guarded) win.history[method] = original; });
    }
    const onPopState = () => { block(); win.dispatchEvent(new Event(WEBSITE_NAVIGATION_EVENT)); };
    win.addEventListener("popstate", onPopState);
    win.addEventListener("hashchange", onPopState);
    navigationCleanups.push(() => win.removeEventListener("popstate", onPopState));
    navigationCleanups.push(() => win.removeEventListener("hashchange", onPopState));
  }

  return {
    readChoice, browserOptOut, syncPage, installNavigationGuards,
    dispose() { scopeAllowed = false; block(); navigationCleanups.splice(0).forEach(cleanup => cleanup()); },
    setScopeAllowed(allowed: boolean) {
      scopeAllowed = allowed;
      if (!allowed) { block(); lastLocation = ""; previousPage = ""; }
      else syncPage();
    },
    choose(choice: Exclude<StatisticsChoice, null>) {
      block();
      try { win.localStorage.setItem(ANALYTICS_CONSENT_KEY, choice); } catch { return; }
      if (choice === "denied") {
        lastLocation = ""; previousPage = "";
        if (loaded) command("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
        const domains = [win.location.hostname, win.location.hostname.replace(/^www\./, "")];
        for (const name of ["_ga", `_ga_${measurementId.slice(2)}`]) {
          win.document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
          for (const domain of domains) win.document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax; Secure`;
        }
      }
      syncPage();
    },
  };
}

let singleton: ReturnType<typeof createWebsiteAnalytics> | undefined;
export const getWebsiteAnalytics = () => singleton ||= createWebsiteAnalytics(window);
