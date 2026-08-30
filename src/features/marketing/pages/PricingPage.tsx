import React, { useState } from "react";
import { MarketingRoute } from "../types";
import {
  Check,
  X,
  ArrowRight,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Terminal,
  Zap,
  Boxes,
  Building
} from "lucide-react";

interface PricingPageProps {
  onNavigate: (route: MarketingRoute) => void;
}

export default function PricingPage({ onNavigate }: PricingPageProps) {
  const [annualBilling, setAnnualBilling] = useState<boolean>(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const plans = [
    {
      id: "starter",
      name: "Starter / Counter",
      tagline: "For single-counter QSRs, coffee bars, and boutique bakeries.",
      monthlyPrice: 999,
      annualPrice: 799,
      popular: false,
      features: [
        "Single counter touch billing terminal",
        "Fast 4-digit staff PIN switches",
        "Dynamic UPI QR code generation",
        "Thermal receipt & digital invoice printing",
        "Basic daily sales & tax summary reports",
        "Standard email & chat support",
        "Zero hardware lock-in (use your own tablet/PC)"
      ],
      ctaText: "Start Starter Plan"
    },
    {
      id: "pro",
      name: "Full-Service Pro",
      tagline: "For busy dine-in restaurants, casual dining, and cloud kitchens.",
      monthlyPrice: 1999,
      annualPrice: 1599,
      popular: true,
      features: [
        "Everything in Starter, plus:",
        "Interactive Floor Plan & Table Management",
        "Multi-Station Kitchen Display (KDS) & Split KOTs",
        "Recipe-Linked BOM Inventory & Auto-Deduction",
        "Cash Drawer Pop Audit & Blind Shift Reconciliation",
        "Customer CRM & Repeat Loyalty Points",
        "Item Modifiers & Special Cooking Instructions",
        "Live Owner Mobile Reporting Dashboard"
      ],
      ctaText: "Start Pro Plan"
    },
    {
      id: "enterprise",
      name: "Multi-Outlet Chain",
      tagline: "For expanding restaurant groups, chains, and franchise operators.",
      monthlyPrice: 3499,
      annualPrice: 2799,
      popular: false,
      features: [
        "Everything in Full-Service Pro, plus:",
        "Centralized SaaS Owner Console for all branches",
        "1-Click Global Menu & Price Tier Distribution",
        "Cross-Outlet Sales & Margin Benchmarking",
        "Multi-Tier Role Access Control (Area Manager / GM)",
        "Consolidated Group Purchasing & Supplier Ledger",
        "Dedicated Implementation Specialist & Priority SLA",
        "Custom API & Webhook Data Export"
      ],
      ctaText: "Contact Enterprise Sales"
    }
  ];

  const faqs = [
    {
      q: "Are there any hidden transaction fees or per-order commissions?",
      a: "No. Veggie POS charges a simple, transparent flat subscription fee. We never take a percentage cut of your restaurant sales, UPI payments, or card orders."
    },
    {
      q: "Do I need to buy expensive proprietary hardware from you?",
      a: "Never. Veggie POS runs natively inside any modern web browser on the devices you already own—whether iPads, Android tablets, Windows All-in-One touch terminals, or laptops. It connects seamlessly to standard ESC/POS thermal printers and electronic cash drawers."
    },
    {
      q: "How fast can we onboard and import our menu?",
      a: "Most restaurants go live within 24 to 48 hours. You can upload an Excel/PDF of your menu or share photos, and our dedicated implementation team will format and configure your categories, modifiers, and table floor plans."
    },
    {
      q: "Can I upgrade or switch between plans as my restaurant grows?",
      a: "Yes. You can switch between Starter, Pro, and Enterprise at any time. When upgrading, charges are automatically prorated without service interruptions."
    },
    {
      q: "What happens if our restaurant internet disconnects during service?",
      a: "Veggie POS uses local state caching in the browser. Active tables, orders, and local PIN terminals remain responsive, and data synchronizes to the cloud the moment connectivity is restored."
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
              Choose the operational tier built for your outlet volume. Every plan includes free software updates, unlimited menu items, and zero per-order commissions.
            </p>

            {/* Billing Frequency Toggle */}
            <div className="pt-4 flex items-center justify-center gap-3">
              <span
                className={`text-xs font-mono font-bold ${
                  !annualBilling ? "text-[#181A18]" : "text-[#787F74]"
                }`}
              >
                Monthly Billing
              </span>
              <button
                onClick={() => setAnnualBilling(!annualBilling)}
                className="w-14 h-7 bg-[#181A18] rounded-full p-1 transition duration-200 cursor-pointer relative"
                aria-label="Toggle annual billing"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-[#FBF9F5] transition-transform duration-200 ${
                    annualBilling ? "translate-x-7 bg-[#6E8F45]" : "translate-x-0"
                  }`}
                />
              </button>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-mono font-bold ${
                    annualBilling ? "text-[#181A18]" : "text-[#787F74]"
                  }`}
                >
                  Annual Billing
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#EBF2E4] text-[#567234] text-[10px] font-mono font-bold border border-[#D5E3C8]">
                  Save 20%
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. PLAN CARDS */}
      <section className="py-20 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan) => {
              const activePrice = annualBilling ? plan.annualPrice : plan.monthlyPrice;
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
                          / outlet / month
                        </span>
                      </div>
                      <p
                        className={`text-[11px] font-mono mt-1 ${
                          plan.popular ? "text-[#84A955]" : "text-[#567234]"
                        }`}
                      >
                        {annualBilling ? "Billed annually (₹" + activePrice * 12 + "/yr)" : "Billed monthly"}
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
