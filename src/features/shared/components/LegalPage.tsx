import SiteLink from "../../marketing/components/SiteLink";
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

          <SiteLink href="/"
            onNavigate={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition mb-6 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Aatmyam Pos</span>
          </SiteLink>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shadow-lg">
              {getPageIcon()}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-pink-400 font-mono">Aatmyam Pos information</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">{getPageTitle()}</h1>
            </div>
          </div>
        </div>

        {/* Document Body */}
        <div className="p-8 sm:p-12 prose prose-slate max-w-none text-slate-650 leading-relaxed text-sm space-y-8">
          <div className="text-xs text-slate-400 font-mono flex items-center justify-between pb-4 border-b border-slate-100">
            <span>Updated: {page === "privacy" ? "November 28, 2026" : "November 12, 2026"}</span>
            <span>Restaurant account information</span>
          </div>

          {page === "terms" && (
            <div className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">1. Acceptance of Terms</h3>
                <p>
                  Aatmyam Pos is online software for restaurant billing, stock records and staff shifts. By registering for or using Aatmyam Pos, you agree to these Terms of Service. If you do not agree, do not use the service.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">2. Your restaurant account and sign-in details</h3>
                <p>Each restaurant has its own account and records, kept separate from other restaurant accounts. You alone are responsible for keeping the Owner login and individual staff PINs private.</p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">3. User Responsibilities & Operational Use</h3>
                <p>
                  You agree to use Aatmyam Pos only for lawful commercial restaurant operations.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Do not enter false sales, stock or staff-hour records.</li>
                  <li>Do not try to access another restaurant’s information without permission.</li>
                  <li>Do not use Aatmyam Pos for dishonest billing or fraud.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">4. Data export and device storage</h3>
                <p>Find your restaurant’s data tools in Settings → Advanced → Your Data.</p>
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs">Download your records</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">The Owner can use Download data at any time to download a copy of the restaurant’s menu, orders, staff and ingredient records in one file.</p>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs">Clear this device:</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Clear this device removes saved information from this device. It does not delete your restaurant account or the records held by Aatmyam Pos. Contact us to request account deletion. Before clearing the device, reconnect to the internet and check that all recent work has been saved.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">5. Limitation of Liability</h3>
                <p>
                  Aatmyam Pos is provided “as is” and “as available”. We do not promise uninterrupted service, and short maintenance periods may occur. Aatmyam Pos is not liable for indirect, incidental or consequential losses arising from restaurant downtime or ingredient stock discrepancies.
                </p>
              </section>
            </div>
          )}

          {page === "privacy" && (
            <div className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">1. Scope of Privacy Policy</h3>
                <p>
                  This Privacy Policy details how Aatmyam Pos collects, utilizes, and secures data related to your restaurant operations. Your privacy is paramount, and we deploy multi-tenant segmentation to ensure that other business establishments cannot view or query your operational data.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">2. Information We Collect</h3>
                <p>
                  To deliver real-time operational benefits, we collect and store:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li><b>Restaurant details:</b> restaurant name, email address, area and registered Owner’s name.</li>
                  <li><b>Orders and payments:</b> bills, amounts, table numbers, cashier names and the recorded payment method, Cash or UPI.</li>
                  <li><b>Stock and recipes:</b> ingredients, stock counts, chosen low-stock levels, purchase costs and recipe quantities.</li>
                  <li><b>Staff details:</b> active staff lists, protected sign-in details and recorded working hours.</li>
                  <li><b>Guest details:</b> phone numbers and loyalty points entered by your restaurant during billing.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">3. How Your Data is Isolated & Shared</h3>
                <p>
                  Restaurant access is checked by the application server. Hosting and database providers process stored records; configured email services send verification messages. If enabled, AI providers process submitted chat or report data. Contact the service operator for information about the providers enabled for your account.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">4. Data access and deletion requests</h3>
                <p>
                  Available data tools include:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl">
                    <h4 className="font-bold text-slate-800 text-xs">Download your restaurant records</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      The Owner can use Download data in Settings → Advanced → Your Data to download the restaurant’s order, staff, guest and ingredient records in one file.
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl">
                    <h4 className="font-bold text-slate-800 text-xs">Deletion requests</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Contact us to request deletion of your restaurant’s records. Clear this device only removes information saved on that device. Some financial records may need to be retained.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">5. Security Standards</h3>
                <p>
                  We protect restaurant accounts with sign-in checks, staff permissions and separate access for each restaurant. These safeguards are intended to prevent unauthorised access or information being shown to the wrong restaurant.
                </p>
              </section>
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">6. Website visit statistics</h3>
                <p>
                  If you allow website statistics, Google Analytics helps us count visits and understand which public pages people read. Google processes these statistics. Restaurant bills, customer details, staff PINs and signed-in screens are not included. You can choose No thanks or change your choice using Privacy choices on the public website. Your choice does not affect access to the restaurant software.
                </p>
              </section>
            </div>
          )}

          {page === "refund-policy" && (
            <div className="space-y-6">
              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">1. Your 30-day subscription</h3>
                <p>
                  Each paid plan covers one outlet for 30 days. Paid access starts after your payment is confirmed. In Billing, you can check your plan, order allowance, subscription dates and expiry.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">2. Refund Terms & 3-Day Guarantee</h3>
                <p>
                  If Aatmyam Pos does not suit your restaurant’s billing needs, or a problem with the app affects its use, you may request a refund under the conditions below.
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li><b>Guarantee Window:</b> Refund requests must be raised with the service operator within <b>3 calendar days</b> of your initial paid activation.</li>
                  <li><b>Proof of Operational Incompatibility:</b> A brief explanation of the incompatibility helps us continuously refine our features.</li>
                  <li><b>Processing:</b> Approved refunds will be processed back to the original UPI, card, or banking payment source within 5 to 7 business days.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">3. Subscription Cancellation</h3>
                <p>
                  Aatmyam Pos does not automatically charge you for another paid period. To stop renewing, do not buy another 30-day period. Check Billing for the expiry of your current paid access.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Another paid period starts only after a new payment is confirmed.</li>
                  <li>Your current plan remains available until its shown expiry, subject to the plan’s limits.</li>
                  <li>Before stopping renewal, use Download data in Settings → Advanced → Your Data to keep a copy of your restaurant records.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">4. Exceptional Circumstances</h3>
                <p>
                  Refunds are not granted for subscription periods that have already been fully used, or where misuse, such as trying to bypass account access restrictions, is identified.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>© 2026 Aatmyam Pos. All Rights Reserved.</span>
          <button
            onClick={onBack}
            className="text-pink-600 hover:text-pink-700 font-bold hover:underline transition cursor-pointer"
          >
            Back to Aatmyam Pos
          </button>
        </div>
      </div>
    </div>
  );
}
