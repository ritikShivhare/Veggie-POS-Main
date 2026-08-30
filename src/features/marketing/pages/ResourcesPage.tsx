import React, { useState } from "react";
import { MarketingRoute, ResourceArticle } from "../types";
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
  const [activeArticleModal, setActiveArticleModal] = useState<ResourceArticle | null>(null);

  const articles: ResourceArticle[] = [
    {
      id: "inventory-audit",
      title: "The 30-Day Restaurant Recipe & Yield Audit",
      summary:
        "A step-by-step operator guide to establishing Bill of Materials (BOM) for top 20 revenue dishes and stopping portion creep in the kitchen line.",
      category: "inventory",
      readTime: "6 min read",
      publishDate: "Operational Guide",
      keyTakeaway: "Linking raw materials to recipes eliminates 3-5% of monthly ingredient shrinkage."
    },
    {
      id: "register-speed",
      title: "The 8-Second Register Blueprint: Queue-Busting at Peak Rush",
      summary:
        "Tactical layout and keypad hotkey strategies that help cashiers process orders and collect UPI payments in under 10 seconds without calculation errors.",
      category: "operations",
      readTime: "5 min read",
      publishDate: "Field Note",
      keyTakeaway: "Dynamic UPI QR codes eliminate manual cashier change calculations completely."
    },
    {
      id: "cash-drawer-audit",
      title: "The Anti-Pilferage Protocol: Shift Blind Closes & Audit Logs",
      summary:
        "Why mandatory manager PINs for bill cancellations and automated drawer pop event logging protect thousands in cash float every month.",
      category: "operations",
      readTime: "7 min read",
      publishDate: "Security Best Practice",
      keyTakeaway: "Blind cash counting at shift end prevents count manipulation."
    },
    {
      id: "hardware-guide",
      title: "Hardware Independence: Running a 30-Table Floor on Standard Tablets",
      summary:
        "How modern browser architecture lets restaurants use consumer iPads, Android tablets, and ESC/POS thermal printers instead of $2,000 locked terminals.",
      category: "technology",
      readTime: "4 min read",
      publishDate: "Tech Architecture",
      keyTakeaway: "Avoid proprietary POS hardware leases with open-standard web applications."
    },
    {
      id: "multi-outlet-playbook",
      title: "Multi-Outlet Menu Governance: Centralized Distribution for Chains",
      summary:
        "How 5-20 location restaurant groups push synchronized menu changes, seasonal promotions, and price tiers in one click from an owner console.",
      category: "growth",
      readTime: "8 min read",
      publishDate: "Scaling Playbook",
      keyTakeaway: "Centralized cloud sync prevents pricing drift across franchises."
    },
    {
      id: "kds-transition",
      title: "The Paperless Pass: Transitioning Chefs to Digital KDS Displays",
      summary:
        "A practical blueprint to introducing kitchen display screens to prep lines without slowing down service or causing head chef frustration.",
      category: "operations",
      readTime: "5 min read",
      publishDate: "Kitchen Ops",
      keyTakeaway: "Color-coded station splitting ensures no tickets get lost behind the grill."
    }
  ];

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
              Tested strategies, yield audit frameworks, and operational guides written for restaurant owners, general managers, and culinary directors.
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
              { label: "Multi-Outlet Growth", key: "growth" }
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
                key={article.id}
                className="bg-[#F4F0E8] border border-[#EAE5DA] rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 transition hover:shadow-md hover:border-[#6E8F45]"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#787F74]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EBF2E4] text-[#567234] font-bold">
                      {article.publishDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {article.readTime}
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
                      {article.keyTakeaway}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#EAE5DA]">
                  <button
                    onClick={() => setActiveArticleModal(article)}
                    className="w-full py-2.5 text-xs font-bold text-[#181A18] hover:text-[#6E8F45] bg-[#FBF9F5] hover:bg-[#EAE5DA] rounded-xl transition border border-[#EAE5DA] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Read Operator Guide</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
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
                <span>FREE RESTAURANT SPREADSHEET TOOLKIT</span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#FBF9F5]">
                Download the Restaurant Recipe Cost & Yield Template.
              </h2>
              <p className="text-sm text-[#A6AEA0] leading-relaxed">
                Includes pre-built Excel/Sheets formulas for ingredient conversions, portion shrinkage calculation, theoretical food cost %, and shift reconciliation logs.
              </p>
            </div>

            <div className="shrink-0">
              <button
                onClick={() => onNavigate("/contact")}
                className="px-6 py-3.5 text-xs font-bold text-[#181A18] bg-[#FBF9F5] hover:bg-[#6E8F45] hover:text-[#FBF9F5] rounded-xl transition duration-150 flex items-center gap-2 cursor-pointer shadow-md"
              >
                <span>Request Free Template Pack</span>
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* Article Detail Reading Modal */}
      {activeArticleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FBF9F5] border border-[#EAE5DA] rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#EAE5DA]">
              <span className="text-xs font-mono font-bold text-[#567234] uppercase">
                {activeArticleModal.publishDate} • {activeArticleModal.readTime}
              </span>
              <button
                onClick={() => setActiveArticleModal(null)}
                className="text-xs font-mono font-bold px-3 py-1 bg-[#F4F0E8] hover:bg-[#EAE5DA] rounded-lg text-[#181A18] cursor-pointer"
              >
                Close (ESC)
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#181A18]">
                {activeArticleModal.title}
              </h3>
              <p className="text-sm text-[#5A6056] leading-relaxed">
                {activeArticleModal.summary}
              </p>
              <div className="p-4 bg-[#EBF2E4] rounded-2xl border border-[#D5E3C8] space-y-2">
                <p className="text-xs font-mono font-bold text-[#567234]">
                  OPERATIONAL IMPLEMENTATION SUMMARY:
                </p>
                <p className="text-xs text-[#2E4A1C] leading-relaxed">
                  {activeArticleModal.keyTakeaway} All principles outlined in this guide come pre-configured inside the Veggie POS module workflows.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#EAE5DA] flex justify-between items-center">
              <button
                onClick={() => {
                  setActiveArticleModal(null);
                  onNavigate("/contact");
                }}
                className="px-5 py-2.5 text-xs font-bold text-[#FBF9F5] bg-[#181A18] hover:bg-[#6E8F45] rounded-xl transition cursor-pointer"
              >
                See This Live in a Walkthrough →
              </button>
              <button
                onClick={() => setActiveArticleModal(null)}
                className="text-xs text-[#787F74] hover:underline cursor-pointer"
              >
                Back to Playbooks
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
