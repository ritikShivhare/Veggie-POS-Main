import React from "react";
import { ArrowRight, BookOpen, Download } from "lucide-react";
import { MARKETING_GUIDES, guideReadTime, type MarketingGuide } from "../../../../shared/marketing-guides";
import { PLAN_LIMITS } from "../../../../shared/planCatalog";
import type { MarketingRoute } from "../types";
import SiteLink from "../components/SiteLink";

interface Props { guide: MarketingGuide; onNavigate: (route: MarketingRoute) => void; }

export default function GuidePage({ guide, onNavigate }: Props) {
  const updated = new Date(guide.updatedAt + "T00:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Calcutta"
  });
  return (
    <div className="bg-[#FBF9F5] text-[#1C1E1B] min-h-screen">
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[#EAE5DA]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-xs text-[#567234]">
            <SiteLink href="/" onNavigate={() => onNavigate("/")}>Home</SiteLink><span aria-hidden="true">/</span>
            <SiteLink href="/resources" onNavigate={() => onNavigate("/resources")}>Resources</SiteLink><span aria-hidden="true">/</span>
            <span aria-current="page">{guide.label}</span>
          </nav>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF2E4] border border-[#D5E3C8] text-xs font-mono font-bold text-[#567234]">
            <BookOpen className="w-3.5 h-3.5" /><span>{guide.label}</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[#181A18] leading-[1.12]">{guide.title}</h1>
          <p className="text-base sm:text-lg text-[#5A6056] leading-relaxed">{guide.summary}</p>
          <p className="text-xs font-mono text-[#787F74]">By Aatmyam POS · Updated <time dateTime={guide.updatedAt}>{updated}</time> · {guideReadTime(guide)}</p>
        </div>
      </section>
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        <div className="p-5 bg-[#EBF2E4] border border-[#D5E3C8] rounded-2xl text-sm text-[#2E4A1C] leading-relaxed">
          <p className="font-mono text-xs font-bold mb-2">KEY TAKEAWAY</p><p>{guide.takeaway}</p>
        </div>
        {guide.path === "/resources/restaurant-pos-cost-guide" && (
          <section className="space-y-4" aria-labelledby="published-plan-prices">
            <h2 id="published-plan-prices" className="font-serif text-2xl sm:text-3xl text-[#181A18]">Published Aatmyam plans for one outlet</h2>
            <div className="overflow-x-auto rounded-2xl border border-[#EAE5DA]">
              <table className="w-full text-left text-xs sm:text-sm">
                <caption className="sr-only">Software prices and allowances per 30-day cycle</caption>
                <thead className="bg-[#F4F0E8]"><tr>{["Plan", "Price / 30 days", "Active staff", "Order allowance"].map(label => <th key={label} scope="col" className="px-4 py-3 font-bold">{label}</th>)}</tr></thead>
                <tbody>{Object.values(PLAN_LIMITS).map(plan => <tr key={plan.label} className="border-t border-[#EAE5DA]">
                  <th scope="row" className="px-4 py-3 font-semibold">{plan.label}</th>
                  <td className="px-4 py-3">₹{plan.price.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">Owner + {plan.staffCount}</td>
                  <td className="px-4 py-3">{plan.monthlyOrders < 0 ? "Unlimited (fair use)" : plan.monthlyOrders}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <SiteLink href="/pricing" onNavigate={() => onNavigate("/pricing")} className="inline-flex text-sm font-semibold text-[#567234] underline">Review features, trial and current plan details</SiteLink>
          </section>
        )}
        {guide.sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`guide-section-${index}`} className="space-y-4">
            <h2 id={`guide-section-${index}`} className="font-serif text-2xl sm:text-3xl text-[#181A18]">{section.title}</h2>
            {section.paragraphs.map(paragraph => <p key={paragraph} className="text-sm sm:text-base text-[#5A6056] leading-relaxed">{paragraph}</p>)}
            {section.steps && <ol className="list-decimal pl-6 space-y-3 text-sm sm:text-base text-[#5A6056] leading-relaxed">{section.steps.map(step => <li key={step}>{step}</li>)}</ol>}
            {section.table && <div className="overflow-x-auto rounded-2xl border border-[#EAE5DA]">
              <table className="w-full text-left text-xs sm:text-sm">
                <caption className="sr-only">{section.title}</caption>
                <thead className="bg-[#F4F0E8]"><tr>{section.table.headings.map(heading => <th key={heading} scope="col" className="px-4 py-3 font-bold">{heading}</th>)}</tr></thead>
                <tbody>{section.table.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-[#EAE5DA]">{row.map((cell, cellIndex) => cellIndex === 0
                  ? <th key={cellIndex} scope="row" className="px-4 py-3 font-semibold">{cell}</th>
                  : <td key={cellIndex} className="px-4 py-3 text-[#5A6056]">{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>}
          </section>
        ))}
        {guide.path === "/resources/restaurant-food-cost-calculation" && <div className="p-6 rounded-2xl bg-[#F4F0E8] border border-[#EAE5DA] space-y-3">
          <h2 className="font-serif text-2xl text-[#181A18]">Try the example in a spreadsheet</h2>
          <p className="text-sm text-[#5A6056] leading-relaxed">Download an editable CSV with the illustrative inputs above and serving-cost formulas. Replace the sample prices and quantities with your records.</p>
          <a href="/restaurant-recipe-cost-template.csv" download className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#181A18] text-[#FBF9F5] text-sm font-bold"><Download className="w-4 h-4" />Download recipe-cost CSV</a>
        </div>}
        <section className="pt-8 border-t border-[#EAE5DA] space-y-4">
          <h2 className="font-serif text-2xl text-[#181A18]">Continue reading</h2>
          <ul className="space-y-3 text-sm">{guide.related.map(path => {
            const related = MARKETING_GUIDES.find(item => item.path === path)!;
            return <li key={path}><SiteLink href={path} onNavigate={() => onNavigate(path)} className="text-[#567234] underline">{related.title}</SiteLink></li>;
          })}</ul>
        </section>
        <div className="p-6 sm:p-8 bg-[#181A18] rounded-3xl border border-[#2E332D] text-[#FBF9F5] space-y-4">
          <h2 className="font-serif text-2xl">See the current workflow for your outlet</h2>
          <p className="text-sm text-[#A6AEA0] leading-relaxed">Aatmyam POS is in early access. Bring your menu, order volume and device requirements to a walkthrough so you can check product fit.</p>
          <SiteLink href="/contact" onNavigate={() => onNavigate("/contact")} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#6E8F45] text-[#FBF9F5] text-sm font-bold">Book a walkthrough<ArrowRight className="w-4 h-4" /></SiteLink>
        </div>
      </article>
    </div>
  );
}
