import SiteLink from "../components/SiteLink";
import React from "react";
import { MarketingRoute } from "../types";
import {
  Heart,
  ShieldCheck,
  Zap,
  Boxes,
  Users,
  ArrowRight,
  Flame,
  Coffee,
  CheckCircle2
} from "lucide-react";

interface AboutPageProps {
  onNavigate: (route: MarketingRoute) => void;
}

export default function AboutPage({ onNavigate }: AboutPageProps) {
  const principles = [
    {
      number: "01",
      title: "Respect the Rush",
      description:
        "Restaurant service comes first: clear orders, kitchen progress, stock records and staff access that your team can understand."
    },
    {
      number: "02",
      title: "Know what goes into each dish",
      description:
        "On eligible plans, enter measured recipes, purchases and stock counts to understand ingredient use. Your reports depend on the quantities and records you enter."
    },
    {
      number: "03",
      title: "Owner Freedom Through Clear Data",
      description:
        "Give each staff member their own PIN and the screens they need. Review sales and staff activity, then compare recorded payments with the cash and UPI money actually received."
    },
    {
      number: "04",
      title: "Check the Whole Setup",
      description:
        "Try Aatmyam Pos on the phone, tablet or computer you plan to use, and print a receipt with your chosen printer and paper size. We can review your setup during an early-access demo."
    }
  ];

  return (
    <div className="bg-[#FBF9F5] text-[#1C1E1B] min-h-screen">

      {/* 1. ABOUT HERO */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[#EAE5DA]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF2E4] border border-[#D5E3C8] text-xs font-mono font-bold text-[#567234]">
            <Heart className="w-3.5 h-3.5 text-[#6E8F45]" />
            <span>About Aatmyam Pos</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[#181A18] leading-[1.12]">
            Restoring calm to the <br />
            <span className="text-[#6E8F45] italic">hardest working room</span> in hospitality.
          </h1>
          <p className="text-base sm:text-lg text-[#5A6056] leading-relaxed">
            Aatmyam Pos is early-access software for independent restaurants and cafés in India. It brings orders, kitchen progress, bills, ingredients and staff access into one place, with one outlet for each restaurant account.
          </p>
        </div>
      </section>

      {/* 2. FOUNDING STORY & POINT OF VIEW */}
      <section className="py-20 border-b border-[#EAE5DA]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-4 space-y-2">
              <span className="text-xs font-mono uppercase text-[#567234] font-bold">
                OUR POINT OF VIEW
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#181A18]">
                Hospitality is craft. Software should be quiet.
              </h2>
            </div>

            <div className="md:col-span-8 space-y-4 text-xs sm:text-sm text-[#5A6056] leading-relaxed">
              <p>
                An independent outlet needs a clear way to pass orders from the counter to the kitchen and review the resulting records. The people working each stage should understand which actions are theirs.
              </p>
              <p>
                Our focus is the work your team does every day: taking orders, keeping the kitchen informed, checking stock and giving staff the right access. See Product and Pricing for the features and allowances currently available.
              </p>
              <p>
                A walkthrough is an opportunity to check your menu, order volume and devices against the current product. Early access means confirming the setup and limitations before relying on it during service.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 3. CORE OPERATING PRINCIPLES */}
      <section className="py-20 bg-[#F4F0E8] border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-[#567234] font-bold">
              Guiding Principles
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#181A18] tracking-tight">
              Four priorities for your restaurant’s daily work.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {principles.map((p) => (
              <div
                key={p.number}
                className="bg-[#FBF9F5] p-8 rounded-3xl border border-[#EAE5DA] space-y-4 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-[#EBF2E4] text-[#567234]">
                    PRINCIPLE {p.number}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#6E8F45]"></span>
                </div>
                <h3 className="font-serif text-2xl font-bold text-[#181A18]">
                  {p.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#5A6056] leading-relaxed">
                  {p.description}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 4. TEAM & PROMISE CTA */}
      <section className="py-20 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <h2 className="font-serif text-3xl sm:text-4xl text-[#181A18] tracking-tight">
            See the calm difference on your own floor.
          </h2>
          <p className="text-sm text-[#5A6056] leading-relaxed">
            See how your team can take orders, follow kitchen progress, prepare bills and check stock. Book a demo with the Aatmyam Pos team.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <SiteLink
              href="/contact" onNavigate={() => onNavigate("/contact")}
              className="inline-flex items-center justify-center px-7 py-3.5 text-sm font-bold text-[#FBF9F5] bg-[#181A18] hover:bg-[#6E8F45] rounded-xl transition duration-200 shadow-md cursor-pointer border border-[#2E332D]"
            >
              Book a restaurant demo
            </SiteLink>
            <SiteLink
              href="/solutions" onNavigate={() => onNavigate("/solutions")}
              className="inline-flex items-center justify-center px-6 py-3.5 text-sm font-bold text-[#181A18] bg-[#F4F0E8] hover:bg-[#EAE5DA] rounded-xl border border-[#EAE5DA] transition cursor-pointer"
            >
              Find your restaurant type
            </SiteLink>
          </div>
        </div>
      </section>

    </div>
  );
}
