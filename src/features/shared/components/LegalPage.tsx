import React from "react";
import { Shield, FileText, RefreshCw, ArrowLeft, CheckCircle } from "lucide-react";

interface LegalPageProps {
  page: "terms" | "privacy" | "refund-policy";
  onBack: () => void;
}

export default function LegalPage({ page, onBack }: LegalPageProps) {
  const getPageTitle = () => {
    switch (page) {
      case "terms":
        return "Terms of Service";
      case "privacy":
        return "Privacy Policy";
      case "refund-policy":
        return "Refund & Cancellation Policy";
      default:
        return "Legal Document";
    }
  };

  const getPageIcon = () => {
    switch (page) {
      case "terms":
        return <FileText className="w-6 h-6 text-pink-600" />;
      case "privacy":
        return <Shield className="w-6 h-6 text-pink-600" />;
      case "refund-policy":
        return <RefreshCw className="w-6 h-6 text-pink-600" />;
      default:
        return <FileText className="w-6 h-6 text-pink-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden">
        {/* Banner */}
        <div className="relative bg-slate-900 text-white p-8 sm:p-12 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20" />
          
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition mb-6 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to VeggiePOS</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shadow-lg">
              {getPageIcon()}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-pink-400 font-mono">VeggiePOS Compliance</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">{getPageTitle()}</h1>
            </div>
          </div>
        </div>

        {/* Document Body */}
        <div className="p-8 sm:p-12 prose prose-slate max-w-none text-slate-650 leading-relaxed text-sm space-y-8">
          <div className="text-xs text-slate-400 font-mono flex items-center justify-between pb-4 border-b border-slate-100">
            <span>Effective Date: July 3, 2026</span>
            <span>Version 1.2 • GDPR Compliant</span>
          </div>

          {page === "terms" && (
            <div className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">1. Acceptance of Terms</h3>
                <p>
                  Welcome to VeggiePOS (the "Service"), a multi-tenant software-as-a-service application designed for billing, inventory, and staff shift scheduling. By registering for or using any portion of VeggiePOS, you ("User", "Tenant", or "Owner") agree to be bound by these Terms of Service. If you do not agree, please do not access or use the Service.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">2. Multi-Tenant Service & Account Security</h3>
                <p>
                  VeggiePOS isolates data utilizing advanced multi-tenant technology. Each restaurant is assigned a unique <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded text-xs font-mono">Tenant ID</code>. You are solely responsible for maintaining the confidentiality of your administrative credentials, including your 5-digit Owner PIN passcode and any employee 4-digit PINs.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">3. User Responsibilities & Operational Use</h3>
                <p>
                  You agree to use VeggiePOS only for lawful commercial restaurant operations. You will not:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Incorporate false transaction histories, fake inventory records, or fake staff hours;</li>
                  <li>Circumvent multi-tenant boundaries to attempt to gain unauthorized access to other tenants' data matrices;</li>
                  <li>Utilize the Service for fraudulent checkout operations or billing deceptions.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">4. GDPR & Data Portability Compliance</h3>
                <p>
                  We are committed to data autonomy and standard user privacy safeguards (such as GDPR). In alignment with these principles, VeggiePOS provides direct self-service tools inside the <b>Rules Settings Panel</b>:
                </p>
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs">Self-Service Portability:</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      You can use the <b>"Export My Data"</b> button at any time to instantly download a comprehensive JSON file containing all your menu items, transaction logs, active staff registers, and raw inventory matrices.
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs">Self-Service Deletion ("Right to Be Forgotten"):</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      You can use the <b>"Delete My Account"</b> button to permanently and irreversibly erase all data assets associated with your Tenant ID from the VeggiePOS live system memory and local storage arrays.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">5. Limitation of Liability</h3>
                <p>
                  VeggiePOS is provided on an "as-is" and "as-available" basis. We do not warrant that the Service will be completely uninterrupted or free of brief maintenance updates. Under no circumstances shall VeggiePOS be liable for indirect, incidental, or consequential damages resulting from restaurant down-times or ingredient stock discrepancies.
                </p>
              </section>
            </div>
          )}

          {page === "privacy" && (
            <div className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">1. Scope of Privacy Policy</h3>
                <p>
                  This Privacy Policy details how VeggiePOS collects, utilizes, and secures data related to your restaurant operations. Your privacy is paramount, and we deploy multi-tenant segmentation to ensure that other business establishments cannot view or query your operational data.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">2. Information We Collect</h3>
                <p>
                  To deliver real-time operational benefits, we collect and store:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li><b>Business Context:</b> Restaurant store name, email address, physical region, and registered owner name.</li>
                  <li><b>Transactional POS Records:</b> Order checkouts, total price tallies, table numbers, cashier names, and selected payment methods (UPI/Cash).</li>
                  <li><b>Raw Supply Records:</b> Ingredient ledger items, stock counts, minimum thresholds, purchase costs, and recipe mapping formulas.</li>
                  <li><b>Workforce Clock Records:</b> Active staff lists, 4-digit logins, and working hour logs to track coverage.</li>
                  <li><b>CRM Information:</b> Customer telephone numbers and loyalty point records explicitly entered during POS billing checkouts.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">3. How Your Data is Isolated & Shared</h3>
                <p>
                  Your data is strictly restricted to your account utilizing a segregated database architecture. <b>We never rent, sell, or share your transactional database logs, inventory numbers, or customer contact records with any third-party advertisers or external services.</b>
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">4. GDPR Self-Service Privacy Protections</h3>
                <p>
                  Under international privacy conventions (including GDPR), business operators have specific rights regarding their operational footprints. We support:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl">
                    <h4 className="font-bold text-slate-800 text-xs">Right of Access (Portability)</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Download a structured machine-readable JSON package containing all transactional, staff roster, customer database, and raw material ledgers under your Tenant ID.
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl">
                    <h4 className="font-bold text-slate-800 text-xs">Right to Erasure (Forgotten)</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Instantly purge all inventory profiles, shift timers, order histories, and staff profiles associated with your establishment. This action is final.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">5. Security Standards</h3>
                <p>
                  We maintain strict security safeguards, including isolated browser state contexts, secured sessions, and multi-tenant firewall separations, protecting your terminal systems from external intrusions or accidental cross-establishment leaks.
                </p>
              </section>
            </div>
          )}

          {page === "refund-policy" && (
            <div className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">1. SaaS Subscription Cycle</h3>
                <p>
                  VeggiePOS is offered as a flexible SaaS subscription product billed either monthly or annually. Your subscription commences immediately upon registration and credentials generation.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">2. Refund Terms & 7-Day Guarantee</h3>
                <p>
                  We strive for exceptional quality. If you find VeggiePOS does not meet your restaurant's billing workflows or you experience technical issues, you may request a refund under the following conditions:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li><b>Guarantee Window:</b> Refund requests must be initiated via email within <b>7 calendar days</b> of your initial premium registration.</li>
                  <li><b>Proof of Operational Incompatibility:</b> A brief explanation of the incompatibility helps us continuously refine our features.</li>
                  <li><b>Processing:</b> Approved refunds will be processed back to the original UPI, card, or banking payment source within 5 to 7 business days.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">3. Subscription Cancellation</h3>
                <p>
                  You can cancel your active VeggiePOS account subscription directly from your administrative dashboard or billing section. Once cancelled:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>You will not be billed for subsequent billing cycles;</li>
                  <li>Your terminal will remain active until the end of your current pre-paid cycle;</li>
                  <li>Before cancellation, we recommend downloading your complete operational records using our <b>"Export My Data"</b> tool to maintain historic reports.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">4. Exceptional Circumstances</h3>
                <p>
                  Refunds are not granted for months already fully used or in cases where active operational abuse (e.g., attempt to bypass tenant safeguards) is identified.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>© 2026 VeggiePOS. All Rights Reserved.</span>
          <button
            onClick={onBack}
            className="text-pink-600 hover:text-pink-700 font-bold hover:underline transition cursor-pointer"
          >
            Back to Application Home
          </button>
        </div>
      </div>
    </div>
  );
}
