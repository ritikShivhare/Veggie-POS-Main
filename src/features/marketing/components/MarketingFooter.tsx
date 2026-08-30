import React from "react";
import { MarketingRoute } from "../types";
import {
  ShieldCheck,
  Terminal,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Lock,
  Heart
} from "lucide-react";

interface MarketingFooterProps {
  onNavigate: (route: MarketingRoute) => void;
  onOpenLogin: () => void;
  onOpenLegal: (page: "terms" | "privacy" | "refund-policy") => void;
}

export default function MarketingFooter({
  onNavigate,
  onOpenLogin,
  onOpenLegal
}: MarketingFooterProps) {
  const handleNav = (route: MarketingRoute) => {
    onNavigate(route);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-[#181A18] text-[#FBF9F5] pt-16 pb-12 border-t border-[#2E332D]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Live Operational Status Strip */}
        <div className="bg-[#242823] border border-[#2E332D] rounded-2xl p-4 sm:p-5 mb-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#6E8F45] animate-pulse"></div>
            <div>
              <p className="text-xs font-mono font-semibold text-[#FBF9F5]">
                System Status: All Services Operational (99.98% Uptime)
              </p>
              <p className="text-[11px] text-[#A6AEA0]">
                Encrypted multi-tenant synchronization • Sub-50ms KOT dispatch
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenLogin}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#181A18] hover:bg-[#2E332D] text-xs font-bold text-[#FBF9F5] border border-[#2E332D] transition cursor-pointer"
            >
              <span>Store Sign In</span>
            </button>
            <button
              onClick={() => handleNav("/contact")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#6E8F45] hover:bg-[#567234] text-xs font-bold text-[#FBF9F5] transition cursor-pointer"
            >
              <span>Schedule Walkthrough</span>
            </button>
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-14">
          {/* Brand & Manifesto Column */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#6E8F45] text-[#FBF9F5] flex items-center justify-center font-serif text-base font-bold">
                V
              </div>
              <span className="font-serif text-lg font-bold tracking-tight text-[#FBF9F5]">
                Veggie POS
              </span>
            </div>
            <p className="text-xs text-[#A6AEA0] leading-relaxed max-w-sm">
              The calm command center for independent restaurants and growing groups. 
              Eliminate rush-hour scramble, account for every gram in stock, and give operators clear oversight.
            </p>
            <div className="pt-2 flex items-center gap-4 text-xs font-mono text-[#787F74]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#6E8F45]" />
                SOC-2 & Role Guard
              </span>
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#6E8F45]" />
                Zero Hardware Lock-in
              </span>
            </div>
          </div>

          {/* Platform Links */}
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-[#A6AEA0] font-semibold">
              Platform
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => handleNav("/product")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Overview & Features
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("/product")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Touch Terminal & PIN
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("/product")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Live Kitchen KDS
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("/product")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Recipe BOM Stock
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("/pricing")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Pricing & Tiers
                </button>
              </li>
            </ul>
          </div>

          {/* Solutions Links */}
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-[#A6AEA0] font-semibold">
              Formats
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => handleNav("/solutions")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Fine & Casual Dine
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("/solutions")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  QSR & Counter Service
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("/solutions")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Café & Artisanal Bakery
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("/solutions")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Cloud Kitchens
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("/roi")}
                  className="text-[#D97706] hover:text-[#FBBF24] transition font-semibold cursor-pointer"
                >
                  ROI & Savings Model
                </button>
              </li>
            </ul>
          </div>

          {/* Company & Resources */}
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-[#A6AEA0] font-semibold">
              Company & Docs
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => handleNav("/about")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Operating Manifesto
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("/resources")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Kitchen Field Notes
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav("/contact")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Book Walkthrough
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegal("terms")}
                  className="text-[#A6AEA0] hover:text-[#FBF9F5] transition cursor-pointer"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegal("privacy")}
                  className="text-[#A6AEA0] hover:text-[#FBF9F5] transition cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegal("refund-policy")}
                  className="text-[#A6AEA0] hover:text-[#FBF9F5] transition cursor-pointer"
                >
                  Refund Policy
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="pt-8 border-t border-[#2E332D] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#787F74]">
          <p>© {new Date().getFullYear()} Veggie POS Technologies. Designed for hospitality craft & operational calm.</p>
          <div className="flex items-center gap-6">
            <span className="font-mono text-[11px] text-[#A6AEA0]">Version 4.8.2-Enterprise</span>
            <button
              onClick={onOpenLogin}
              className="text-[#6E8F45] hover:underline font-semibold cursor-pointer"
            >
              Store Sign In →
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
