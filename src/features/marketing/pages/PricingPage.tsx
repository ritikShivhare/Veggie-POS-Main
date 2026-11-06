import React, { useState } from "react";
import { MarketingRoute } from "../types";
import {
  Check,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck
} from "lucide-react";
import { PLAN_LIMITS } from "../../../../shared/planCatalog";

interface PricingPageProps {
  onNavigate: (route: MarketingRoute) => void;
}

export default function PricingPage({ onNavigate }: PricingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const plans = [
    { id: "free", tagline: "For one outlet getting started.", popular: false, ctaText: "Request a walkthrough" },
    { id: "pro", tagline: "For a single outlet with more staff and orders.", popular: true, ctaText: "Request a walkthrough" },
    { id: "enterprise", tagline: "Higher usage limits for one outlet.", popular: false, ctaText: "Contact us about this plan" }
  ].map((display) => {
    const plan = PLAN_LIMITS[display.id as keyof typeof PLAN_LIMITS];
    const features = [
      `Owner + ${plan.staffCount} active staff`,
      `${plan.monthlyOrders < 0 ? "Unlimited (fair use)" : plan.monthlyOrders} orders per 30-day cycle`,
      ...(plan.features.posTerminal ? ["POS terminal"] : []),
      ...(plan.features.basicReports ? ["Basic sales reports"] : []),
      ...(plan.features.advancedInventory ? ["Advanced inventory"] : []),
      ...(plan.features.aiCopilot ? ["AI reports: 5 successful reports/day (IST; provider setup required)"] : []),
      ...(plan.features.dedicatedSupport ? ["Dedicated support"] : []),
      "One outlet per restaurant"
    ];
    return { ...display, name: plan.label, monthlyPrice: plan.price, features };
  });

  const faqs = [
    {
      q: "How is the listed price billed?",
      a: "Pro ₹999 and Elite ₹1,999 are all-inclusive prices for a 30-day subscription. Eligible restaurants can start a one-time 14-day trial with Owner + 10 staff, 250 orders, full inventory and 5 successful AI reports/day."
    },
    {
      q: "Do I need to buy expensive proprietary hardware from you?",
      a: "Aatmyam POS is a web app. Request a walkthrough so we can discuss your device and printer setup."
    },
    {
      q: "How do I get started?",
      a: "Request a product walkthrough to discuss your menu, device setup, and the current early-access process."
    },
    {
      q: "How can I change plans?",
      a: "Choose a plan in Billing and pay through Cashfree. Access updates after backend payment verification. Mid-cycle Elite upgrades start a fresh 30-day cycle without proration."
    },
    {
      q: "What happens if our restaurant internet disconnects during service?",
      a: "Aatmyam POS uses local state caching in the browser. Active tables, orders, and local PIN terminals remain responsive, and data synchronizes to the cloud the moment connectivity is restored."
    }
  ];

  return (
    <div className="bg-[#FBF9F5] text-[#1C1E1B] min-h-screen">

      {/* 1. PRICING HERO */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF2E4] border border-[#D5E3C8] text-xs font-mono font-bold text-[#567234]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>TRANSPARENT HOSPITALITY PRICING</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[#181A18] leading-[1.12]">
              Simple, honest pricing. <br />
              <span className="text-[#6E8F45] italic">No hidden percentages.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#5A6056] leading-relaxed">
              Aatmyam POS is in early access. These 30-day plans use the same prices and limits as the app.
            </p>

            <div className="pt-4 text-xs font-mono text-[#787F74]">
              30-day billing • One outlet per restaurant
            </div>

          </div>
        </div>
      </section>

      {/* 2. PLAN CARDS */}
      <section className="py-20 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan) => {
              const activePrice = plan.monthlyPrice;
              return (
                <div
                  key={plan.id}
                  className={`rounded-3xl p-8 flex flex-col justify-between transition-all duration-200 relative ${
                    plan.popular
                      ? "bg-[#181A18] text-[#FBF9F5] border-2 border-[#6E8F45] shadow-2xl scale-[1.03]"
                      : "bg-[#F4F0E8] text-[#1C1E1B] border border-[#EAE5DA] hover:border-[#6E8F45]"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#6E8F45] text-[#FBF9F5] px-4 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase shadow-sm">
                      MOST POPULAR FOR DINE-IN
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h2 className="font-serif text-2xl font-bold">{plan.name}</h2>
                      <p
                        className={`text-xs leading-relaxed ${
                          plan.popular ? "text-[#A6AEA0]" : "text-[#5A6056]"
                        }`}
                      >
                        {plan.tagline}
                      </p>
                    </div>

                    {/* Price display */}
                    <div className="pt-2 pb-4 border-b border-current/15">
                      <div className="flex items-baseline gap-1">
                        <span className="font-serif text-4xl sm:text-5xl font-bold">
                          ₹{activePrice}
                        </span>
                        <span
                          className={`text-xs font-mono ${
                            plan.popular ? "text-[#A6AEA0]" : "text-[#787F74]"
                          }`}
                        >
                          / outlet / 30 days
                        </span>
                      </div>
                      <p
                        className={`text-[11px] font-mono mt-1 ${
                          plan.popular ? "text-[#84A955]" : "text-[#567234]"
                        }`}
                      >
                        All-inclusive • 30-day cycle
                      </p>
                    </div>

                    {/* Features list */}
                    <div className="space-y-3">
                      <p className="text-xs font-mono uppercase tracking-wider font-bold">
                        Included Features:
                      </p>
                      <ul className="space-y-2.5">
                        {plan.features.map((feat, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-2.5 text-xs">
                            <Check
                              className={`w-4 h-4 shrink-0 mt-0.5 ${
                                plan.popular ? "text-[#6E8F45]" : "text-[#567234]"
                              }`}
                            />
                            <span className={plan.popular ? "text-[#E0E5DC]" : "text-[#1C1E1B]"}>
                              {feat}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Plan CTA */}
                  <div className="pt-8 mt-6 border-t border-current/15">
                    <button
                      onClick={() => onNavigate("/contact")}
                      className={`w-full py-3.5 text-xs font-bold rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                        plan.popular
                          ? "bg-[#6E8F45] hover:bg-[#567234] text-[#FBF9F5] shadow-md"
                          : "bg-[#181A18] hover:bg-[#6E8F45] text-[#FBF9F5]"
                      }`}
                    >
                      <span>{plan.ctaText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 3. TRANSPARENT PRICING FAQ */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          <div className="text-center space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-[#567234] font-bold">
              Frequently Asked Questions
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#181A18] tracking-tight">
              Clear answers before you decide.
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#F4F0E8] border border-[#EAE5DA] rounded-2xl overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-hidden"
                  >
                    <span className="font-serif text-base sm:text-lg font-bold text-[#181A18]">
                      {faq.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-[#6E8F45] shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#787F74] shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-[#5A6056] leading-relaxed border-t border-[#EAE5DA] pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-8 text-center">
            <p className="text-xs text-[#787F74]">
              Have a custom multi-chain setup or special franchise requirement?
            </p>
            <button
              onClick={() => onNavigate("/contact")}
              className="mt-2 text-xs font-bold text-[#6E8F45] hover:underline cursor-pointer"
            >
              Talk directly with our solutions architecture team →
            </button>
          </div>

        </div>
      </section>

    </div>
  );
}
