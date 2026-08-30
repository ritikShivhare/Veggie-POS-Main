import React, { useState } from "react";
import { MarketingRoute } from "../types";
import {
  UtensilsCrossed,
  Zap,
  Coffee,
  Boxes,
  Store,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  ShieldCheck,
  Building
} from "lucide-react";

interface SolutionsPageProps {
  onNavigate: (route: MarketingRoute) => void;
}

export default function SolutionsPage({ onNavigate }: SolutionsPageProps) {
  const [selectedFormat, setSelectedFormat] = useState<string>("all");

  const formats = [
    {
      id: "fine-dine",
      title: "Fine Dining & Casual Table Service",
      category: "Dine-In",
      tagline: "Paced service, multi-server handoffs, and error-free split checks.",
      icon: UtensilsCrossed,
      friction:
        "Servers spend too much time walking back to a single desktop terminal, courses arrive out of sync, and guests wait 10+ minutes just to get their bill split at dinner peak.",
      solution:
        "Veggie POS gives servers instant 4-digit PIN table-side ordering. KOTs are automatically paced (Starters ➔ Mains ➔ Desserts), and bills can be split by item or guest in two taps.",
      highlights: [
        "Visual table status (Occupied, Dining, Billing, Vacant)",
        "Multi-course KOT holding & firing",
        "Instant split billing by seat or item",
        "Staff tip and server commission reporting"
      ],
      impactMetric: "14 min faster table turnover",
      accent: "#6E8F45"
    },
    {
      id: "qsr",
      title: "Quick-Service (QSR) & Counter Service",
      category: "Counter",
      tagline: "Queue-busting register speed and zero cashier calculation mistakes.",
      icon: Zap,
      friction:
        "Long lines at the register during lunch rush cause frustrated customers to walk away. Cashiers make mistakes during manual change calculations or duplicate punching.",
      solution:
        "Ultra-fast touch terminal with physical keypad hotkeys. Cashiers select combos with one gesture, show a dynamic UPI QR code, and print a thermal receipt in under 8 seconds.",
      highlights: [
        "Sub-10 second order-to-payment cycle",
        "Dynamic UPI QR code eliminating manual amount entry",
        "Custom combo and modifier quick-selectors",
        "Direct kitchen order token display"
      ],
      impactMetric: "35% faster counter throughput",
      accent: "#6E8F45"
    },
    {
      id: "cafe",
      title: "Cafés, Coffee Bars & Artisanal Bakeries",
      category: "Café",
      tagline: "Ingredient batch yields, milk-type modifiers, and repeat loyalty.",
      icon: Coffee,
      friction:
        "Tracking syrup pumps, specialty milks (oat/almond), and batch-baked croissants in traditional POS systems is messy, leading to stock discrepancies and wasted inventory.",
      solution:
        "Veggie POS recipes account for gram-level coffee bean doses and specialty milk portions. Low-stock alerts remind baristas before morning espresso runs dry.",
      highlights: [
        "Modifier-based inventory deduction (Oat, Almond, Decaf)",
        "Daily batch bakery yield tracking",
        "Customer phone capture & repeat loyalty rewards",
        "Morning peak hour sales acceleration"
      ],
      impactMetric: "Zero morning rush stockouts",
      accent: "#6E8F45"
    },
    {
      id: "cloud-kitchen",
      title: "Cloud Kitchens & Delivery Hubs",
      category: "Delivery",
      tagline: "Multi-brand dispatch, strict prep station routing, and packaging control.",
      icon: Layers,
      friction:
        "Managing multiple virtual brands from a single kitchen creates chaotic prep lines, wrong delivery packaging, and missing items in courier bags.",
      solution:
        "Centralize all brand menus into one master dispatch station. Orders automatically route to specific chef lines (Fryer, Grill, Packing) with clear visual brand badges.",
      highlights: [
        "Multi-brand routing on single kitchen hardware",
        "Packaging material (boxes, cutlery) BOM tracking",
        "Order dispatch status tracking for riders",
        "Item-level margin calculations including packaging"
      ],
      impactMetric: "99.8% order fulfillment accuracy",
      accent: "#6E8F45"
    },
    {
      id: "multi-outlet",
      title: "Multi-Outlet Chains & Growing Groups",
      category: "Enterprise",
      tagline: "Centralized menu control, outlet benchmarking, and role hierarchies.",
      icon: Building,
      friction:
        "Owners lose visibility across multiple branches. Recipe costs drift, prices are updated inconsistently, and store managers use unauthorized discounts.",
      solution:
        "The SaaS Owner Console lets you push menu price updates to all branches in one click, compare store performance side-by-side, and lock critical actions behind owner PINs.",
      highlights: [
        "Centralized menu distribution and price tiers",
        "Multi-outlet comparative revenue and margin dashboard",
        "Universal staff role permissions and audit logs",
        "Consolidated group purchasing insights"
      ],
      impactMetric: "100% centralized menu governance",
      accent: "#D97706"
    }
  ];

  const filteredFormats =
    selectedFormat === "all"
      ? formats
      : formats.filter(
          (f) =>
            f.category.toLowerCase() === selectedFormat.toLowerCase() ||
            f.id === selectedFormat
        );

  return (
    <div className="bg-[#FBF9F5] text-[#1C1E1B] min-h-screen">
      
      {/* 1. SOLUTIONS HEADER */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF2E4] border border-[#D5E3C8] text-xs font-mono font-bold text-[#567234]">
              <Store className="w-3.5 h-3.5" />
              <span>FORMAT-SPECIFIC HOSPITALITY OS</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[#181A18] leading-[1.12]">
              Built for your format. <br />
              <span className="text-[#6E8F45] italic">Tuned</span> for your floor.
            </h1>
            <p className="text-base sm:text-lg text-[#5A6056] leading-relaxed">
              Every hospitality concept faces different bottlenecks. Discover how Veggie POS adapts to table turn dynamics, counter queues, recipe batches, and multi-outlet governance.
            </p>
          </div>
        </div>
      </section>

      {/* 2. FORMAT FILTER BAR & STORY CARDS */}
      <section className="py-16 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-xs font-mono font-bold text-[#787F74] uppercase mr-2 shrink-0">
              Filter Concept:
            </span>
            {[
              { label: "All Concepts", key: "all" },
              { label: "Dine-In & Casual", key: "dine-in" },
              { label: "QSR & Counter", key: "counter" },
              { label: "Café & Bakery", key: "café" },
              { label: "Cloud Kitchen", key: "delivery" },
              { label: "Multi-Outlet Groups", key: "enterprise" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedFormat(tab.key)}
                className={`px-4 py-2 text-xs font-bold font-mono rounded-full transition cursor-pointer shrink-0 ${
                  selectedFormat === tab.key
                    ? "bg-[#181A18] text-[#FBF9F5] shadow-xs"
                    : "bg-[#F4F0E8] text-[#5A6056] hover:text-[#181A18] hover:bg-[#EAE5DA] border border-[#EAE5DA]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Format Story Cards Grid */}
          <div className="space-y-10">
            {filteredFormats.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="bg-[#F4F0E8] border border-[#EAE5DA] rounded-3xl p-6 sm:p-10 transition-all duration-200 hover:shadow-md"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Details */}
                    <div className="lg:col-span-7 space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-[#181A18] text-[#6E8F45] flex items-center justify-center">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-mono font-bold text-[#567234] uppercase">
                            {item.category} Concept
                          </span>
                        </div>
                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#181A18]">
                          {item.title}
                        </h2>
                        <p className="text-xs font-mono text-[#D97706] font-semibold">
                          {item.tagline}
                        </p>
                      </div>

                      {/* Friction vs Solution Box */}
                      <div className="space-y-4 pt-2">
                        <div className="p-4 bg-[#FBF9F5] rounded-2xl border border-[#EAE5DA] space-y-1.5">
                          <p className="text-xs font-mono font-bold text-[#D97706] flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            THE OPERATIONAL BOTTLENECK:
                          </p>
                          <p className="text-xs text-[#5A6056] leading-relaxed">
                            {item.friction}
                          </p>
                        </div>

                        <div className="p-4 bg-[#EBF2E4] rounded-2xl border border-[#D5E3C8] space-y-1.5">
                          <p className="text-xs font-mono font-bold text-[#567234] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            THE VEGGIE POS RESOLUTION:
                          </p>
                          <p className="text-xs text-[#2E4A1C] leading-relaxed">
                            {item.solution}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right Highlights & Metrics */}
                    <div className="lg:col-span-5 bg-[#FBF9F5] p-6 rounded-2xl border border-[#EAE5DA] space-y-6">
                      <div className="space-y-3">
                        <p className="text-xs font-mono uppercase font-bold text-[#181A18]">
                          Specialized Capabilities:
                        </p>
                        <ul className="space-y-2">
                          {item.highlights.map((high, hIdx) => (
                            <li key={hIdx} className="flex items-start gap-2 text-xs text-[#1C1E1B]">
                              <CheckCircle2 className="w-4 h-4 text-[#6E8F45] shrink-0 mt-0.5" />
                              <span>{high}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-4 border-t border-[#EAE5DA] flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-mono uppercase text-[#787F74]">
                            Verified Field Impact
                          </p>
                          <p className="font-serif text-lg font-bold text-[#181A18]">
                            {item.impactMetric}
                          </p>
                        </div>
                        <button
                          onClick={() => onNavigate("/contact")}
                          className="px-4 py-2 text-xs font-bold text-[#FBF9F5] bg-[#181A18] hover:bg-[#6E8F45] rounded-xl transition duration-150 cursor-pointer"
                        >
                          Explore for Your Setup →
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 3. FORMAT SELECTION CTA */}
      <section className="py-20 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <h2 className="font-serif text-3xl sm:text-4xl text-[#181A18] tracking-tight">
            Not sure which configuration fits your concept?
          </h2>
          <p className="text-sm text-[#5A6056] leading-relaxed">
            Our hospitality specialists can map your existing floor plan, kitchen pass, and recipe inventory directly into Veggie POS during a free 15-minute consultation.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate("/contact")}
              className="px-7 py-3.5 text-sm font-bold text-[#FBF9F5] bg-[#181A18] hover:bg-[#6E8F45] rounded-xl transition duration-200 shadow-md cursor-pointer border border-[#2E332D]"
            >
              Book a Format Consultation
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
