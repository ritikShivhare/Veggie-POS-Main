import React, { useState } from "react";
import { MarketingRoute } from "../types";
import { MARKETING_GUIDES, guideReadTime } from "../../../../shared/marketing-guides";
import SiteLink from "../components/SiteLink";
import {
  BookOpen,
  ArrowRight,
  Download,
  FileText,
  Clock,
  CheckCircle2,
  Boxes,
  Zap,
  ShieldCheck,
  Building,
  Sparkles
} from "lucide-react";

interface ResourcesPageProps {
  onNavigate: (route: MarketingRoute) => void;
}

export default function ResourcesPage({ onNavigate }: ResourcesPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const articles = MARKETING_GUIDES;

  const filteredArticles =
    selectedCategory === "all"
      ? articles
      : articles.filter((a) => a.category === selectedCategory);

  return (
    <div className="bg-[#FBF9F5] text-[#1C1E1B] min-h-screen">

      {/* 1. RESOURCES HERO */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF2E4] border border-[#D5E3C8] text-xs font-mono font-bold text-[#567234]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>RESTAURANT OPERATOR PLAYBOOKS</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[#181A18] leading-[1.12]">
              Operator playbooks, <br />
              <span className="text-[#6E8F45] italic">calculators</span> & field notes.
            </h1>
            <p className="text-base sm:text-lg text-[#5A6056] leading-relaxed">
              Practical guides, worked examples and setup checklists for independent restaurant and café owners. Examples are illustrative; use your own operating records.
            </p>
          </div>
        </div>
      </section>

      {/* 2. CATEGORY TABS & ARTICLE GRID */}
      <section className="py-16 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { label: "All Playbooks", key: "all" },
              { label: "Inventory & Costing", key: "inventory" },
              { label: "Service Speed & Ops", key: "operations" },
              { label: "Hardware & Tech", key: "technology" },
              { label: "Single Outlet Operations", key: "single-outlet" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedCategory(tab.key)}
                className={`px-4 py-2 text-xs font-bold font-mono rounded-full transition cursor-pointer shrink-0 ${
                  selectedCategory === tab.key
                    ? "bg-[#181A18] text-[#FBF9F5] shadow-xs"
                    : "bg-[#F4F0E8] text-[#5A6056] hover:text-[#181A18] hover:bg-[#EAE5DA] border border-[#EAE5DA]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Article Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredArticles.map((article) => (
              <div
                key={article.path}
                className="bg-[#F4F0E8] border border-[#EAE5DA] rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 transition hover:shadow-md hover:border-[#6E8F45]"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#787F74]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EBF2E4] text-[#567234] font-bold">
                      {article.label}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {guideReadTime(article)}
                    </span>
                  </div>

                  <h2 className="font-serif text-xl font-bold text-[#181A18] leading-snug">
                    {article.title}
                  </h2>

                  <p className="text-xs text-[#5A6056] leading-relaxed">
                    {article.summary}
                  </p>

                  <div className="p-3 bg-[#FBF9F5] rounded-xl border border-[#EAE5DA]">
                    <p className="text-[10px] font-mono uppercase text-[#787F74] font-bold">
                      Key Takeaway:
                    </p>
                    <p className="text-xs text-[#181A18] font-semibold mt-0.5">
                      {article.takeaway}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#EAE5DA]">
                  <SiteLink href={article.path}
                    onNavigate={() => onNavigate(article.path)}
                    className="w-full py-2.5 text-xs font-bold text-[#181A18] hover:text-[#6E8F45] bg-[#FBF9F5] hover:bg-[#EAE5DA] rounded-xl transition border border-[#EAE5DA] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Read Operator Guide</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </SiteLink>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 3. DOWNLOADABLE OPERATOR TOOLKIT CTA */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="bg-[#181A18] text-[#FBF9F5] rounded-3xl p-8 sm:p-12 border border-[#2E332D] flex flex-col lg:flex-row items-center justify-between gap-8 shadow-xl">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-[#84A955]">
                <Download className="w-4 h-4" />
                <span>RECIPE COSTING WORKSHEET</span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#FBF9F5]">
                Download the recipe-costing worksheet.
              </h2>
              <p className="text-sm text-[#A6AEA0] leading-relaxed">
                An editable CSV with illustrative ingredient prices, unit conversions and serving-cost formulas. Replace the sample inputs with your records in a compatible spreadsheet app.
              </p>
            </div>

            <div className="shrink-0">
              <a href="/restaurant-recipe-cost-template.csv" download
                className="inline-flex px-6 py-3.5 text-xs font-bold text-[#181A18] bg-[#FBF9F5] hover:bg-[#6E8F45] hover:text-[#FBF9F5] rounded-xl transition duration-150 flex items-center gap-2 cursor-pointer shadow-md"
              >
                <span>Download Recipe Cost CSV</span>
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>

        </div>
      </section>


    </div>
  );
}
