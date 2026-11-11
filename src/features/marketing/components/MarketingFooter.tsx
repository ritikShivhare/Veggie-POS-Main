import SiteLink from "./SiteLink";
import React from "react";
import { MarketingRoute } from "../types";
import BrandLogo from "../../shared/components/BrandLogo";
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
        
        {/* Early access information */}
        <div className="bg-[#242823] border border-[#2E332D] rounded-2xl p-4 sm:p-5 mb-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#6E8F45]"></div>
            <div>
              <p className="text-xs font-mono font-semibold text-[#FBF9F5]">
                Aatmyam POS • Early access
              </p>
              <p className="text-[11px] text-[#A6AEA0]">
                Explore ordering, billing, kitchen tickets, and inventory workflows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SiteLink href="/login"
              onNavigate={onOpenLogin}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#181A18] hover:bg-[#2E332D] text-xs font-bold text-[#FBF9F5] border border-[#2E332D] transition cursor-pointer"
            >
              <span>Store Sign In</span>
            </SiteLink>
            <SiteLink href="/contact"
              onNavigate={() => handleNav("/contact")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#6E8F45] hover:bg-[#567234] text-xs font-bold text-[#FBF9F5] transition cursor-pointer"
            >
              <span>Schedule Walkthrough</span>
            </SiteLink>
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-14">
          {/* Brand & Manifesto Column */}
          <div className="col-span-2 space-y-4">
            <BrandLogo dark />
            <p className="text-xs text-[#A6AEA0] leading-relaxed max-w-sm">
              Software for independent restaurants, currently in early access.
              Explore order, billing, kitchen, and inventory workflows in a walkthrough.
            </p>
            <div className="pt-2 flex items-center gap-4 text-xs font-mono text-[#787F74]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#6E8F45]" />
                Role-based access
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
                <SiteLink href="/product"
                  onNavigate={() => handleNav("/product")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Overview & Features
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/product"
                  onNavigate={() => handleNav("/product")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Touch Terminal & PIN
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/product"
                  onNavigate={() => handleNav("/product")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Live Kitchen KDS
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/product"
                  onNavigate={() => handleNav("/product")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Recipe BOM Stock
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/pricing"
                  onNavigate={() => handleNav("/pricing")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Pricing & Tiers
                </SiteLink>
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
                <SiteLink href="/solutions"
                  onNavigate={() => handleNav("/solutions")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Fine & Casual Dine
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/solutions"
                  onNavigate={() => handleNav("/solutions")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  QSR & Counter Service
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/solutions"
                  onNavigate={() => handleNav("/solutions")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Café & Artisanal Bakery
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/solutions"
                  onNavigate={() => handleNav("/solutions")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Cloud Kitchens
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/roi"
                  onNavigate={() => handleNav("/roi")}
                  className="text-[#D97706] hover:text-[#FBBF24] transition font-semibold cursor-pointer"
                >
                  ROI & Savings Model
                </SiteLink>
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
                <SiteLink href="/about"
                  onNavigate={() => handleNav("/about")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Operating Manifesto
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/resources"
                  onNavigate={() => handleNav("/resources")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Kitchen Field Notes
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/contact"
                  onNavigate={() => handleNav("/contact")}
                  className="text-[#E0E5DC] hover:text-[#6E8F45] transition cursor-pointer"
                >
                  Book Walkthrough
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/terms"
                  onNavigate={() => onOpenLegal("terms")}
                  className="text-[#A6AEA0] hover:text-[#FBF9F5] transition cursor-pointer"
                >
                  Terms of Service
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/privacy"
                  onNavigate={() => onOpenLegal("privacy")}
                  className="text-[#A6AEA0] hover:text-[#FBF9F5] transition cursor-pointer"
                >
                  Privacy Policy
                </SiteLink>
              </li>
              <li>
                <SiteLink href="/refund-policy"
                  onNavigate={() => onOpenLegal("refund-policy")}
                  className="text-[#A6AEA0] hover:text-[#FBF9F5] transition cursor-pointer"
                >
                  Refund Policy
                </SiteLink>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="pt-8 border-t border-[#2E332D] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#787F74]">
          <p>© {new Date().getFullYear()} Aatmyam POS Technologies. Designed for hospitality craft & operational calm.</p>
          <div className="flex items-center gap-6">
            <span className="font-mono text-[11px] text-[#A6AEA0]">Version 4.8.2-Enterprise</span>
            <SiteLink href="/login"
              onNavigate={onOpenLogin}
              className="text-[#6E8F45] hover:underline font-semibold cursor-pointer"
            >
              Store Sign In →
            </SiteLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
