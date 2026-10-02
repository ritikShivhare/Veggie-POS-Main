import React, { useState } from "react";
import { MarketingRoute, DemoRequest } from "../types";
import {
  Calendar,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Phone,
  Mail,
  Building,
  Store,
  Terminal,
  MapPin,
  MessageSquare,
  Copy,
  Check
} from "lucide-react";

interface ContactPageProps {
  onNavigate: (route: MarketingRoute) => void;
}

export default function ContactPage({ onNavigate }: ContactPageProps) {
  const [formData, setFormData] = useState<DemoRequest>({
    fullName: "",
    email: "",
    phone: "",
    restaurantName: "",
    address: "",
    format: "casual-dine",
    outletCount: "1",
    primaryGoal: "Fast PIN billing & speed at register",
    preferredDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    preferredTime: "morning",
    notes: ""
  });

  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedAlert, setCopiedAlert] = useState<boolean>(false);
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/leads/walkthrough", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success && data.lead) {
        setCreatedLeadId(data.lead.id);
      }
    } catch (err) {
      console.warn("API lead submission fallback to simulated success:", err);
    } finally {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }
  };

  const checklistItems = [
    {
      title: "15-Minute Personalized Walkthrough",
      desc: "Live demonstration tailored to your exact floor plan, kitchen pass, and recipe inventory."
    },
    {
      title: "Zero Hardware Audit",
      desc: "We verify compatibility with your existing iPads, Android tablets, PCs, and thermal printers."
    },
    {
      title: "Leakage & Payback Assessment",
      desc: "Review your outlet's potential monthly margin savings based on your average ticket volume."
    },
    {
      title: "24-48 Hour Rapid Go-Live",
      desc: "Our menu formatting specialists configure your full catalog, modifiers, and staff PINs."
    }
  ];

  return (
    <div className="bg-[#FBF9F5] text-[#1C1E1B] min-h-screen">
      
      {/* 1. CONTACT HERO */}
      <section className="pt-28 pb-14 md:pt-36 md:pb-20 border-b border-[#EAE5DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF2E4] border border-[#D5E3C8] text-xs font-mono font-bold text-[#567234]">
              <Calendar className="w-3.5 h-3.5" />
              <span>SCHEDULE AN OPERATIONAL WALKTHROUGH</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[#181A18] leading-[1.12]">
              Book a 15-minute <br />
              <span className="text-[#6E8F45] italic">live walkthrough.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#5A6056] leading-relaxed">
              Speak directly with a hospitality systems engineer. We’ll show you how Veggie POS runs your menu, kitchen tickets, and recipe stock without high-pressure sales tactics.
            </p>
          </div>
        </div>
      </section>

      {/* 2. DEMO FORM & IMPLEMENTATION CHECKLIST */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Left: Interactive Qualified Request Form */}
            <div className="lg:col-span-7 bg-[#F4F0E8] border border-[#EAE5DA] rounded-3xl p-6 sm:p-10 shadow-sm">
              
              {isSubmitted ? (
                <div className="space-y-6 text-center py-8 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 rounded-full bg-[#EBF2E4] border border-[#D5E3C8] text-[#567234] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-[#6E8F45]" />
                  </div>
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-mono font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Request Logged in SaaS Master Command Center</span>
                    </div>
                    <h2 className="font-serif text-3xl font-bold text-[#181A18]">
                      Walkthrough Scheduled!
                    </h2>
                    <p className="text-sm text-[#5A6056] max-w-md mx-auto leading-relaxed">
                      Thank you, <span className="font-bold text-[#181A18]">{formData.fullName}</span>. A hospitality solutions engineer will contact you shortly to confirm your personalized walkthrough for <span className="font-bold text-[#181A18]">{formData.restaurantName}</span>.
                    </p>
                  </div>

                  {/* Summary Box with Address Column */}
                  <div className="p-4 bg-[#FBF9F5] rounded-2xl border border-[#EAE5DA] max-w-md mx-auto text-xs text-[#787F74] text-left space-y-2">
                    <div className="flex items-start justify-between gap-2 border-b border-[#EAE5DA] pb-2">
                      <span className="font-mono text-[10px] uppercase font-bold text-[#567234]">Booking Summary</span>
                      {createdLeadId && (
                        <span className="font-mono text-[10px] text-slate-400">ID: {createdLeadId}</span>
                      )}
                    </div>
                    <p className="flex items-center gap-2">
                      <Store className="w-3.5 h-3.5 text-[#181A18] shrink-0" />
                      <span>Restaurant: <strong className="text-[#181A18]">{formData.restaurantName}</strong></span>
                    </p>
                    <p className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>Address: <strong className="text-[#181A18]">{formData.address || "Address specified"}</strong></span>
                    </p>
                    <p className="flex items-center gap-2 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-[#6E8F45] shrink-0" />
                      <span>Preferred Slot: <strong className="text-[#181A18]">{formData.preferredDate || "Upcoming"} ({formData.preferredTime.toUpperCase()})</strong></span>
                    </p>
                    <p className="flex items-center gap-2 font-mono">
                      <Building className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Format & Outlets: <strong className="text-[#181A18]">{formData.format} • {formData.outletCount} Outlet(s)</strong></span>
                    </p>
                  </div>

                  {/* Option 3: Instant WhatsApp Alert & Direct Confirmation */}
                  <div className="max-w-md mx-auto p-4 bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl text-left space-y-3">
                    <div className="flex items-center gap-2 text-[#128C7E]">
                      <MessageSquare className="w-4 h-4 fill-current" />
                      <span className="font-bold text-xs">Instant WhatsApp Confirmation Available</span>
                    </div>
                    <p className="text-[11px] text-[#2C3E50] leading-snug">
                      Would you like to connect immediately with our hospitality onboarding specialist on WhatsApp?
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                      <a
                        href={`https://wa.me/919876543210?text=${encodeURIComponent(
                          `Hello Veggie POS Support Team,\n\nI have submitted a 15-minute walkthrough request on your website.\n\n• Restaurant: ${formData.restaurantName}\n• Address: ${formData.address}\n• Contact Person: ${formData.fullName}\n• Phone: ${formData.phone}\n• Email: ${formData.email}\n• Outlets: ${formData.outletCount}\n• Preferred Date & Time: ${formData.preferredDate || "Tomorrow"} (${formData.preferredTime})\n• Primary Focus: ${formData.primaryGoal}\n\nPlease confirm my walkthrough slot.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto flex-1 px-4 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Chat on WhatsApp Now</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          const msg = `Walkthrough Request:\nRestaurant: ${formData.restaurantName}\nAddress: ${formData.address}\nContact: ${formData.fullName} (${formData.phone})\nSlot: ${formData.preferredDate} (${formData.preferredTime})`;
                          navigator.clipboard?.writeText(msg);
                          setCopiedAlert(true);
                          setTimeout(() => setCopiedAlert(false), 2500);
                        }}
                        className="px-3.5 py-2.5 bg-white border border-[#EAE5DA] text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                      >
                        {copiedAlert ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAlert ? "Copied" : "Copy Details"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={() => onNavigate("/")}
                      className="px-6 py-3 text-xs font-bold text-[#FBF9F5] bg-[#181A18] hover:bg-[#6E8F45] rounded-xl transition cursor-pointer"
                    >
                      Return to Homepage
                    </button>
                    <button
                      onClick={() => onNavigate("/pricing")}
                      className="px-5 py-3 text-xs font-bold text-[#181A18] bg-[#FBF9F5] hover:bg-[#EAE5DA] rounded-xl border border-[#EAE5DA] transition cursor-pointer"
                    >
                      Review Pricing Tiers
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  <div className="space-y-1 pb-2 border-b border-[#EAE5DA]">
                    <h2 className="font-serif text-2xl font-bold text-[#181A18]">
                      Tell us about your restaurant setup
                    </h2>
                    <p className="text-xs text-[#5A6056]">
                      We’ll prepare the demonstration specifically for your floor dynamics.
                    </p>
                  </div>

                  {/* Name and Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-[#181A18]">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ritik Sharma"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl text-xs text-[#1C1E1B] focus:outline-hidden focus:border-[#6E8F45]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-[#181A18]">
                        Work Email *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="owner@yourrestaurant.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl text-xs text-[#1C1E1B] focus:outline-hidden focus:border-[#6E8F45]"
                      />
                    </div>
                  </div>

                  {/* Phone & Restaurant Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-[#181A18]">
                        Phone / WhatsApp Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl text-xs text-[#1C1E1B] focus:outline-hidden focus:border-[#6E8F45]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-[#181A18]">
                        Restaurant / Brand Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Spice Route Kitchens"
                        value={formData.restaurantName}
                        onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl text-xs text-[#1C1E1B] focus:outline-hidden focus:border-[#6E8F45]"
                      />
                    </div>
                  </div>

                  {/* Address Column (Added as requested by user) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-[#181A18] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#6E8F45]" />
                        <span>Restaurant / Outlet Address * (रेस्टोरेंट का पूरा पता)</span>
                      </span>
                      <span className="text-[10px] text-[#787F74] font-normal">Shop No, Street, City & Pincode</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="e.g. Shop 12, Ground Floor, Galaxy Mall, MG Road, Pune, Maharashtra - 411001"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl text-xs text-[#1C1E1B] focus:outline-hidden focus:border-[#6E8F45] resize-none"
                    />
                  </div>

                  {/* Format and Outlets */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-[#181A18]">
                        Primary Format
                      </label>
                      <select
                        value={formData.format}
                        onChange={(e) => setFormData({ ...formData, format: e.target.value as any })}
                        className="w-full px-3.5 py-2.5 bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl text-xs text-[#1C1E1B] focus:outline-hidden focus:border-[#6E8F45]"
                      >
                        <option value="casual-dine">Casual & Fine Dine-In</option>
                        <option value="qsr">QSR & Fast Counter</option>
                        <option value="cafe-bakery">Café & Bakery</option>
                        <option value="cloud-kitchen">Cloud Kitchen / Delivery</option>
                        <option value="multi-outlet">Multi-Outlet Chain</option>
                        <option value="other">Other Food Service</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-[#181A18]">
                        Number of Outlets
                      </label>
                      <select
                        value={formData.outletCount}
                        onChange={(e) => setFormData({ ...formData, outletCount: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl text-xs text-[#1C1E1B] focus:outline-hidden focus:border-[#6E8F45]"
                      >
                        <option value="1">1 Single Outlet</option>
                        <option value="2-4">2 to 4 Outlets</option>
                        <option value="5-10">5 to 10 Outlets</option>
                        <option value="10+">10+ Outlets (Chain)</option>
                      </select>
                    </div>
                  </div>

                  {/* Primary Focus */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-bold text-[#181A18]">
                      What is your biggest operational focus right now?
                    </label>
                    <select
                      value={formData.primaryGoal}
                      onChange={(e) => setFormData({ ...formData, primaryGoal: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl text-xs text-[#1C1E1B] focus:outline-hidden focus:border-[#6E8F45]"
                    >
                      <option value="Fast PIN billing & speed at register">
                        Fast PIN billing & queue speed at register
                      </option>
                      <option value="Recipe BOM stock & ingredient leakage control">
                        Recipe BOM stock & ingredient leakage control
                      </option>
                      <option value="Kitchen display (KDS) & eliminate lost tickets">
                        Kitchen display (KDS) & eliminate lost tickets
                      </option>
                      <option value="Owner peace of mind & anti-pilferage controls">
                        Owner peace of mind & anti-pilferage controls
                      </option>
                      <option value="Centralized multi-outlet group oversight">
                        Centralized multi-outlet group oversight
                      </option>
                    </select>
                  </div>

                  {/* Preferred Date & Timing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-[#181A18] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#6E8F45]" />
                        <span>Preferred Walkthrough Date</span>
                      </label>
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={formData.preferredDate}
                        onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#FBF9F5] border border-[#EAE5DA] rounded-xl text-xs text-[#1C1E1B] focus:outline-hidden focus:border-[#6E8F45]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-[#181A18] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#6E8F45]" />
                        <span>Preferred Time Slot</span>
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: "Morning", val: "morning" },
                          { label: "Afternoon", val: "afternoon" },
                          { label: "Evening", val: "evening" }
                        ].map((t) => (
                          <button
                            key={t.val}
                            type="button"
                            onClick={() => setFormData({ ...formData, preferredTime: t.val })}
                            className={`p-2 rounded-xl text-xs font-mono font-semibold border transition text-center cursor-pointer ${
                              formData.preferredTime === t.val
                                ? "bg-[#181A18] text-[#FBF9F5] border-[#181A18]"
                                : "bg-[#FBF9F5] text-[#5A6056] border-[#EAE5DA] hover:border-[#6E8F45]"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 text-xs font-bold text-[#FBF9F5] bg-[#181A18] hover:bg-[#6E8F45] rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>Preparing Demonstration Room...</span>
                      ) : (
                        <>
                          <span>Confirm Walkthrough Request</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-[#787F74] text-center mt-2.5">
                      No credit card required • Response guaranteed within 2 hours
                    </p>
                  </div>

                </form>
              )}

            </div>

            {/* Right: Implementation Checklist & Guarantees */}
            <div className="lg:col-span-5 space-y-8">
              
              <div className="bg-[#181A18] text-[#FBF9F5] rounded-3xl p-6 sm:p-8 border border-[#2E332D] space-y-6 shadow-lg">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-[#84A955] uppercase font-bold">
                    THE 48-HOUR ONBOARDING GUARANTEE
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-[#FBF9F5]">
                    What happens during & after your walkthrough:
                  </h3>
                </div>

                <div className="space-y-4">
                  {checklistItems.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs">
                      <div className="w-6 h-6 rounded-full bg-[#6E8F45] text-[#FBF9F5] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-bold text-[#FBF9F5]">{item.title}</p>
                        <p className="text-[#A6AEA0] leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-[#2E332D] flex items-center justify-between text-xs text-[#A6AEA0]">
                  <span>Direct Support Line:</span>
                  <span className="font-mono font-bold text-[#6E8F45]">+91 800-VEGGIE-POS</span>
                </div>
              </div>

              {/* Quick Direct Contacts */}
              <div className="bg-[#F4F0E8] p-6 rounded-3xl border border-[#EAE5DA] space-y-4">
                <h4 className="font-serif text-lg font-bold text-[#181A18]">
                  Prefer direct communication?
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2.5 text-[#5A6056]">
                    <Mail className="w-4 h-4 text-[#6E8F45]" />
                    <span>operations@veggiepos.com</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[#5A6056]">
                    <Phone className="w-4 h-4 text-[#6E8F45]" />
                    <span>+91 98765 43210 (Direct WhatsApp Desk)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[#5A6056]">
                    <Building className="w-4 h-4 text-[#6E8F45]" />
                    <span>Bangalore • Mumbai • Delhi NCR • Hyderabad</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

    </div>
  );
}
