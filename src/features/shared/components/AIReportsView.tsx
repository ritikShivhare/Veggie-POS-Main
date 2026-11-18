import React, { useState } from "react";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  PackageOpen,
  Users,
  Lightbulb,
  CheckCircle2,
  Printer,
  CreditCard,
  FileText,
  LayoutGrid,
  Globe,
  ArrowRight,
  ShieldAlert,
  Clock,
  ExternalLink
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import { Ingredient, Shift, Order } from "../types";

export type ReportLanguage = "hindi" | "hinglish" | "english";

interface AIReportsViewProps {
  handleGenerateAIReport: (language?: ReportLanguage) => Promise<void>;
  isGeneratingReport: boolean;
  reportError: string;
  aiReport: string;
  dashboardStats?: {
    totalRevenue: number;
    cashRevenue: number;
    upiRevenue: number;
    totalOrders: number;
    activeShiftsCount: number;
    lowStockItems: Ingredient[];
    totalStockValue: number;
    topSellingItems: Array<{ name: string; qty: number; sales: number }>;
  };
  ingredients?: Ingredient[];
  shifts?: Shift[];
  orders?: Order[];
  setActiveTab?: (tab: string) => void;
}

export default function AIReportsView({
  handleGenerateAIReport,
  isGeneratingReport,
  reportError,
  aiReport,
  dashboardStats,
  ingredients = [],
  shifts = [],
  orders = [],
  setActiveTab
}: AIReportsViewProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<ReportLanguage>("hindi");
  const tr = (hindi: string, english: string) => selectedLanguage === "hindi" ? hindi : english;
  const [generatedLanguage, setGeneratedLanguage] = useState<ReportLanguage | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "full">("cards");

  // Manual-only reports: opening the page or changing language must not
  // consume an AI report request. Only the Generate button invokes the API.
  const handleLanguageChange = (lang: ReportLanguage) => {
    setSelectedLanguage(lang);
  };

  // Safe fallback metrics calculation
  const totalRev = dashboardStats?.totalRevenue ?? 0;
  const cashRev = dashboardStats?.cashRevenue ?? 0;
  const upiRev = dashboardStats?.upiRevenue ?? 0;
  const totalOrders = dashboardStats?.totalOrders ?? 0;
  const avgTicket = totalOrders > 0 ? Math.round(totalRev / totalOrders) : 0;
  const upiPercent = totalRev > 0 ? Math.round((upiRev / totalRev) * 100) : 0;
  const cashPercent = totalRev > 0 ? Math.round((cashRev / totalRev) * 100) : 0;
  const lowStock = dashboardStats?.lowStockItems ?? ingredients.filter(i => i.currentStock <= i.minStock);
  const stockVal = dashboardStats?.totalStockValue ?? ingredients.reduce((s, i) => s + (i.currentStock * i.costPerUnit), 0);
  const activeStaff = dashboardStats?.activeShiftsCount ?? shifts.filter(s => s.status === "Active").length;
  const topItems = dashboardStats?.topSellingItems ?? [];

  return (
    <div className="h-full p-4 sm:p-6 flex flex-col gap-6 overflow-y-auto bg-slate-50 font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6">

        {/* Top Header & Language Selector Bar (OPTION 1) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 font-display flex items-center gap-2">
                  <span>{tr("व्यवसाय का एआई विश्लेषण", "AI Business Diagnosis & Audit")}</span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full border border-indigo-100 font-mono">
                    {tr("जेमिनी 2.5", "Gemini 2.5")}
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  {selectedLanguage === "hindi"
                    ? "दुकान की बिक्री, कच्चा माल (स्टॉक), और मुनाफ़ा बढ़ाने का संपूर्ण हिंदी विश्लेषण।"
                    : selectedLanguage === "hinglish"
                    ? "Dukaan ki daily sales, critical stock alerts aur profit optimization report."
                    : "Real-time AI operational audit for sales velocity, stock levels, and margin growth."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Language Selector Buttons (विकल्प 1) */}
            <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1 shadow-2xs">
              <button
                onClick={() => handleLanguageChange("hindi")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedLanguage === "hindi"
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title={tr("सरल हिंदी में रिपोर्ट देखें", "View report in Hindi")}
              >
                <span>🇮🇳 {tr("सरल हिंदी", "Hindi")}</span>
              </button>
              <button
                onClick={() => handleLanguageChange("hinglish")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedLanguage === "hinglish"
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title={tr("हिंग्लिश में रिपोर्ट देखें", "View report in Hinglish")}
              >
                <span>🗣️ {tr("हिंग्लिश", "Hinglish")}</span>
              </button>
              <button
                onClick={() => handleLanguageChange("english")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedLanguage === "english"
                    ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="View Report in English"
              >
                <span>🇬🇧 {tr("अंग्रेज़ी", "English")}</span>
              </button>
            </div>

            {/* View Mode Toggle: Cards vs Full Markdown */}
            <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center gap-1">
              <button
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "cards"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{tr("कार्ड दृश्य", "Cards")}</span>
              </button>
              <button
                onClick={() => setViewMode("full")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "full"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{tr("पूरा दस्तावेज़", "Full Document")}</span>
              </button>
            </div>

            {/* Re-trigger Diagnosis Action */}
            <button
              onClick={() => { setGeneratedLanguage(selectedLanguage); void handleGenerateAIReport(selectedLanguage); }}
              disabled={isGeneratingReport}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {isGeneratingReport ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{tr("एआई विश्लेषण जारी…", "Analysing…")}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{selectedLanguage === "hindi" ? "ताज़ा रिपोर्ट बनाएं" : selectedLanguage === "hinglish" ? "Refresh Diagnosis" : "Run AI Diagnosis"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Warning / Error Notification */}
        {reportError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-3 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block text-amber-900">
                {selectedLanguage === "hindi" ? "सिस्टम सूचना:" : "System Notice:"}
              </span>
              <p className="text-amber-800">{selectedLanguage === "hindi" ? "रिपोर्ट नहीं बन सकी। कृपया दोबारा प्रयास करें।" : /[\u0900-\u097f]/.test(reportError) ? "Unable to generate the report. Please retry." : reportError}</p>
            </div>
          </div>
        )}

        {/* Loading State Animation */}
        {isGeneratingReport ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-sm min-h-[380px]">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                <Sparkles className="w-8 h-8 animate-pulse text-indigo-600" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white animate-ping" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-base text-slate-900 font-display">
                {selectedLanguage === "hindi"
                  ? "जेमिनी एआई आपकी रेस्टोरेंट रिपोर्ट तैयार कर रहा है..."
                  : selectedLanguage === "hinglish"
                  ? "Gemini AI aapki restaurant ki report generate kar raha hai..."
                  : "Evaluating restaurant performance metrics with Gemini..."}
              </h3>
              <p className="text-xs text-slate-500 max-w-md">
                {selectedLanguage === "hindi"
                  ? "आज की कुल बिक्री, कच्चा माल और स्टाफ ड्यूटी का गहन अध्ययन किया जा रहा है।"
                  : selectedLanguage === "hinglish"
                  ? "Daily sales volume, stock alerts aur margin improvement points compute ho rahe hain."
                  : "Computing raw ingredient margins, ticket velocity, and labor allocation."}
              </p>
            </div>
            <div className="w-48 bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full w-2/3 animate-pulse" />
            </div>
          </div>
        ) : viewMode === "cards" ? (
          /* OPTION 3: 4 STRUCTURED HIGHLIGHT CARDS IN HINDI / HINGLISH */
          <div className="space-y-6 animate-fade-in">

            {/* Top Row: 2 Primary Diagnostic Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* CARD 1: 🟢 कमाई व बिक्री विश्लेषण (Sales & Revenue Performance) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-emerald-200 transition-all">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-base text-slate-900 font-display">
                          {selectedLanguage === "hindi" ? "1. कमाई व बिक्री रिपोर्ट" : selectedLanguage === "hinglish" ? "1. Sales & Revenue Summary" : "1. Sales & Revenue Momentum"}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {selectedLanguage === "hindi" ? "आज के कुल चेकआउट्स और पेमेंट का हिसाब" : "Today's checkouts & payment channels"}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                      {totalOrders} {tr("ऑर्डर", "Orders")}
                    </span>
                  </div>

                  {/* Big Number Metrics */}
                  <div className="grid grid-cols-3 gap-3 py-4 border-b border-slate-100 text-center font-mono">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-150">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        {selectedLanguage === "hindi" ? "कुल बिक्री" : "Total Net Sales"}
                      </span>
                      <span className="text-lg font-black text-slate-900">
                        ₹{totalRev.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                      <span className="text-[10px] text-indigo-700 font-bold uppercase block">
                        {tr("यूपीआई भुगतान", "UPI payment")} ({upiPercent}%)
                      </span>
                      <span className="text-lg font-black text-indigo-900">
                        ₹{upiRev.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                      <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                        {tr("नकद", "Cash")} ({cashPercent}%)
                      </span>
                      <span className="text-lg font-black text-emerald-900">
                        ₹{cashRev.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Payment Visual Split Bar */}
                  <div className="py-3 space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-slate-600">
                      <span>{tr("यूपीआई", "UPI")}: {upiPercent}%</span>
                      <span className="text-slate-400 font-mono">{tr("औसत बिल", "Average bill")}: ₹{avgTicket} / {tr("ग्राहक", "guest")}</span>
                      <span>{tr("नकद", "Cash")}: {cashPercent}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                      <div style={{ width: `${upiPercent}%` }} className="bg-indigo-600 h-full" title={`UPI: ₹${upiRev}`} />
                      <div style={{ width: `${cashPercent}%` }} className="bg-emerald-500 h-full" title={`Cash: ₹${cashRev}`} />
                    </div>
                  </div>

                  {/* Top Selling Items Mini List */}
                  {topItems.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-500 block">
                        {selectedLanguage === "hindi" ? "🔥 सबसे ज्यादा बिकने वाले व्यंजन:" : "🔥 Top Selling Menu Items:"}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {topItems.map((item, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-800 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <b>{item.name}</b>
                            <span className="text-slate-500 font-mono">({item.qty} {tr("बिके", "sold")} • ₹{item.sales})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {tr("भुगतान का बँटवारा", "Payment mix")}: {tr("यूपीआई", "UPI")} {upiPercent}% · {tr("नकद", "Cash")} {cashPercent}%
                  </span>
                  {setActiveTab && (
                    <button
                      onClick={() => setActiveTab("billing")}
                      className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>{tr("बिलिंग काउंटर", "Billing")}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* CARD 2: 🔴 कच्चा माल व स्टॉक चेतावनी (Critical Stock & Reorder Alert) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-red-200 transition-all">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                        lowStock.length > 0 ? "bg-red-50 text-red-600 animate-pulse" : "bg-emerald-50 text-emerald-600"
                      }`}>
                        <PackageOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-base text-slate-900 font-display">
                          {selectedLanguage === "hindi" ? "2. कच्चा माल व स्टॉक स्थिति" : selectedLanguage === "hinglish" ? "2. Inventory & Stock Matrix" : "2. Inventory & Supply Chain"}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {selectedLanguage === "hindi" ? "किचन में बचे सामान और री-ऑर्डर की जानकारी" : "Ingredient stock holding and safety thresholds"}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold font-mono border ${
                      lowStock.length > 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {lowStock.length > 0 ? `⚠️ ${lowStock.length} ${tr("सामग्री कम हैं", "items low")}` : tr("स्टॉक पर्याप्त है", "Stock sufficient")}
                    </span>
                  </div>

                  {/* Valuation & Low Stock List */}
                  <div className="py-3.5 space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          {selectedLanguage === "hindi" ? "गोदाम/किचन में कुल स्टॉक मूल्य" : "Total Holding Stock Valuation"}
                        </span>
                        <span className="text-base font-black text-slate-900 font-mono">
                          ₹{stockVal.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-600 font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {ingredients.length} {tr("सामग्री", "ingredients")}
                      </span>
                    </div>

                    {/* Low Stock Items Detailed Warning */}
                    {lowStock.length > 0 ? (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-red-600 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {selectedLanguage === "hindi" ? "तुरंत मंगाने योग्य सामग्री:" : "Critical Low Stock Items:"}
                        </span>
                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                          {lowStock.map((item) => (
                            <div key={item.id} className="p-2.5 bg-red-50/70 border border-red-200 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <span className="font-extrabold text-slate-900">{item.name}</span>
                                <span className="text-[11px] text-slate-500 block">
                                  {tr("बचा स्टॉक", "Remaining")}: <b className="text-red-700 font-mono">{item.currentStock} {item.unit}</b> ({tr("न्यूनतम", "Minimum")}: {item.minStock} {item.unit})
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white shadow-2xs">
                                {tr("कम है", "Low stock")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 space-y-1">
                        <span className="font-bold block">{tr("सभी ज़रूरी सामान पर्याप्त मात्रा में उपलब्ध हैं।", "All essential ingredients are sufficiently stocked.")}</span>
                        <p className="text-[11px] text-emerald-700">{tr("किचन में किसी मुख्य सामग्री की कमी नहीं है।", "No critical ingredient shortages.")}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {selectedLanguage === "hindi" ? "2 दिन का बफर स्टॉक सुरक्षित रखें" : "Keep 2-day buffer stock"}
                  </span>
                  {setActiveTab && (
                    <button
                      onClick={() => setActiveTab("inventory")}
                      className="text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>{tr("सामग्री मँगाएँ", "Purchase stock")}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Row: Staffing & Profit Playbook Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* CARD 3: 🔵 स्टाफ व शिफ्ट स्थिति (Staff Shifts & Coverage) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-indigo-200 transition-all">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-base text-slate-900 font-display">
                          {selectedLanguage === "hindi" ? "3. स्टाफ व शिफ्ट उपस्थिति" : selectedLanguage === "hinglish" ? "3. Staff & Shifts Coverage" : "3. Workforce & Labor Coverage"}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {selectedLanguage === "hindi" ? "ड्यूटी पर मौजूद कर्मचारियों का विवरण" : "On-duty personnel and shift readiness"}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                      {activeStaff} {tr("सक्रिय कर्मचारी", "Active Staff")}
                    </span>
                  </div>

                  <div className="py-3.5 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-center font-mono">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          {selectedLanguage === "hindi" ? "ड्यूटी पर कर्मचारी" : "Active Staff"}
                        </span>
                        <span className="text-xl font-black text-slate-900">{activeStaff} {tr("लोग", "staff")}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          {selectedLanguage === "hindi" ? "शिफ्ट स्थिति" : "Shift Status"}
                        </span>
                        <span className="text-base font-bold text-emerald-700">{tr("सक्रिय शिफ्ट", "Active shifts")}</span>
                      </div>
                    </div>

                    {/* Active Staff List */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-500 block">
                        {selectedLanguage === "hindi" ? "सक्रिय कर्मचारी:" : "Active Shift Members:"}
                      </span>
                      <div className="space-y-1">
                        {shifts.filter(s => s.status === "Active").slice(0, 3).map((s, idx) => (
                          <div key={idx} className="p-2 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">{s.staffName}</span>
                            <span className="text-[10px] font-semibold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                              {selectedLanguage === "hindi" ? ({Owner:"मालिक", Manager:"प्रबंधक", Cashier:"कैशियर", Waiter:"वेटर", Cook:"रसोइया", Staff:"कर्मचारी"}[s.role] || "कर्मचारी") : s.role}
                            </span>
                          </div>
                        ))}
                        {shifts.filter(s => s.status === "Active").length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                            {tr("वर्तमान में कोई सक्रिय शिफ्ट दर्ज नहीं है।", "No active shifts recorded.")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {selectedLanguage === "hindi" ? "लंच और डिनर में अतिरिक्त मदद रखें" : "Cross-train staff for rush periods"}
                  </span>
                  {setActiveTab && (
                    <button
                      onClick={() => setActiveTab("shifts")}
                      className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>{tr("शिफ्ट सूची देखें", "View shifts")}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* CARD 4: 💡 मुनाफ़ा बढ़ाने व लागत बचत के 3 नुस्खे (Profit Playbook) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-amber-200 transition-all">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Lightbulb className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-base text-slate-900 font-display">
                          {selectedLanguage === "hindi" ? "4. मुनाफ़ा बढ़ाने के मुख्य सुझाव" : selectedLanguage === "hinglish" ? "4. Profit Optimization Tips" : "4. Profit & Menu Playbook"}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {selectedLanguage === "hindi" ? "लागत घटाने और कमाई की समीक्षा के सुझाव" : "High-impact cost reduction & margin hacks"}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                      {tr("लागत की समीक्षा", "Review costs")}
                    </span>
                  </div>

                  {/* 3 Actionable Tips in Selected Language */}
                  <div className="py-3.5 space-y-2.5 text-xs text-slate-700">
                    <div className="p-3 bg-amber-50/50 border border-amber-200/70 rounded-xl flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 block">
                          {selectedLanguage === "hindi"
                            ? `टॉप सेलिंग आइटम (${topItems[0]?.name || tr("मुख्य व्यंजन", "Top dish")}) का मार्जिन बढ़ाएं`
                            : `Top Item (${topItems[0]?.name || tr("मुख्य व्यंजन", "Top dish")}) Margin Boost`}
                        </span>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {selectedLanguage === "hindi"
                            ? "सबसे ज्यादा बिकने वाले आइटम के मुख्य इंग्रीडिएंट्स का थोक वेंडर रेट 10-15 दिन का फिक्स कराएं।"
                            : "Lock weekly wholesale rates for top dish ingredients to retain high gross profit."}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-indigo-50/50 border border-indigo-200/70 rounded-xl flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 block">
                          {selectedLanguage === "hindi" ? "किचन में वेस्टेज और माप पर नियंत्रण" : "Portion & Waste Control"}
                        </span>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {selectedLanguage === "hindi"
                            ? "पनीर, तेल और सूखे मसालों की तौल के अनुसार ग्रेवी बनाएं जिससे बर्बादी 0% हो।"
                            : "Introduce kitchen weighing scales for high-cost ingredients to prevent recipe drift."}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50/50 border border-emerald-200/70 rounded-xl flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </span>
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 block">
                          {selectedLanguage === "hindi" ? "क्यूआर भुगतान और टेबल सेवा" : "Faster Table Turnaround"}
                        </span>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {selectedLanguage === "hindi"
                            ? "टेबल पर भुगतान का क्यूआर स्टिकर रखें, जिससे ग्राहक बिल का इंतजार किए बिना तुरंत पे करके फ्री हो सके।"
                            : "Place UPI QR codes on tables to accelerate dining checkouts and increase seat turnover."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">
                    {selectedLanguage === "hindi" ? "हर हफ़्ते इस ऑडिट की समीक्षा करें" : "Review audit weekly"}
                  </span>
                  <button
                    onClick={() => window.print()}
                    className="text-slate-700 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{tr("प्रिंट रिपोर्ट", "Print report")}</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* FULL DOCUMENT VIEW (Markdown Renderer) */
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">
                  {selectedLanguage === "hindi" ? "विस्तृत एआई विश्लेषण" : selectedLanguage === "hinglish" ? "Complete AI Business Audit" : "Full AI Business Audit"}
                </h3>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{tr("प्रिंट करें", "Print")}</span>
              </button>
            </div>

            {aiReport && generatedLanguage === selectedLanguage ? (
              <div className="prose prose-slate max-w-none text-slate-800 leading-relaxed font-sans text-sm py-2">
                <MarkdownRenderer content={aiReport} />
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs italic">
                {tr("चुनी गई भाषा में रिपोर्ट बनाने के लिए ऊपर का बटन दबाएँ।", "Generate a report in the selected language using the button above.")}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

