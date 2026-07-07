import React, { useState, useEffect } from "react";
import { CreditCard, CheckCircle, AlertTriangle, Zap, ArrowRight, Shield, Crown } from "lucide-react";

interface BillingSettingsProps {
  tenantId: string;
}

export function BillingSettings({ tenantId }: BillingSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, [tenantId]);

  // Read URL query parameters to see if we just returned from checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      // Clean query params
      window.history.replaceState({}, document.title, window.location.pathname + "?tab=settings");
      fetchSubscription();
    }
  }, []);

  const fetchSubscription = async () => {
    setLoading(true);
    try {
      const sessId = localStorage.getItem("veggiepos_current_session_id");
      const res = await fetch(`/api/billing/subscription?tenantId=${tenantId}`, {
        headers: {
          "x-session-id": sessId || "",
        }
      });
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (plan: string) => {
    setActionLoading(plan);
    try {
      const sessId = localStorage.getItem("veggiepos_current_session_id");
      const res = await fetch(`/api/billing/create-checkout-session`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-session-id": sessId || ""
        },
        body: JSON.stringify({ tenantId, plan })
      });
      const json = await res.json();
      if (json.success && json.url) {
        window.location.href = json.url;
      } else {
        alert(json.message || "Failed to create checkout session.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePortal = async () => {
    setActionLoading("portal");
    try {
      const sessId = localStorage.getItem("veggiepos_current_session_id");
      const res = await fetch(`/api/billing/create-portal-session`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-session-id": sessId || ""
        },
        body: JSON.stringify({ tenantId })
      });
      const json = await res.json();
      if (json.success && json.url) {
        window.location.href = json.url;
      } else {
        alert(json.message || "Failed to create portal session.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-pulse space-y-4">
        <div className="h-6 w-1/4 bg-slate-200 rounded"></div>
        <div className="h-20 bg-slate-100 rounded"></div>
      </div>
    );
  }

  const { subscription, limits, usage } = data || {};
  const { plan = "free", isReadOnly = false } = subscription || {};

  const safeLimits = {
    staffCount: limits?.staffCount ?? (plan === "pro" ? 10 : plan === "enterprise" ? 100000 : 3),
    monthlyOrders: limits?.monthlyOrders ?? (plan === "pro" ? 500 : plan === "enterprise" ? 100000 : 30)
  };
  const safeUsage = {
    staffCount: usage?.staffCount ?? 0,
    monthlyOrders: usage?.monthlyOrders ?? 0
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Subscription & Stripe Billing
          </h2>
          <p className="text-xs text-slate-500 mt-1">Manage VeggiePOS SaaS plans, limits, and real-time operational usage.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium font-mono">Status:</span>
          {isReadOnly ? (
            <span className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> Read-Only Mode
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Active Account
            </span>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 animate-bounce" />
          <div className="space-y-1">
            <span className="font-bold">Billing Suspension Active!</span>
            <p className="text-rose-600 leading-relaxed">
              Your account has been restricted to <b>Read-Only Mode</b> because your latest payment failed, subscription was canceled, or invoice is past due. To restore POS checkouts and staff additions, please upgrade or click "Manage Billing Portal" to renew.
            </p>
          </div>
        </div>
      )}

      {/* Plan Details & Limits Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Column 1: Quantity-Based Capacity Limits (Quantity Base) */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">1. Quantity-Based Limits</h3>
            <span className="text-[10px] bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full font-mono">Caps</span>
          </div>
          
          <div className="space-y-4">
            {/* Staff Limit */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Staff Members Limit</span>
                <span>{safeUsage.staffCount} / {safeLimits.staffCount >= 10000 ? "∞" : safeLimits.staffCount}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${safeUsage.staffCount >= (safeLimits.staffCount >= 10000 ? Infinity : safeLimits.staffCount) ? 'bg-rose-500' : 'bg-blue-600'}`}
                  style={{ width: `${safeLimits.staffCount >= 10000 ? 0 : Math.min(100, (safeUsage.staffCount / safeLimits.staffCount) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Current team size synced to plan capacity.</p>
            </div>

            {/* Monthly Orders Limit */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Monthly Orders Limit</span>
                <span>{safeUsage.monthlyOrders} / {safeLimits.monthlyOrders >= 10000 ? "∞" : safeLimits.monthlyOrders}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${safeUsage.monthlyOrders >= (safeLimits.monthlyOrders >= 10000 ? Infinity : safeLimits.monthlyOrders) ? 'bg-rose-500' : 'bg-blue-600'}`}
                  style={{ width: `${safeLimits.monthlyOrders >= 10000 ? 0 : Math.min(100, (safeUsage.monthlyOrders / safeLimits.monthlyOrders) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Orders reset dynamically on the first of each month.</p>
            </div>
          </div>
        </div>

        {/* Column 2: Feature-Based Access (Subscription Plan Feature) */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">2. Feature-Based Access</h3>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-mono">Modules</span>
          </div>
          
          <div className="grid grid-cols-1 gap-2 text-[11px]">
            <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="text-slate-700 font-medium">✓ Standard POS Terminal</span>
              <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Unlocked</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
              <span className="text-slate-700 font-medium">✓ Basic Sales Reporting</span>
              <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Unlocked</span>
            </div>
            <div className={`flex items-center justify-between p-2 rounded-lg border ${plan !== "free" ? "bg-white border-slate-100" : "bg-slate-100/40 border-slate-200/30 opacity-60"}`}>
              <span className="text-slate-700 font-medium">Advanced Inventory Control</span>
              {plan !== "free" ? (
                <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Unlocked</span>
              ) : (
                <span className="text-[9px] text-slate-400 font-bold bg-slate-200/60 px-1.5 py-0.5 rounded">Locked</span>
              )}
            </div>
            <div className={`flex items-center justify-between p-2 rounded-lg border ${plan !== "free" ? "bg-white border-slate-100" : "bg-slate-100/40 border-slate-200/30 opacity-60"}`}>
              <span className="text-slate-700 font-medium">Gemini Copilot AI Assist</span>
              {plan !== "free" ? (
                <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Unlocked</span>
              ) : (
                <span className="text-[9px] text-slate-400 font-bold bg-slate-200/60 px-1.5 py-0.5 rounded">Locked</span>
              )}
            </div>
            <div className={`flex items-center justify-between p-2 rounded-lg border ${plan === "enterprise" ? "bg-white border-slate-100" : "bg-slate-100/40 border-slate-200/30 opacity-60"}`}>
              <span className="text-slate-700 font-medium">24/7 Dedicated Support</span>
              {plan === "enterprise" ? (
                <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Unlocked</span>
              ) : (
                <span className="text-[9px] text-slate-400 font-bold bg-slate-200/60 px-1.5 py-0.5 rounded">Locked</span>
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Quick billing gateway card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl p-5 flex flex-col justify-between">
          <div>
            <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400">VeggiePOS SaaS Gateway</span>
            <h4 className="text-sm font-bold capitalize text-white flex items-center gap-1.5 mt-1">
              {plan === "free" ? <Zap className="w-4 h-4 text-amber-400" /> : plan === "pro" ? <Shield className="w-4 h-4 text-blue-400" /> : <Crown className="w-4 h-4 text-purple-400" />}
              {plan} Tier Subscription
            </h4>
            <p className="text-slate-300 text-[11px] mt-1.5 leading-relaxed">
              Your system operations are governed by our Stripe billing policies. If you require higher resource caps, update your tier.
            </p>
          </div>
          {plan !== "free" ? (
            <button
              onClick={handlePortal}
              disabled={actionLoading !== null}
              className="mt-4 w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-2 px-3 rounded-lg text-xs transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer border-none"
            >
              {actionLoading === "portal" ? "Opening Portal..." : "Manage Billing Portal"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="text-[11px] text-slate-400 mt-4 italic">
              Subscribe to a professional plan below to unlock custom limits & portal access.
            </div>
          )}
        </div>
      </div>

      {/* Pricing Comparison Cards */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3.5">Compare Subscription Tiers</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Free Card */}
          <div className={`border rounded-xl p-4 flex flex-col justify-between ${plan === "free" ? "border-blue-500 ring-1 ring-blue-500/30 bg-blue-50/10" : "border-slate-200 bg-white"}`}>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-800">Free Starter</span>
                {plan === "free" && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Active</span>}
              </div>
              <p className="text-sm font-extrabold text-slate-900">₹0 / month</p>
              
              <ul className="text-[11px] text-slate-500 mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-1">✓ 3 Staff Members</li>
                <li className="flex items-center gap-1">✓ 30 Orders / month</li>
                <li className="flex items-center gap-1 text-slate-600">✓ Standard POS UI</li>
                <li className="flex items-center gap-1 text-slate-600">✓ Basic Business Reports</li>
                <li className="flex items-center gap-1 opacity-50">✗ Advanced Inventory</li>
                <li className="flex items-center gap-1 opacity-50">✗ Gemini AI Assist</li>
              </ul>
            </div>
            <button
              disabled
              className="mt-4 w-full border border-slate-200 bg-slate-50 text-slate-400 font-semibold py-1.5 rounded-lg text-xs border-none"
            >
              {plan === "free" ? "Current Plan" : "N/A"}
            </button>
          </div>

          {/* Pro Card */}
          <div className={`border rounded-xl p-4 flex flex-col justify-between ${plan === "pro" ? "border-blue-500 ring-1 ring-blue-500/30 bg-blue-50/10" : "border-slate-200 bg-white"}`}>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-800">Professional Pro</span>
                {plan === "pro" && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Active</span>}
              </div>
              <p className="text-sm font-extrabold text-slate-900">₹999 / month</p>
              
              <ul className="text-[11px] text-slate-500 mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-1 font-medium text-slate-700">✓ 10 Staff Members</li>
                <li className="flex items-center gap-1 font-medium text-slate-700">✓ 500 Orders / month</li>
                <li className="flex items-center gap-1 font-medium text-slate-700">✓ Standard POS UI</li>
                <li className="flex items-center gap-1 font-medium text-slate-700">✓ Basic Business Reports</li>
                <li className="flex items-center gap-1 text-emerald-600 font-semibold">✓ Advanced Inventory</li>
                <li className="flex items-center gap-1 text-emerald-600 font-semibold">✓ Gemini AI Assist</li>
              </ul>
            </div>
            {plan === "pro" ? (
              <button
                disabled
                className="mt-4 w-full bg-blue-50 text-blue-600 font-bold py-1.5 rounded-lg text-xs border-none"
              >
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handleCheckout("pro")}
                disabled={actionLoading !== null}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg text-xs transition cursor-pointer border-none"
              >
                {actionLoading === "pro" ? "Upgrading..." : "Upgrade to Pro"}
              </button>
            )}
          </div>

          {/* Enterprise Card */}
          <div className={`border rounded-xl p-4 flex flex-col justify-between ${plan === "enterprise" ? "border-purple-500 ring-1 ring-purple-500/30 bg-purple-50/10" : "border-slate-200 bg-white"}`}>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-800">Enterprise Elite</span>
                {plan === "enterprise" && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Active</span>}
              </div>
              <p className="text-sm font-extrabold text-slate-900">₹2999 / month</p>
              
              <ul className="text-[11px] text-slate-500 mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-1 font-medium text-purple-700">✓ Unlimited Staff (∞)</li>
                <li className="flex items-center gap-1 font-medium text-purple-700">✓ Unlimited Orders (∞)</li>
                <li className="flex items-center gap-1 font-medium text-slate-700">✓ Standard POS UI</li>
                <li className="flex items-center gap-1 font-medium text-slate-700">✓ Basic Business Reports</li>
                <li className="flex items-center gap-1 text-emerald-600 font-semibold">✓ Advanced Inventory</li>
                <li className="flex items-center gap-1 text-emerald-600 font-semibold">✓ Gemini AI Assist</li>
                <li className="flex items-center gap-1 text-purple-600 font-extrabold">✓ 24/7 Dedicated Support</li>
              </ul>
            </div>
            {plan === "enterprise" ? (
              <button
                disabled
                className="mt-4 w-full bg-purple-50 text-purple-600 font-bold py-1.5 rounded-lg text-xs border-none"
              >
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handleCheckout("enterprise")}
                disabled={actionLoading !== null}
                className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 rounded-lg text-xs transition cursor-pointer border-none"
              >
                {actionLoading === "enterprise" ? "Upgrading..." : "Upgrade Elite"}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
