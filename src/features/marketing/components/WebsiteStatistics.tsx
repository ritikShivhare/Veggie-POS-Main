import React, { useLayoutEffect, useState } from "react";
import { useAppContext } from "../../shared/context/AppContext";
import { getAnalyticsPage, getWebsiteAnalytics, WEBSITE_NAVIGATION_EVENT, type StatisticsChoice } from "../websiteAnalytics";

export default function WebsiteStatistics() {
  const { currentStaff, isSessionBootstrapComplete, showSignup, showAdminPanel, showTerminalLogin } = useAppContext();
  const [analytics] = useState(getWebsiteAnalytics);
  const [choice, setChoice] = useState<StatisticsChoice>(() => analytics.readChoice());
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [navigation, setNavigation] = useState(0);
  const eligible = isSessionBootstrapComplete && !currentStaff && !showSignup && !showAdminPanel && !showTerminalLogin && Boolean(getAnalyticsPage(window.location.href));

  useLayoutEffect(() => {
    const update = () => setNavigation(value => value + 1);
    analytics.installNavigationGuards();
    const updateChoice = () => { analytics.syncPage(); setChoice(analytics.readChoice()); };
    window.addEventListener(WEBSITE_NAVIGATION_EVENT, update);
    window.addEventListener("storage", updateChoice);
    return () => { window.removeEventListener(WEBSITE_NAVIGATION_EVENT, update); window.removeEventListener("storage", updateChoice); analytics.setScopeAllowed(false); };
  }, [analytics]);
  useLayoutEffect(() => { analytics.setScopeAllowed(eligible); }, [analytics, eligible, choice, navigation]);

  if (!eligible || analytics.browserOptOut()) return null;
  if (choice !== null && !preferencesOpen) return <button type="button" onClick={() => setPreferencesOpen(true)} className="fixed bottom-3 left-3 z-40 rounded-lg border border-[#D5E3C8] bg-[#FBF9F5] px-3 py-2 text-xs text-[#567234] shadow-sm">Cookie settings</button>;
  const choose = (value: Exclude<StatisticsChoice, null>) => {
    analytics.choose(value); setChoice(value); setPreferencesOpen(false);
  };
  return (
    <section aria-label="Cookie preferences" className="fixed bottom-3 left-3 right-3 z-50 max-w-sm rounded-2xl border border-[#D5E3C8] bg-[#FBF9F5] p-4 text-[#1C1E1B] shadow-xl">
      <h2 className="font-serif text-lg">Cookies &amp; privacy</h2>
      <p className="mt-1 text-xs leading-relaxed">We use essential cookies for sign-in. With your permission, Google Analytics cookies help us understand visits to our public website. You can reject optional cookies and still use the site.</p>
      <p className="mt-1 text-xs leading-relaxed">Restaurant bills, customer details and staff PINs are not included.</p>
      <a href="/privacy" className="mt-2 inline-block text-xs underline text-[#567234]">Read our Privacy Policy</a>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose("granted")} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#D5E3C8] px-3 py-2 text-xs font-semibold">Accept optional cookies</button>
        <button type="button" onClick={() => choose("denied")} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#D5E3C8] px-3 py-2 text-xs font-semibold">Reject optional cookies</button>
      </div>
    </section>
  );
}
