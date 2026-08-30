import React, { useState } from "react";
import { MarketingRoute } from "../types";
import {
  Terminal,
  ChefHat,
  Boxes,
  ShieldCheck,
  Zap,
  TrendingUp,
  Cpu,
  Monitor,
  Printer,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  QrCode,
  Lock,
  Layers,
  Clock,
  ChevronRight
} from "lucide-react";

interface ProductPageProps {
  onNavigate: (route: MarketingRoute) => void;
}

export default function ProductPage({ onNavigate }: ProductPageProps) {
  const [activeModule, setActiveModule] = useState<number>(0);

  const modules = [
    {
      id: "billing",
      title: "Touch Terminal & Fast PIN Register",
      tagline: "Sub-10 second checkouts with zero operator friction",
      description:
        "Engineered for the peak rush. Servers and cashiers punch orders with single-tap modifiers, split checks with one gesture, and generate dynamic UPI QR codes instantly.",
      features: [
        "1-Second Staff PIN switching between table attendants",
        "Physical keyboard hotkeys (0-9, Enter, Backspace) & touch acceleration",
        "Customizable floor maps with live table occupancy status",
        "Dynamic UPI QR code with exact decimal amount generation",
        "Manager authorization required for bill voids & discounts"
      ],
      icon: Terminal,
      codePreview: {
        header: "TERMINAL_DISPATCH // OUTLET_01",
        metric: "Avg Punch Time: 6.8s",
        lines: [
          "TABLE: T-12 [Dine-In, 4 Pax]",
          "+ 2x Butter Chicken (Special)",
          "+ 4x Garlic Naan (Crispy)",
          "MODIFIER: 'Mild spice on gravy'",
          "PAYMENT_MODE: UPI Dynamic QR [Rs. 1,480.00]",
          "STATUS: CONFIRMED & KOT DISPATCHED"
        ]
      }
    },
    {
      id: "kds",
      title: "Multi-Station Kitchen Display (KDS)",
      tagline: "Eliminate lost paper slips and kitchen shouting",
      description:
        "Orders routed automatically to designated kitchen prep stations (e.g. Tandoor, Curry, Beverage Bar, Dessert). Real-time timers ensure no table sits waiting.",
      features: [
        "Color-coded urgency timers (Green ➔ Amber ➔ Red)",
        "Preparation station splitting (KOTs sent only to relevant chefs)",
        "Special cooking notes & allergen alerts highlighted in bold",
        "1-tap 'Item Ready' signal back to server terminal",
        "Zero missing tickets during peak dinner rush"
      ],
      icon: ChefHat,
      codePreview: {
        header: "KDS_STATION_ROUTER // TANDOOR_LINE",
        metric: "Active Prep Tickets: 4",
        lines: [
          "TICKET #1048 [Table T-12] - 03m 12s",
          "-> 4x Garlic Naan [CRISPY / EXTRA BUTTER]",
          "TICKET #1049 [Takeaway #22] - 01m 45s",
          "-> 1x Paneer Tikka Platter",
          "CHEF ACTION: [BUMP TO EXPO PASS]"
        ]
      }
    },
    {
      id: "inventory",
      title: "Recipe-Linked BOM Inventory",
      tagline: "Automated stock depletion down to the gram",
      description:
        "Every menu item connects directly to raw material recipes. As dishes are billed, your pantry balances adjust automatically, preventing unexpected stockouts and portion leakage.",
      features: [
        "Bill of Materials (BOM) linking raw ingredients to menu recipes",
        "Real-time low stock threshold alerts for essential staples",
        "Purchase invoice logging with automated weighted average costing",
        "Theoretical vs. physical inventory variance audits",
        "Wastage and spoilage logging by shift"
      ],
      icon: Boxes,
      codePreview: {
        header: "BOM_STOCK_ENGINE // AUTO_DEDUCT",
        metric: "Pantry Accuracy: 99.4%",
        lines: [
          "RECIPE: Paneer Butter Masala (1 Plate)",
          "- Deduct Cottage Cheese: 200g [Batch #B-88]",
          "- Deduct Butter: 40g",
          "- Deduct Tomato Puree: 120ml",
          "STOCK_ALERT: Butter below threshold (2.1 kg rem.)",
          "STATUS: PO AUTO-DRAFT CREATED"
        ]
      }
    },
    {
      id: "staff",
      title: "Staff Security & Shift Cash Reconciliation",
      tagline: "Complete accountability for every rupee and drawer open",
      description:
        "Eliminate cash pilferage. Clock-in shifts, log starting float, track manual cash drawer openings, and perform blind close reconciliations at the end of every shift.",
      features: [
        "Role-Based Access Control (Owner, Manager, Cashier, Kitchen)",
        "Cash drawer open audit logs with mandatory reason capture",
        "Blind cash count at shift end to prevent count manipulation",
        "Staff attendance and shift-wise sales performance tracking",
        "Automated Day-End (EOD) summary pushed to owner's phone"
      ],
      icon: ShieldCheck,
      codePreview: {
        header: "SECURITY_AUDIT // SHIFT_CLOSING",
        metric: "Drawer Variance: Rs. 0.00",
        lines: [
          "STAFF: Rajesh K. [Cashier Shift #2]",
          "START FLOAT: Rs. 3,000.00",
          "CASH COLLECTED: Rs. 24,500.00",
          "DRAWER POP EVENTS: 3 (All logged with PIN)",
          "SYSTEM EXPECTED: Rs. 27,500.00",
          "ACTUAL PHYSICAL COUNT: Rs. 27,500.00 [BALANCED]"
        ]
      }
    },
    {
      id: "analytics",
      title: "Owner Command & AI Leakage Copilot",
      tagline: "Crystal-clear decisions without standing over the register",
      description:
        "Understand exactly which dishes generate your highest gross margin, identify slow table turnover patterns, and receive proactive advice on pricing and prep batches.",
      features: [
        "Real-time revenue, gross margin, and tax tracking from any mobile browser",
        "Hourly sales distribution curve to optimize staffing schedules",
        "Top & bottom selling menu engineering matrices",
        "Automated daily profit & loss breakdown",
        "Multi-outlet comparative sales benchmarking"
      ],
      icon: TrendingUp,
      codePreview: {
        header: "COPILOT_INTELLIGENCE // LIVE_PULSE",
        metric: "Margin Health: 68.2%",
        lines: [
          "TODAY GROSS: Rs. 84,200 (↑ 14% vs. last Friday)",
          "PEAK HOUR: 20:00 - 21:30 (Avg. ticket: Rs. 920)",
          "MENU INSIGHT: 'Paneer Lababdar' margin is 74%",
          "SUGGESTION: Prep 6L base gravy before 19:30 rush",
          "STATUS: ALL 3 OUTLETS SYNCED"
        ]
      }
    }
  ];

  return (
    <div className="bg-[#181A18] text-[#FBF9F5] min-h-screen">
      
      {/* 1. PRODUCT COMMAND HEADER */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[#2E332D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#242823] border border-[#2E332D] text-xs font-mono text-[#84A955]">
              <Cpu className="w-3.5 h-3.5" />
              <span>THE CONNECTED RESTAURANT ENGINE</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[#FBF9F5] leading-[1.12]">
              Every station in sync. <br />
              <span className="text-[#6E8F45] italic">Every gram</span> accounted for.
            </h1>
            <p className="text-base sm:text-lg text-[#A6AEA0] leading-relaxed">
              Explore the modular architecture powering Veggie POS. Built from the ground up to eliminate restaurant friction across billing, kitchen line dispatch, inventory depletion, and owner reconciliation.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onNavigate("/contact")}
                className="px-6 py-3 text-xs font-bold text-[#181A18] bg-[#FBF9F5] hover:bg-[#6E8F45] hover:text-[#FBF9F5] rounded-xl transition duration-150 cursor-pointer"
              >
                Request Live Walkthrough
              </button>
              <button
                onClick={() => onNavigate("/pricing")}
                className="px-5 py-3 text-xs font-bold text-[#FBF9F5] bg-[#242823] hover:bg-[#2E332D] rounded-xl border border-[#2E332D] transition cursor-pointer"
              >
                View Plans & Pricing
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. INTERACTIVE MODULE EXPLORER */}
      <section className="py-20 border-b border-[#2E332D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Module Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-[#2E332D]">
            {modules.map((mod, idx) => {
              const Icon = mod.icon;
              const isSelected = activeModule === idx;
              return (
                <button
                  key={mod.id}
                  onClick={() => setActiveModule(idx)}
                  className={`px-4 py-3 rounded-xl text-xs font-bold font-mono transition-all duration-150 flex items-center gap-2 shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-[#6E8F45] text-[#FBF9F5] shadow-sm"
                      : "bg-[#242823] text-[#A6AEA0] hover:text-[#FBF9F5] hover:bg-[#2E332D] border border-[#2E332D]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{mod.title.split("&")[0]}</span>
                </button>
              );
            })}
          </div>

          {/* Active Module Showcase Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#242823] border border-[#2E332D] rounded-3xl p-6 sm:p-10 shadow-2xl">
            
            {/* Left Description */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono uppercase text-[#84A955] font-semibold">
                  MODULE 0{activeModule + 1} // ARCHITECTURE DEEP DIVE
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#FBF9F5]">
                  {modules[activeModule].title}
                </h2>
                <p className="text-sm font-mono text-[#D97706]">
                  {modules[activeModule].tagline}
                </p>
              </div>

              <p className="text-sm text-[#A6AEA0] leading-relaxed">
                {modules[activeModule].description}
              </p>

              <div className="space-y-3 pt-2">
                <p className="text-xs font-mono uppercase text-[#FBF9F5] font-bold tracking-wider">
                  Key Capabilities:
                </p>
                <ul className="space-y-2">
                  {modules[activeModule].features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2.5 text-xs text-[#E0E5DC]">
                      <CheckCircle2 className="w-4 h-4 text-[#6E8F45] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Terminal Logic Simulator */}
            <div className="lg:col-span-5">
              <div className="bg-[#181A18] rounded-2xl p-5 border border-[#2E332D] font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#2E332D]">
                  <span className="text-[11px] text-[#6E8F45] font-bold">
                    {modules[activeModule].codePreview.header}
                  </span>
                  <span className="text-[10px] text-[#A6AEA0]">
                    {modules[activeModule].codePreview.metric}
                  </span>
                </div>
                <div className="space-y-2 text-[#E0E5DC] text-[11px] leading-relaxed">
                  {modules[activeModule].codePreview.lines.map((line, lIdx) => (
                    <p
                      key={lIdx}
                      className={
                        line.includes("STATUS") || line.includes("ACTION") || line.includes("ALERT")
                          ? "text-[#FBBF24] font-bold"
                          : line.includes("->") || line.includes("+")
                          ? "text-[#84A955]"
                          : "text-[#A6AEA0]"
                      }
                    >
                      {line}
                    </p>
                  ))}
                </div>
                <div className="pt-4 mt-4 border-t border-[#2E332D] flex items-center justify-between text-[10px] text-[#787F74]">
                  <span>Sub-50ms sync latency</span>
                  <span className="text-[#6E8F45]">● ACTIVE ENGINE</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 3. ORDER-TO-INSIGHT TIMELINE */}
      <section className="py-20 border-b border-[#2E332D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-[#84A955] font-bold">
              The Full Service Loop
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#FBF9F5] tracking-tight">
              From diner greeting to midnight reconciliation.
            </h2>
            <p className="text-sm text-[#A6AEA0]">
              Follow the journey of a single table order across the entire Veggie POS ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            <div className="bg-[#242823] p-6 rounded-2xl border border-[#2E332D] space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-lg bg-[#6E8F45] text-[#FBF9F5] flex items-center justify-center font-mono font-bold text-xs">
                  1
                </span>
                <span className="text-[11px] font-mono text-[#A6AEA0]">19:42 PM</span>
              </div>
              <h3 className="font-serif text-lg font-bold text-[#FBF9F5]">Order Captured</h3>
              <p className="text-xs text-[#A6AEA0] leading-relaxed">
                Guest sits at Table 7. Server enters items on tablet in 8 seconds. Bill state locked.
              </p>
            </div>

            <div className="bg-[#242823] p-6 rounded-2xl border border-[#2E332D] space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-lg bg-[#6E8F45] text-[#FBF9F5] flex items-center justify-center font-mono font-bold text-xs">
                  2
                </span>
                <span className="text-[11px] font-mono text-[#A6AEA0]">19:42 PM (+0.1s)</span>
              </div>
              <h3 className="font-serif text-lg font-bold text-[#FBF9F5]">KDS Dispatch</h3>
              <p className="text-xs text-[#A6AEA0] leading-relaxed">
                Kitchen stations receive split tickets. Chef acknowledges prep time timer.
              </p>
            </div>

            <div className="bg-[#242823] p-6 rounded-2xl border border-[#2E332D] space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-lg bg-[#6E8F45] text-[#FBF9F5] flex items-center justify-center font-mono font-bold text-xs">
                  3
                </span>
                <span className="text-[11px] font-mono text-[#A6AEA0]">20:15 PM</span>
              </div>
              <h3 className="font-serif text-lg font-bold text-[#FBF9F5]">Instant Payment</h3>
              <p className="text-xs text-[#A6AEA0] leading-relaxed">
                Server displays dynamic UPI QR code. Diner scans & pays in 4 seconds. Receipt prints.
              </p>
            </div>

            <div className="bg-[#242823] p-6 rounded-2xl border border-[#2E332D] space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-lg bg-[#D97706] text-[#FBF9F5] flex items-center justify-center font-mono font-bold text-xs">
                  4
                </span>
                <span className="text-[11px] font-mono text-[#A6AEA0]">23:30 PM</span>
              </div>
              <h3 className="font-serif text-lg font-bold text-[#FBF9F5]">Pantry & P&L Audit</h3>
              <p className="text-xs text-[#A6AEA0] leading-relaxed">
                Ingredients depleted from pantry. Cash float verified. Day-end summary sent to owner.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 4. HARDWARE FREEDOM SPECIFICATIONS */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-[#84A955] font-bold">
              Open Hardware Standard
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#FBF9F5] tracking-tight">
              Run on the devices you already own.
            </h2>
            <p className="text-sm text-[#A6AEA0]">
              Never get trapped in expensive proprietary POS hardware leases. Veggie POS runs natively in modern web browsers and communicates with industry-standard peripherals.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            
            <div className="bg-[#242823] p-6 rounded-2xl border border-[#2E332D] space-y-3">
              <Monitor className="w-8 h-8 text-[#6E8F45] mx-auto" />
              <h3 className="font-serif text-base font-bold text-[#FBF9F5]">Touchscreens & PCs</h3>
              <p className="text-xs text-[#A6AEA0]">Windows, Mac, Linux, Android All-in-One touch terminals.</p>
            </div>

            <div className="bg-[#242823] p-6 rounded-2xl border border-[#2E332D] space-y-3">
              <Smartphone className="w-8 h-8 text-[#6E8F45] mx-auto" />
              <h3 className="font-serif text-base font-bold text-[#FBF9F5]">Tablets & Phones</h3>
              <p className="text-xs text-[#A6AEA0]">iPads, Android tablets, and staff smartphones for table-side service.</p>
            </div>

            <div className="bg-[#242823] p-6 rounded-2xl border border-[#2E332D] space-y-3">
              <Printer className="w-8 h-8 text-[#6E8F45] mx-auto" />
              <h3 className="font-serif text-base font-bold text-[#FBF9F5]">Thermal Printers</h3>
              <p className="text-xs text-[#A6AEA0]">ESC/POS standard 2-inch & 3-inch USB, LAN, and Wi-Fi printers.</p>
            </div>

            <div className="bg-[#242823] p-6 rounded-2xl border border-[#2E332D] space-y-3">
              <Lock className="w-8 h-8 text-[#D97706] mx-auto" />
              <h3 className="font-serif text-base font-bold text-[#FBF9F5]">Cash Drawers</h3>
              <p className="text-xs text-[#A6AEA0]">Standard RJ11/RJ12 electronic cash drawers with pop logging.</p>
            </div>

          </div>

          <div className="pt-8 text-center">
            <button
              onClick={() => onNavigate("/contact")}
              className="px-7 py-3.5 text-xs font-bold text-[#181A18] bg-[#6E8F45] hover:bg-[#567234] text-[#FBF9F5] rounded-xl transition duration-150 shadow-md cursor-pointer"
            >
              Check Hardware Compatibility for Your Outlet →
            </button>
          </div>

        </div>
      </section>

    </div>
  );
}
