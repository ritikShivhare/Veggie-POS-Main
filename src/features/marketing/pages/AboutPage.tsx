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
        "When 40 orders hit the kitchen at 8:30 PM, software must never hesitate. Every screen transition, modifier tap, and KOT dispatch in Veggie POS is optimized for sub-100ms response times. We build for the floor, not the boardroom."
    },
    {
      number: "02",
      title: "Every Gram Accounts for Profit",
      description:
        "Restaurants don't fail from lack of passion; they fail from untracked ingredient leakage and portion creep. By linking raw materials to live recipes (BOM), we turn inventory from a stressful monthly chore into an automatic daily margin protector."
    },
    {
      number: "03",
      title: "Owner Freedom Through Clear Data",
      description:
        "You shouldn't have to stand over the cash register for 14 hours a day just to trust your daily reconciliation. Role-based PIN security, cash drawer pop logs, and live mobile reports give owners complete operational peace of mind from anywhere."
    },
    {
      number: "04",
      title: "Zero Hardware Traps",
      description:
        "We reject proprietary $2,000 POS hardware leases and forced credit card processor lock-ins. Veggie POS runs cleanly in standard browsers on iPads, Android tablets, laptops, and phones with standard ESC/POS thermal printers."
    }
  ];

  return (
    <div className="bg-[#FBF9F5] text-[#1C1E1B] min-h-screen">
      
      {/* 1. ABOUT HERO */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 border-b border-[#EAE5DA]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF2E4] border border-[#D5E3C8] text-xs font-mono font-bold text-[#567234]">
            <Heart className="w-3.5 h-3.5 text-[#6E8F45]" />
            <span>THE VEGGIE POS MANIFESTO</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[#181A18] leading-[1.12]">
            Restoring calm to the <br />
            <span className="text-[#6E8F45] italic">hardest working room</span> in hospitality.
          </h1>
          <p className="text-base sm:text-lg text-[#5A6056] leading-relaxed">
            Veggie POS was born out of a simple observation: modern restaurant operators are caught between archaic, clunky desktop software from the 1990s and bloated SaaS platforms that take percentage cuts of every order. 
            We set out to build a calm, precise, and transparent operational command center.
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
                Spend an evening in any busy commercial kitchen and you’ll immediately see why generic SaaS design fails. Hands are wet. The pass is loud. Servers are juggling three tables while punching takeaway orders.
              </p>
              <p>
                In that environment, multi-level dropdown menus and delayed sync spinners are unacceptable. Tools must be tactile, fast, and unforgivingly dependable.
              </p>
              <p>
                We built Veggie POS with an editorial Harvest Command aesthetic—subtle warm neutrals, high-contrast typography, and purposeful saffron warning signals. No purple gradients, no flashing notifications, just clean operational visibility.
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
              The four commitments behind every line of code.
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
            Experience how Veggie POS simplifies table service, kitchen lines, and inventory accounting. Schedule a personalized walkthrough with our hospitality team.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => onNavigate("/contact")}
              className="px-7 py-3.5 text-sm font-bold text-[#FBF9F5] bg-[#181A18] hover:bg-[#6E8F45] rounded-xl transition duration-200 shadow-md cursor-pointer border border-[#2E332D]"
            >
              Book an Operational Walkthrough
            </button>
            <button
              onClick={() => onNavigate("/solutions")}
              className="px-6 py-3.5 text-sm font-bold text-[#181A18] bg-[#F4F0E8] hover:bg-[#EAE5DA] rounded-xl border border-[#EAE5DA] transition cursor-pointer"
            >
              Explore Format Solutions
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
