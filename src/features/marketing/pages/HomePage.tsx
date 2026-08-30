import React, { useState } from "react";
import { MarketingRoute } from "../types";
import {
  ArrowRight,
  Terminal,
  ChefHat,
  Boxes,
  ShieldCheck,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  Layers,
  Store,
  Receipt,
  QrCode,
  DollarSign
} from "lucide-react";

interface HomePageProps {
  onNavigate: (route: MarketingRoute) => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);
  const [interactiveTab, setInteractiveTab] = useState<"billing" | "kitchen" | "stock" | "owner">("billing");

  const workflowSteps = [
    {
      id: "01",
      station: "Counter Register",
      title: "Order Placed in 8 Seconds",
      metric: "Sub-10s turnaround",
      description:
        "Cashier or server taps table, punches item modifiers, and displays dynamic UPI QR code. No laggy dropdowns, no double-clicking.",
      statusColor: "bg-[#6E8F45]",
      badge: "Instant Sync"
    },
    {
      id: "02",
      station: "Kitchen Pass",
      title: "KOT Fired to Cooking Stations",
      metric: "0 Lost Paper Slips",
      description:
        "Kitchen display screens and thermal printers update simultaneously with special cooking notes (e.g. 'Less Oil / Extra Spicy').",
      statusColor: "bg-[#6E8F45]",
      badge: "Live Broadcast"
    },
    {
      id: "03",
      station: "Pantry & Stock",
      title: "Ingredients Auto-Deducted to the Gram",
      metric: "99.2% Stock Precision",
      description:
        "When 1 Paneer Tikka is billed, 200g cottage cheese, 40g marinade, and 15g butter are deducted automatically from live batch inventory.",
      statusColor: "bg-[#6E8F45]",
      badge: "BOM Recipe Mapping"
    },
    {
      id: "04",
      station: "Owner Command",
      title: "Reconciliation & Leakage Alert",
      metric: "Zero Pilferage Gap",
      description:
        "End-of-shift cash drawer balance, discounts, and item cancellations require authorized PIN validation and appear on the mobile dashboard.",
      statusColor: "bg-[#D97706]",
      badge: "Saffron Audit Flag"
    }
  ];

  return (
    <div className="bg-[#FBF9F5] text-[#1C1E1B]">
      
      {/* 1. HERO SECTION: Outcome-Led Editorial Layout */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Narrative Column */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Category Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EBF2E4] border border-[#D5E3C8] text-xs font-mono font-bold text-[#567234]">
                <span className="w-2 h-2 rounded-full bg-[#6E8F45] animate-pulse"></span>
                <span>Hospitality Command Standard</span>
                <span className="text-[#84A955]">|</span>
                <span>Multi-Station Restaurant OS</span>
              </div>

              {/* Main Headline */}
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#181A18] tracking-tight leading-[1.12]">
                Peak service, <br className="hidden sm:block" />
                <span className="italic text-[#6E8F45]">without</span> the scramble.
              </h1>

              {/* Editorial Subhead */}
              <p className="text-base sm:text-lg text-[#5A6056] leading-relaxed max-w-2xl">
                Veggie POS is the calm operational command center for independent kitchens and growing multi-outlet groups. 
                Fast 4-digit PIN counter billing, synchronized KOTs, automated recipe-level stock deductions, and real-time leakage alerts—unified on the hardware you already own.
              </p>

              {/* Action Buttons & Assurance */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                <button
                  onClick={() => onNavigate("/contact")}
                  id="hero-book-demo-btn"
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 text-sm font-bold text-[#FBF9F5] bg-[#181A18] hover:bg-[#6E8F45] rounded-xl transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer border border-[#2E332D]"
                >
                  <span>Book a 15-Minute Walkthrough</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => onNavigate("/product")}
                  id="hero-explore-product-btn"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-[#181A18] bg-[#F4F0E8] hover:bg-[#EAE5DA] rounded-xl transition-all duration-150 border border-[#EAE5DA] cursor-pointer"
                >
                  <span>Explore Core Features</span>
                  <ArrowRight className="w-4 h-4 text-[#6E8F45]" />
                </button>
              </div>

              {/* Trust Tokens */}
              <div className="pt-4 grid grid-cols-3 gap-4 border-t border-[#EAE5DA] text-xs">
                <div>
                  <p className="font-serif text-lg font-bold text-[#181A18]">8 Sec</p>
                  <p className="text-[11px] text-[#787F74]">Average check-out speed</p>
                </div>
                <div>
                  <p className="font-serif text-lg font-bold text-[#6E8F45]">100%</p>
                  <p className="text-[11px] text-[#787F74]">KOT to Kitchen accuracy</p>
                </div>
                <div>
                  <p className="font-serif text-lg font-bold text-[#D97706]">&lt; 14 Days</p>
                  <p className="text-[11px] text-[#787F74]">Typical payback on leakage</p>
                </div>
              </div>
            </div>

            {/* Right Interactive Dashboard Canvas */}
            <div className="lg:col-span-5">
              <div className="bg-[#181A18] text-[#FBF9F5] rounded-3xl p-5 sm:p-6 border border-[#2E332D] shadow-2xl relative overflow-hidden">
                
                {/* Top Control Bar */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2E332D]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#E57373]/80"></span>
                    <span className="w-3 h-3 rounded-full bg-[#FFD54F]/80"></span>
                    <span className="w-3 h-3 rounded-full bg-[#81C784]/80"></span>
                    <span className="text-[11px] font-mono text-[#A6AEA0] ml-2">Live Floor Console</span>
                  </div>
                  <span className="text-[10px] font-mono bg-[#242823] px-2 py-0.5 rounded text-[#6E8F45] border border-[#2E332D]">
                    Outlet #01 • Peak Mode
                  </span>
                </div>

                {/* Interactive Station Switcher */}
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#242823] rounded-xl mb-4 border border-[#2E332D] text-xs font-mono">
                  <button
                    onClick={() => setInteractiveTab("billing")}
                    className={`py-1.5 rounded-lg transition text-center cursor-pointer ${
                      interactiveTab === "billing"
                        ? "bg-[#6E8F45] text-[#FBF9F5] font-bold"
                        : "text-[#A6AEA0] hover:text-[#FBF9F5]"
                    }`}
                  >
                    Billing
                  </button>
                  <button
                    onClick={() => setInteractiveTab("kitchen")}
                    className={`py-1.5 rounded-lg transition text-center cursor-pointer ${
                      interactiveTab === "kitchen"
                        ? "bg-[#6E8F45] text-[#FBF9F5] font-bold"
                        : "text-[#A6AEA0] hover:text-[#FBF9F5]"
                    }`}
                  >
                    KDS
                  </button>
                  <button
                    onClick={() => setInteractiveTab("stock")}
                    className={`py-1.5 rounded-lg transition text-center cursor-pointer ${
                      interactiveTab === "stock"
                        ? "bg-[#6E8F45] text-[#FBF9F5] font-bold"
                        : "text-[#A6AEA0] hover:text-[#FBF9F5]"
                    }`}
                  >
                    BOM
                  </button>
                  <button
                    onClick={() => setInteractiveTab("owner")}
                    className={`py-1.5 rounded-lg transition text-center cursor-pointer ${
                      interactiveTab === "owner"
                        ? "bg-[#D97706] text-[#FBF9F5] font-bold"
                        : "text-[#A6AEA0] hover:text-[#FBF9F5]"
                    }`}
                  >
                    Owner
                  </button>
                </div>

                {/* Dynamic Screen Mockup based on active tab */}
                {interactiveTab === "billing" && (
                  <div className="space-y-3 bg-[#242823] p-4 rounded-2xl border border-[#2E332D] text-xs animate-in fade-in duration-200">
                    <div className="flex justify-between items-center pb-2 border-b border-[#2E332D]">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#6E8F45]/20 text-[#84A955] rounded font-mono font-bold">
                          Table T-04
                        </span>
                        <span className="text-[#A6AEA0]">3 Guests</span>
                      </div>
                      <span className="font-mono font-bold text-[#FBF9F5]">Total: ₹1,240.00</span>
                    </div>

                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between text-[#E0E5DC]">
                        <span>2× Paneer Butter Masala</span>
                        <span>₹640</span>
                      </div>
                      <div className="flex justify-between text-[#E0E5DC]">
                        <span>4× Tandoori Garlic Naan</span>
                        <span>₹240</span>
                      </div>
                      <div className="flex justify-between text-[#E0E5DC]">
                        <span>2× Mango Lassi (Special)</span>
                        <span>₹360</span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-[#2E332D]">
                      <span className="text-[11px] text-[#A6AEA0] flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5 text-[#6E8F45]" />
                        Dynamic UPI QR Ready
                      </span>
                      <span className="px-2 py-1 bg-[#6E8F45] text-[#FBF9F5] rounded font-bold text-[10px]">
                        Cashier: Rahul (PIN 3333)
                      </span>
                    </div>
                  </div>
                )}

                {interactiveTab === "kitchen" && (
                  <div className="space-y-3 bg-[#242823] p-4 rounded-2xl border border-[#2E332D] text-xs animate-in fade-in duration-200">
                    <div className="flex justify-between items-center pb-2 border-b border-[#2E332D]">
                      <span className="px-2 py-0.5 bg-[#D97706]/20 text-[#FBBF24] rounded font-mono font-bold">
                        KOT #1042 — Fired 2m ago
                      </span>
                      <span className="text-[10px] text-[#A6AEA0] font-mono">Station: Curry & Tandoor</span>
                    </div>
                    <ul className="space-y-2 text-[11px]">
                      <li className="flex items-center justify-between bg-[#181A18] p-2 rounded-lg border border-[#2E332D]">
                        <span className="text-[#FBF9F5] font-semibold">2× Dal Makhani (Slow Cook)</span>
                        <span className="text-[#84A955] text-[10px] uppercase font-mono">In Prep</span>
                      </li>
                      <li className="flex items-center justify-between bg-[#181A18] p-2 rounded-lg border border-[#2E332D]">
                        <span className="text-[#FBF9F5] font-semibold">3× Butter Roti (Crispy)</span>
                        <span className="text-[#FBBF24] text-[10px] uppercase font-mono">Queued</span>
                      </li>
                    </ul>
                    <p className="text-[10px] text-[#A6AEA0] italic">Cooking Note: "Diner requested mild spice on dal"</p>
                  </div>
                )}

                {interactiveTab === "stock" && (
                  <div className="space-y-3 bg-[#242823] p-4 rounded-2xl border border-[#2E332D] text-xs animate-in fade-in duration-200">
                    <div className="flex justify-between items-center pb-2 border-b border-[#2E332D]">
                      <span className="text-xs font-bold text-[#FBF9F5]">Live Recipe BOM Deduction</span>
                      <span className="text-[10px] text-[#84A955] font-mono">Synced Real-Time</span>
                    </div>
                    <div className="space-y-2 font-mono text-[11px]">
                      <div className="p-2 bg-[#181A18] rounded border border-[#2E332D] flex justify-between">
                        <span className="text-[#E0E5DC]">Fresh Paneer Block</span>
                        <span className="text-[#84A955]">-400g (14.2 kg rem.)</span>
                      </div>
                      <div className="p-2 bg-[#181A18] rounded border border-[#2E332D] flex justify-between">
                        <span className="text-[#E0E5DC]">Amul Butter Bulk</span>
                        <span className="text-[#84A955]">-80g (6.4 kg rem.)</span>
                      </div>
                      <div className="p-2 bg-[#181A18] rounded border border-[#D97706]/40 flex justify-between">
                        <span className="text-[#FBBF24]">Dairy Cream</span>
                        <span className="text-[#D97706] font-bold">Low Alert (0.8 L rem.)</span>
                      </div>
                    </div>
                  </div>
                )}

                {interactiveTab === "owner" && (
                  <div className="space-y-3 bg-[#242823] p-4 rounded-2xl border border-[#2E332D] text-xs animate-in fade-in duration-200">
                    <div className="flex justify-between items-center pb-2 border-b border-[#2E332D]">
                      <span className="text-xs font-bold text-[#FBF9F5]">Owner Leakage Guard</span>
                      <span className="px-2 py-0.5 bg-[#D97706]/20 text-[#FBBF24] rounded font-mono text-[10px]">
                        0 Suspicious Edits
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2 bg-[#181A18] rounded border border-[#2E332D]">
                        <p className="text-[#A6AEA0] text-[10px]">Today's Gross Sales</p>
                        <p className="text-sm font-bold text-[#FBF9F5]">₹42,850</p>
                      </div>
                      <div className="p-2 bg-[#181A18] rounded border border-[#2E332D]">
                        <p className="text-[#A6AEA0] text-[10px]">Cash In Drawer</p>
                        <p className="text-sm font-bold text-[#84A955]">₹14,200 (Exact)</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-[#A6AEA0]">All bill cancellations locked behind Owner 4-digit PIN.</p>
                  </div>
                )}

                {/* Footer status */}
                <div className="mt-4 pt-3 border-t border-[#2E332D] flex items-center justify-between text-[11px] text-[#A6AEA0]">
                  <span>Zero proprietary hardware required</span>
                  <button
                    onClick={() => onNavigate("/product")}
                    className="text-[#84A955] hover:underline font-bold cursor-pointer"
                  >
                    Explore Product Specs →
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. THE ORDER-TO-INVENTORY WORKFLOW STRIP */}
      <section className="py-20 bg-[#F4F0E8] border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-[#567234] font-bold">
              The Connected Restaurant Loop
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#181A18] tracking-tight">
              One punch. Every station updated instantly.
            </h2>
            <p className="text-sm text-[#5A6056]">
              When front of house, kitchen line, and inventory communicate seamlessly, food leaves the pass faster and profit stops slipping through the cracks.
            </p>
          </div>

          {/* Interactive Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {workflowSteps.map((step, idx) => {
              const isSelected = activeWorkflowStep === idx;
              return (
                <div
                  key={step.id}
                  onClick={() => setActiveWorkflowStep(idx)}
                  className={`p-6 rounded-2xl border transition-all duration-200 cursor-pointer text-left flex flex-col justify-between ${
                    isSelected
                      ? "bg-[#181A18] text-[#FBF9F5] border-[#181A18] shadow-lg scale-[1.02]"
                      : "bg-[#FBF9F5] text-[#1C1E1B] border-[#EAE5DA] hover:border-[#6E8F45]"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          isSelected
                            ? "bg-[#242823] text-[#84A955]"
                            : "bg-[#F4F0E8] text-[#787F74]"
                        }`}
                      >
                        STEP {step.id}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          step.badge.includes("Saffron")
                            ? "bg-[#D97706]/20 text-[#D97706] font-bold"
                            : "bg-[#6E8F45]/15 text-[#567234] font-semibold"
                        }`}
                      >
                        {step.badge}
                      </span>
                    </div>

                    <p className={`text-xs font-mono ${isSelected ? "text-[#A6AEA0]" : "text-[#787F74]"}`}>
                      {step.station}
                    </p>

                    <h3 className="font-serif text-lg font-bold leading-snug">
                      {step.title}
                    </h3>

                    <p className={`text-xs leading-relaxed ${isSelected ? "text-[#D5DBD0]" : "text-[#5A6056]"}`}>
                      {step.description}
                    </p>
                  </div>

                  <div className="pt-5 mt-4 border-t border-current/15 flex items-center justify-between">
                    <span className="text-[11px] font-mono font-semibold">
                      {step.metric}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${step.statusColor}`}></span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 3. CORE EDITORIAL PILLARS */}
      <section className="py-20 md:py-28 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <span className="text-xs font-mono uppercase tracking-widest text-[#567234] font-bold">
                Operational Craft
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#181A18] tracking-tight">
                Designed for the heat of the floor, not a boardroom slide deck.
              </h2>
            </div>
            <button
              onClick={() => onNavigate("/product")}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#181A18] hover:text-[#6E8F45] transition cursor-pointer"
            >
              <span>Explore all platform modules</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Pillar 1: Register Speed */}
            <div className="bg-[#F4F0E8] p-8 rounded-3xl border border-[#EAE5DA] space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-[#181A18] text-[#6E8F45] flex items-center justify-center">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#181A18]">
                Counter Speed That Keeps Lines Moving
              </h3>
              <p className="text-xs text-[#5A6056] leading-relaxed">
                4-digit quick staff PIN switches, tactile physical keyboard hotkeys, and automatic UPI QR codes. 
                Your staff can punch a 5-item order and collect payment before other systems finish loading.
              </p>
              <ul className="space-y-2 text-xs text-[#1C1E1B] pt-2 border-t border-[#EAE5DA]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#6E8F45]" />
                  <span>One-time store pairing per tablet</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#6E8F45]" />
                  <span>Dynamic split bill & item modifiers</span>
                </li>
              </ul>
            </div>

            {/* Pillar 2: Recipe-Level Stock Control */}
            <div className="bg-[#F4F0E8] p-8 rounded-3xl border border-[#EAE5DA] space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-[#181A18] text-[#6E8F45] flex items-center justify-center">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#181A18]">
                Recipe-Linked BOM Inventory
              </h3>
              <p className="text-xs text-[#5A6056] leading-relaxed">
                Raw ingredients link directly to menu items. As dishes sell, inventory calculates theoretical vs. physical consumption, 
                flagging over-portioning and kitchen shrinkage before the month ends.
              </p>
              <ul className="space-y-2 text-xs text-[#1C1E1B] pt-2 border-t border-[#EAE5DA]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#6E8F45]" />
                  <span>Automated per-dish cost calculations</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#6E8F45]" />
                  <span>Low stock & purchase order logging</span>
                </li>
              </ul>
            </div>

            {/* Pillar 3: Owner Freedom & Anti-Theft */}
            <div className="bg-[#F4F0E8] p-8 rounded-3xl border border-[#EAE5DA] space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-[#181A18] text-[#D97706] flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#181A18]">
                Owner Freedom & Saffron Leakage Signals
              </h3>
              <p className="text-xs text-[#5A6056] leading-relaxed">
                Step away from the cash counter with confidence. Role-based permissions lock bill edits and discounts behind owner authorization, 
                giving you a real-time pulse of revenue from anywhere.
              </p>
              <ul className="space-y-2 text-xs text-[#1C1E1B] pt-2 border-t border-[#EAE5DA]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#6E8F45]" />
                  <span>Cash drawer open event logs</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#6E8F45]" />
                  <span>Shift end cash reconciliation audits</span>
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* 4. RESTAURANT FORMAT SELECTION CTA */}
      <section className="py-20 bg-[#FBF9F5] border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-[#181A18] text-[#FBF9F5] rounded-3xl p-8 sm:p-12 border border-[#2E332D] flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-[#84A955]">
                <Store className="w-4 h-4" />
                <span>FORMAT COMPATIBILITY</span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#FBF9F5]">
                Tuned for fine dining, fast counters, and 20-location groups alike.
              </h2>
              <p className="text-sm text-[#A6AEA0] leading-relaxed">
                See how Veggie POS adapts to your specific floor layout, kitchen stations, and inventory workflows.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <button
                onClick={() => onNavigate("/solutions")}
                className="w-full sm:w-auto px-6 py-3.5 text-xs font-bold text-[#181A18] bg-[#FBF9F5] hover:bg-[#6E8F45] hover:text-[#FBF9F5] rounded-xl transition duration-150 cursor-pointer"
              >
                View Format Solutions
              </button>
              <button
                onClick={() => onNavigate("/roi")}
                className="w-full sm:w-auto px-6 py-3.5 text-xs font-bold text-[#D97706] bg-[#242823] hover:bg-[#2E332D] rounded-xl border border-[#D97706]/40 transition duration-150 cursor-pointer"
              >
                Calculate Your Outlet ROI
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 5. EDITORIAL FINAL CONVERSION STRIP */}
      <section className="py-20 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <h2 className="font-serif text-3xl sm:text-4xl text-[#181A18] tracking-tight">
            Ready to bring calm and control to your kitchen floor?
          </h2>
          <p className="text-sm text-[#5A6056] leading-relaxed">
            Schedule a 15-minute operational walkthrough. We’ll show you how Veggie POS handles your exact menu, recipes, and table layouts without costly hardware migrations.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => onNavigate("/contact")}
              className="px-7 py-3.5 text-sm font-bold text-[#FBF9F5] bg-[#181A18] hover:bg-[#6E8F45] rounded-xl transition duration-200 shadow-md cursor-pointer border border-[#2E332D]"
            >
              Schedule Your Walkthrough
            </button>
            <button
              onClick={() => onNavigate("/pricing")}
              className="px-6 py-3.5 text-sm font-bold text-[#181A18] bg-[#F4F0E8] hover:bg-[#EAE5DA] rounded-xl border border-[#EAE5DA] transition cursor-pointer"
            >
              Review Transparent Pricing
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
