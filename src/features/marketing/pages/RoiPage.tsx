import React, { useState } from "react";
import { MarketingRoute } from "../types";
import {
  DollarSign,
  ShieldCheck,
  Boxes,
  ArrowRight,
  Info,
  RotateCcw
} from "lucide-react";
import { PLAN_LIMITS } from "../../../../shared/planCatalog";

interface RoiPageProps {
  onNavigate: (route: MarketingRoute) => void;
}

export default function RoiPage({ onNavigate }: RoiPageProps) {
  // Calculator inputs
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(500000); // in INR
  const [leakageRate, setLeakageRate] = useState<number>(0); // user-entered estimate
  const [spoilageRate, setSpoilageRate] = useState<number>(0); // user-entered estimate

  // Calculation logic
  const totalMonthlySales = monthlyRevenue;
  const pilferageSaved = totalMonthlySales * (leakageRate / 100);
  const spoilageSaved = totalMonthlySales * (spoilageRate / 100);
  const estimatedSaaSMonthlyCost = PLAN_LIMITS.pro.price;

  const totalMonthlyValue = pilferageSaved + spoilageSaved;
  const netMonthlyProfit = totalMonthlyValue - estimatedSaaSMonthlyCost;
  const annualBenefit = netMonthlyProfit * 12;
  const estimatedPaybackDays = totalMonthlyValue > 0
    ? Math.round((estimatedSaaSMonthlyCost / (totalMonthlyValue / 30)) * 10) / 10
    : null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleResetDefaults = () => {
    setMonthlyRevenue(500000);
    setLeakageRate(0);
    setSpoilageRate(0);
  };

  return (
    <div className="bg-[#FBF9F5] text-[#1C1E1B] min-h-screen">

      {/* 1. ROI HERO */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-xs font-mono font-bold text-[#D97706]">
              <DollarSign className="w-3.5 h-3.5" />
              <span>THE BUSINESS CASE & LEAKAGE CALCULATOR</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[#181A18] leading-[1.12]">
              See what’s moving. <br />
              <span className="text-[#D97706] italic">Fix what’s leaking.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#5A6056] leading-relaxed">
              In food service, profit isn’t just made on the menu price—it’s protected in the kitchen and at the register.
              Use this scenario calculator with your own estimates. It does not predict or guarantee savings from Aatmyam POS.
            </p>
          </div>
        </div>
      </section>

      {/* 2. INTERACTIVE CALCULATOR & WATERFALL BREAKDOWN */}
      <section className="py-16 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Interactive Control Panel */}
            <div className="lg:col-span-6 bg-[#F4F0E8] border border-[#EAE5DA] rounded-3xl p-6 sm:p-8 space-y-6">

              <div className="flex items-center justify-between pb-4 border-b border-[#EAE5DA]">
                <h2 className="font-serif text-xl font-bold text-[#181A18]">
                  Your Operational Assumptions
                </h2>
                <button
                  onClick={handleResetDefaults}
                  className="text-xs font-mono text-[#5A6056] hover:text-[#181A18] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Defaults</span>
                </button>
              </div>

              {/* Slider 1: Monthly Gross Sales */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-[#181A18]">Average Monthly Sales (Per Outlet):</span>
                  <span className="text-sm font-bold text-[#6E8F45] bg-[#FBF9F5] px-2.5 py-1 rounded-lg border border-[#EAE5DA]">
                    {formatCurrency(monthlyRevenue)}
                  </span>
                </div>
                <input
                  type="range"
                  min={100000}
                  max={3000000}
                  step={50000}
                  value={monthlyRevenue}
                  onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                  className="w-full accent-[#6E8F45] cursor-pointer h-2 bg-[#EAE5DA] rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#787F74]">
                  <span>₹1 Lakh</span>
                  <span>₹15 Lakhs</span>
                  <span>₹30 Lakhs</span>
                </div>
              </div>

              <p className="text-[11px] text-[#787F74]">This model is for one outlet. Enter assumptions that match your own records.</p>

              {/* Slider 2: Cash & Pilferage Leakage Rate */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-[#181A18]">
                    Your estimated cash leakage rate:
                  </span>
                  <span className="text-sm font-bold text-[#D97706] bg-[#FEF3C7] px-2.5 py-1 rounded-lg border border-[#FDE68A]">
                    {leakageRate}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={0.5}
                  value={leakageRate}
                  onChange={(e) => setLeakageRate(Number(e.target.value))}
                  className="w-full accent-[#D97706] cursor-pointer h-2 bg-[#EAE5DA] rounded-lg"
                />
                <p className="text-[11px] text-[#787F74]">
                  Enter your own estimate, or leave it at 0% if you do not have one.
                </p>
              </div>

              {/* Slider 3: Ingredient Spoilage Rate */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-[#181A18]">
                    Over-Portioning & Spoilage Rate:
                  </span>
                  <span className="text-sm font-bold text-[#567234] bg-[#EBF2E4] px-2.5 py-1 rounded-lg border border-[#D5E3C8]">
                    {spoilageRate}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={spoilageRate}
                  onChange={(e) => setSpoilageRate(Number(e.target.value))}
                  className="w-full accent-[#567234] cursor-pointer h-2 bg-[#EAE5DA] rounded-lg"
                />
                <p className="text-[11px] text-[#787F74]">
                  Enter your own estimated percentage of monthly sales, or leave it at 0%.
                </p>
              </div>

              {/* Methodology note */}
              <div className="p-3 bg-[#FBF9F5] rounded-xl border border-[#EAE5DA] flex items-start gap-2 text-[11px] text-[#787F74]">
                <Info className="w-4 h-4 text-[#6E8F45] shrink-0 mt-0.5" />
                <span>
                  Results are hypothetical calculations from the values you enter. Aatmyam POS has not validated these estimates against restaurant customer results.
                </span>
              </div>

            </div>

            {/* Right Live Waterfall Breakdown */}
            <div className="lg:col-span-6 bg-[#181A18] text-[#FBF9F5] rounded-3xl p-6 sm:p-8 border border-[#2E332D] space-y-6 shadow-xl">

              <div className="flex items-center justify-between pb-4 border-b border-[#2E332D]">
                <div>
                  <span className="text-xs font-mono text-[#84A955] uppercase font-bold">
                    YOUR SCENARIO ESTIMATE
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-[#FBF9F5]">
                    Monthly Net Scenario
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-2xl sm:text-3xl font-serif font-bold text-[#6E8F45]">
                    {formatCurrency(netMonthlyProfit)}
                  </p>
                  <p className="text-[10px] font-mono text-[#A6AEA0]">Based on your entries</p>
                </div>
              </div>

              {/* Waterfall Rows */}
              <div className="space-y-3 font-mono text-xs">

                <div className="flex items-center justify-between p-3 bg-[#242823] rounded-xl border border-[#2E332D]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D97706]" />
                    <span>1. Estimated cash leakage amount</span>
                  </div>
                  <span className="font-bold text-[#D97706]">
                    +{formatCurrency(pilferageSaved)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#242823] rounded-xl border border-[#2E332D]">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-[#6E8F45]" />
                    <span>2. Estimated inventory amount</span>
                  </div>
                  <span className="font-bold text-[#6E8F45]">
                    +{formatCurrency(spoilageSaved)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#181A18] rounded-xl border border-[#2E332D] text-[#A6AEA0]">
                  <div className="flex items-center gap-2">
                    <span>4. Aatmyam POS SaaS Subscription</span>
                  </div>
                  <span className="font-bold text-[#E57373]">
                    -{formatCurrency(estimatedSaaSMonthlyCost)}
                  </span>
                </div>

              </div>

              {/* Annualized Projection Card */}
              <div className="p-4 bg-[#242823] rounded-2xl border border-[#6E8F45]/40 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-mono text-[#A6AEA0] uppercase">
                    12-Month Scenario Estimate
                  </p>
                  <p className="font-serif text-xl sm:text-2xl font-bold text-[#FBF9F5]">
                    {formatCurrency(annualBenefit)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-[#A6AEA0] uppercase">
                    Estimated Payback
                  </p>
                  <p className="font-serif text-xl sm:text-2xl font-bold text-[#6E8F45]">
                    {estimatedPaybackDays === null ? "Not estimated" : `${estimatedPaybackDays} days`}
                  </p>
                </div>
              </div>

              {/* Action */}
              <div className="pt-2">
                <button
                  onClick={() => onNavigate("/contact")}
                  className="w-full py-3.5 text-xs font-bold text-[#181A18] bg-[#FBF9F5] hover:bg-[#6E8F45] hover:text-[#FBF9F5] rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <span>Discuss this scenario</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 3. CASE CONTEXT & PRINCIPLES */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-[#567234] font-bold">
              Operational factors to review
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#181A18] tracking-tight">
              Restaurant costs and workflows vary.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#F4F0E8] p-6 rounded-2xl border border-[#EAE5DA] space-y-3">
              <h3 className="font-serif text-lg font-bold text-[#181A18]">
                1. Unchecked Bill Edits
              </h3>
              <p className="text-xs text-[#5A6056] leading-relaxed">
                Review who can edit or cancel orders and how those changes are recorded in your current process.
              </p>
            </div>

            <div className="bg-[#F4F0E8] p-6 rounded-2xl border border-[#EAE5DA] space-y-3">
              <h3 className="font-serif text-lg font-bold text-[#181A18]">
                2. Over-portioning in the Kitchen
              </h3>
              <p className="text-xs text-[#5A6056] leading-relaxed">
                Recipe records can help teams track ingredient quantities and compare them with stock on hand.
              </p>
            </div>

            <div className="bg-[#F4F0E8] p-6 rounded-2xl border border-[#EAE5DA] space-y-3">
              <h3 className="font-serif text-lg font-bold text-[#181A18]">
                3. Laggy Table Turnarounds
              </h3>
              <p className="text-xs text-[#5A6056] leading-relaxed">
                Order and payment steps can affect service flow. Review them with staff to identify where a clearer workflow may help.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
