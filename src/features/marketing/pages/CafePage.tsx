import React from "react";
import { Coffee, ArrowRight, Terminal, ChefHat, Boxes, ShieldCheck } from "lucide-react";
import { PLAN_LIMITS } from "../../../../shared/planCatalog";
import type { MarketingRoute } from "../types";
import SiteLink from "../components/SiteLink";

export default function CafePage({ onNavigate }: { onNavigate: (route: MarketingRoute) => void }) {
  const pro = PLAN_LIMITS.pro;
  const elite = PLAN_LIMITS.enterprise;
  const workflows = [
    { title: "Counter orders and payment records", icon: Terminal, text: "Enter menu items and quantities, review the order and record cash or a checked UPI payment. A configured UPI ID enables an amount-specific QR; staff still verify the customer's payment before recording it." },
    { title: "Kitchen preparation status", icon: ChefHat, text: "Give the preparation team a view of incoming orders and their current status. Rehearse how the counter and kitchen will communicate readiness using the current supported workflow." },
    { title: "Recipes and ingredient stock", icon: Boxes, text: "On plans with advanced inventory, link drinks and dishes to ingredient recipes, keep purchase/stock records and review low-stock thresholds. Use measured quantities for items such as beans, milk and syrup." },
    { title: "Individual staff access", icon: ShieldCheck, text: "Assign staff roles and permissions for counter, kitchen and owner responsibilities. Check the actions each person can perform before service and review recorded sales activity afterward." },
  ];
  return <div className="bg-[#FBF9F5] text-[#1C1E1B] min-h-screen">
    <section className="pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[#EAE5DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-6">
          <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-xs text-[#567234]"><SiteLink href="/" onNavigate={() => onNavigate("/")}>Home</SiteLink><span aria-hidden="true">/</span><SiteLink href="/solutions" onNavigate={() => onNavigate("/solutions")}>Solutions</SiteLink><span aria-hidden="true">/</span><span aria-current="page">Cafés</span></nav>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF2E4] border border-[#D5E3C8] text-xs font-mono font-bold text-[#567234]"><Coffee className="w-3.5 h-3.5" />ONE OUTLET · EARLY ACCESS</div>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[#181A18] leading-[1.12]">Café POS for <span className="text-[#6E8F45] italic">independent cafés</span> in India.</h1>
          <p className="text-base sm:text-lg text-[#5A6056] leading-relaxed">Connect counter orders, kitchen status, recipe-linked stock and staff access in one browser-based workspace. Review the current product against your café's menu, volume and device setup before getting started.</p>
          <SiteLink href="/contact" onNavigate={() => onNavigate("/contact")} className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold text-[#FBF9F5] bg-[#181A18] rounded-xl shadow-md">Book a café walkthrough<ArrowRight className="w-4 h-4" /></SiteLink>
        </div>
      </div>
    </section>
    <section className="py-16 md:py-20 border-b border-[#EAE5DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-3xl space-y-3"><h2 className="font-serif text-3xl sm:text-4xl text-[#181A18]">A clear handoff from counter to preparation</h2><p className="text-sm text-[#5A6056] leading-relaxed">These are product workflows to review, not promises of measured speed gains, automatic bank reconciliation or integrations with every ordering service.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">{workflows.map(({ title, icon: Icon, text }) => <div key={title} className="bg-[#F4F0E8] p-6 sm:p-8 rounded-3xl border border-[#EAE5DA] space-y-4"><Icon className="w-7 h-7 text-[#567234]" /><h3 className="font-serif text-xl font-bold text-[#181A18]">{title}</h3><p className="text-sm text-[#5A6056] leading-relaxed">{text}</p></div>)}</div>
      </div>
    </section>
    <section className="py-16 md:py-20 border-b border-[#EAE5DA]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <h2 className="font-serif text-3xl sm:text-4xl text-[#181A18]">Choose an allowance that fits your order volume</h2>
        <p className="text-sm sm:text-base text-[#5A6056] leading-relaxed">Professional Pro is ₹{pro.price.toLocaleString("en-IN")} per 30 days with Owner + {pro.staffCount} active staff and {pro.monthlyOrders} orders. That averages about {(pro.monthlyOrders / 30).toFixed(1)} orders per day across the cycle; it is not a daily allowance. A café doing 20 orders every day would total 600 in 30 days. Compare that pattern with your chosen plan's allowance.</p>
        <p className="text-sm sm:text-base text-[#5A6056] leading-relaxed">Elite is ₹{elite.price.toLocaleString("en-IN")} per 30 days with Owner + {elite.staffCount} active staff and unlimited orders subject to fair use. Both are for one outlet. Free Starter has {PLAN_LIMITS.free.monthlyOrders} orders per cycle and basic reports; advanced inventory requires a supported plan.</p>
        <SiteLink href="/pricing" onNavigate={() => onNavigate("/pricing")} className="inline-flex text-sm font-semibold text-[#567234] underline">Compare all plan features and trial details</SiteLink>
      </div>
    </section>
    <section className="py-16 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <h2 className="font-serif text-3xl sm:text-4xl text-[#181A18]">Bring a practical checklist to your demo</h2>
        <ol className="list-decimal pl-6 space-y-4 text-sm sm:text-base text-[#5A6056] leading-relaxed">
          <li>Prepare a sample order from your menu and explain the handoff between the counter and kitchen.</li>
          <li>List your actual devices, operating systems and printer model. Confirm the connection and printing setup instead of assuming all hardware is supported.</li>
          <li>Choose one drink or dish and measure its recipe quantities. Check purchase-to-stock unit conversions and the inventory plan you need.</li>
          <li>Rehearse payment recording and a reconnect scenario. Cached work and queued changes depend on prior setup; server confirmation and provider verification require connectivity.</li>
        </ol>
        <div className="p-6 sm:p-8 bg-[#F4F0E8] rounded-3xl border border-[#EAE5DA] space-y-4"><h3 className="font-serif text-2xl text-[#181A18]">Useful before you choose</h3><ul className="space-y-3 text-sm"><li><SiteLink href="/resources/restaurant-pos-cost-guide" onNavigate={() => onNavigate("/resources/restaurant-pos-cost-guide")} className="text-[#567234] underline">Restaurant POS cost and hardware checklist</SiteLink></li><li><SiteLink href="/resources/restaurant-food-cost-calculation" onNavigate={() => onNavigate("/resources/restaurant-food-cost-calculation")} className="text-[#567234] underline">Worked recipe-cost example with a downloadable CSV</SiteLink></li><li><SiteLink href="/resources/single-outlet-setup-checklist" onNavigate={() => onNavigate("/resources/single-outlet-setup-checklist")} className="text-[#567234] underline">Single-outlet setup and recovery checklist</SiteLink></li></ul></div>
        <SiteLink href="/contact" onNavigate={() => onNavigate("/contact")} className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold text-[#FBF9F5] bg-[#181A18] rounded-xl shadow-md">Discuss your café setup<ArrowRight className="w-4 h-4" /></SiteLink>
      </div>
    </section>
  </div>;
}
