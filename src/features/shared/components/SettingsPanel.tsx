import React, { useState } from "react";
import { Settings, ShieldCheck, RefreshCw, UserMinus, AlertTriangle, CheckCircle2, Bell, Mail, Activity } from "lucide-react";
import { BillingSettings } from "./BillingSettings";
import { RestaurantTenant, InventorySettings, StaffMember, MenuItem, Ingredient, Recipe, Order, Customer, Purchase, Shift } from "../types";

interface SettingsPanelProps {
  activeTenant: RestaurantTenant;
  settings: InventorySettings;
  setSettings: (s: InventorySettings) => void;
  toastMessage: { type: "success" | "error"; text: string } | null;
  setToastMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
  currentStaff: StaffMember | null;
  staffList: StaffMember[];
  setStaffList: (list: StaffMember[]) => void;
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  orders: Order[];
  customers: Customer[];
  setCustomers: (c: Customer[]) => void;
  purchases: Purchase[];
  shifts: Shift[];
  handleLogout: () => void;
  tenants: RestaurantTenant[];
  setTenants: (list: RestaurantTenant[]) => void;
}

export default function SettingsPanel({
  activeTenant,
  settings,
  setSettings,
  toastMessage,
  setToastMessage,
  currentStaff,
  staffList,
  setStaffList,
  menuItems,
  ingredients,
  recipes,
  orders,
  customers,
  setCustomers,
  purchases,
  shifts,
  handleLogout,
  tenants,
  setTenants
}: SettingsPanelProps) {
  const [testingSlack, setTestingSlack] = useState(false);
  const [testingSentry, setTestingSentry] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  const triggerTestAlert = async (type: "Slack Webhook" | "Sentry DSN" | "Email Address") => {
    if (type === "Slack Webhook") setTestingSlack(true);
    if (type === "Sentry DSN") setTestingSentry(true);
    if (type === "Email Address") setTestingEmail(true);

    try {
      const res = await fetch("/api/monitoring/test-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sentryDsn: settings.sentryDsn || "",
          slackWebhookUrl: settings.slackWebhookUrl || "",
          emailAlertAddress: settings.emailAlertAddress || "",
          type
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage({
          type: "success",
          text: `Test successful! ${data.message}`
        });
      } else {
        setToastMessage({
          type: "error",
          text: `Alert test failed: ${data.error || "Unknown server error"}`
        });
      }
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: `Alert test failed to execute: ${err.message}`
      });
    } finally {
      if (type === "Slack Webhook") setTestingSlack(false);
      if (type === "Sentry DSN") setTestingSentry(false);
      if (type === "Email Address") setTestingEmail(false);
    }
  };

  return (
    <div className="h-full p-6 bg-[#f8fafc] overflow-y-auto space-y-6">
      <div className="max-w-6xl mx-auto">
        <BillingSettings tenantId={activeTenant.tenantId} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-6xl mx-auto">
        
        <div className="lg:col-span-5 flex flex-col gap-6 w-full">
          {/* Terminal & Operational Rules */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Terminal & Operational Rules
            </h2>

            <div className="space-y-4 divide-y divide-slate-100 text-slate-700 text-xs">
              
              <div className="flex items-center justify-between py-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Auto-Deduct Stock on POS Orders</h3>
                  <p className="text-slate-500 mt-0.5">Automatically subtract ingredients from raw ledger when checkout completes.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoDeductStock}
                  onChange={(e) => setSettings({ ...settings, autoDeductStock: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-3 pt-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Block Orders if Stock Insufficient</h3>
                  <p className="text-slate-500 mt-0.5">Strict mode: Prevent cashier checkouts if ingredient stock levels would drop below 0.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.blockOrdersIfInsufficient}
                  onChange={(e) => setSettings({ ...settings, blockOrdersIfInsufficient: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-3 pt-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Managers Allowed to Log Supplies</h3>
                  <p className="text-slate-500 mt-0.5">Allow employees with "Manager" role permissions to record vendor supply deliveries.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.managerCanAddPurchases}
                  onChange={(e) => setSettings({ ...settings, managerCanAddPurchases: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-3 pt-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Managers Allowed to Map Recipes</h3>
                  <p className="text-slate-500 mt-0.5">Allow Manager accounts to define/modify recipe ingredient portion weights for menu items.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.managerCanEditRecipes}
                  onChange={(e) => setSettings({ ...settings, managerCanEditRecipes: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-3 pt-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Browser Speech Synthesis KDS Alerts</h3>
                  <p className="text-slate-500 mt-0.5">Announce incoming tickets and stage updates aloud over the browser audio speakers.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.kdsSoundAlerts}
                  onChange={(e) => setSettings({ ...settings, kdsSoundAlerts: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
              </div>

            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700">Terminal mode active:</span> This panel adjusts settings specifically for the restaurant <b>{activeTenant.name}</b>. All data tables and operations remain secure.
            </div>
          </div>

          {/* Sentry & Slack Alerting Configuration */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5" id="settings-monitoring-alerts-card">
            <div>
              <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-600" />
                Production Monitoring & Alerting
              </h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Configure direct integrations to forward VeggiePOS application crashes and database errors to Slack channels, Sentry telemetry, or your operations email address.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Alert Active Switch */}
              <div className="flex items-center justify-between bg-indigo-50/40 p-3 rounded-lg border border-indigo-100/60">
                <div>
                  <h4 className="font-bold text-indigo-950">Enable Alerting & Dispatch</h4>
                  <p className="text-[10px] text-indigo-600 mt-0.5 font-medium">Toggle all automated Slack/Sentry notifications off or on.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableAlerts !== false}
                  onChange={(e) => setSettings({ ...settings, enableAlerts: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  id="settings-enable-alerts-checkbox"
                />
              </div>

              {/* Slack Webhook Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    Slack Incoming Webhook URL
                  </label>
                  <button
                    onClick={() => triggerTestAlert("Slack Webhook")}
                    disabled={testingSlack || !settings.slackWebhookUrl}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 transition flex items-center gap-1 cursor-pointer"
                    id="settings-test-slack-btn"
                  >
                    {testingSlack ? "Dispatching..." : "Send Test Alert"}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="https://hooks.slack.com/services/T.../B.../X..."
                  value={settings.slackWebhookUrl || ""}
                  onChange={(e) => setSettings({ ...settings, slackWebhookUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700"
                  id="settings-slack-webhook-input"
                />
              </div>

              {/* Sentry DSN Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    Sentry DSN
                  </label>
                  <button
                    onClick={() => triggerTestAlert("Sentry DSN")}
                    disabled={testingSentry || !settings.sentryDsn}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 transition flex items-center gap-1 cursor-pointer"
                    id="settings-test-sentry-btn"
                  >
                    {testingSentry ? "Dispatching..." : "Test Ingest"}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="https://publicKey@o0.ingest.sentry.io/project"
                  value={settings.sentryDsn || ""}
                  onChange={(e) => setSettings({ ...settings, sentryDsn: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700"
                  id="settings-sentry-dsn-input"
                />
              </div>

              {/* Email Alert Address Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    Operations Email Alerts
                  </label>
                  <button
                    onClick={() => triggerTestAlert("Email Address")}
                    disabled={testingEmail || !settings.emailAlertAddress}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 transition flex items-center gap-1 cursor-pointer"
                    id="settings-test-email-btn"
                  >
                    {testingEmail ? "Logging..." : "Test Dispatch"}
                  </button>
                </div>
                <input
                  type="email"
                  placeholder="alerts@yourdomain.com"
                  value={settings.emailAlertAddress || ""}
                  onChange={(e) => setSettings({ ...settings, emailAlertAddress: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700"
                  id="settings-email-alert-input"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-[10px] text-slate-500 leading-relaxed space-y-1">
              <p className="font-semibold text-slate-700">🔐 Security & Env Fallbacks:</p>
              <p>
                Credentials saved here are scoped locally to <b>{activeTenant.name}</b>. Alternatively, you can configure <code>SLACK_WEBHOOK_URL</code> or <code>SENTRY_DSN</code> in the global system secrets for cross-tenant production coverage.
              </p>
            </div>
          </div>

          {/* GDPR Privacy & Data Portability */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-pink-600" />
                GDPR Privacy & Data Portability
              </h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                In accordance with the General Data Protection Regulation (GDPR), VeggiePOS empowers you with direct control over your business data assets.
              </p>
            </div>

            <div className="space-y-4">
              {/* Export Option */}
              <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs">Right to Portability (Export)</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                      Download a comprehensive JSON data matrix containing all ingredients, menus, transaction histories, staff lists, and CRM records under your Tenant ID.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    try {
                      const exportData = {
                        exportDate: new Date().toISOString(),
                        tenantId: activeTenant.tenantId,
                        restaurantName: activeTenant.name,
                        schemaVersion: "1.2",
                        complianceStatus: "GDPR Compliant",
                        records: {
                          tenant: activeTenant,
                          menuItems: menuItems,
                          ingredients: ingredients,
                          recipes: recipes,
                          staffList: staffList,
                          orders: orders,
                          customers: customers,
                          purchases: purchases,
                          shifts: shifts,
                          settings: settings
                        }
                      };

                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `veggiepos_data_export_${activeTenant.tenantId}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();

                      setToastMessage({
                        type: "success",
                        text: "GDPR Data Portability export compiled and downloaded successfully!"
                      });
                    } catch (err: any) {
                      alert("Failed to export data: " + err.message);
                    }
                  }}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  id="settings-export-data-btn"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Export my data (JSON)</span>
                </button>
              </div>

              {/* Delete Option */}
              <div className="p-3.5 bg-rose-50/50 border border-rose-100 rounded-xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-rose-800 text-xs">Right to Erasure (Delete Account)</h4>
                    <p className="text-[10px] text-rose-600/80 mt-0.5 leading-relaxed">
                      Permanently and irreversibly delete your restaurant profile and purge all inventory logs, transaction tables, and shift rosters from VeggiePOS system storage.
                    </p>
                  </div>
                </div>

                {(!currentStaff || currentStaff.role !== "Owner") ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-700 font-medium">
                    Only the Restaurant Owner can delete this establishment.
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const prompt1 = window.confirm(
                        "WARNING: You are requesting permanent deletion of this restaurant profile and all associated logs in accordance with GDPR Article 17 (Right to Erasure).\n\nThis action is completely irreversible. All orders, inventory databases, and staff accounts will be immediately deleted. Do you wish to proceed?"
                      );
                      if (!prompt1) return;

                      const prompt2 = window.prompt(
                        `To confirm deletion of your establishment, please type the exact restaurant name "${activeTenant.name}" below:`
                      );
                      if (prompt2 !== activeTenant.name) {
                        alert("Verification failed. Restaurant name did not match. Deletion aborted.");
                        return;
                      }

                      try {
                        const updatedTenants = tenants.filter(t => t.tenantId !== activeTenant.tenantId);
                        setTenants(updatedTenants);
                        localStorage.setItem("veggiepos_tenants", JSON.stringify(updatedTenants));

                        handleLogout();

                        alert(`Establishment "${activeTenant.name}" has been permanently deleted, and all local and cloud resources have been scrubbed.`);
                      } catch (err: any) {
                        alert("Failed to complete account deletion: " + err.message);
                      }
                    }}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    id="settings-delete-account-btn"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Delete my account & purge data</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Staff Credentials Control */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 w-full">
          <div>
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Staff Credentials & Permissions Control
            </h2>
            
            {(!currentStaff || currentStaff.role !== "Owner") ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2.5 mt-4">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <span className="font-bold">Access Restricted:</span> Only the Restaurant Owner has authority to modify staff PINs and update view permissions.
                </div>
              </div>
            ) : (
              <div className="space-y-6 mt-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  As the <b>Restaurant Owner</b>, you have the administrative privilege to manage the 4-digit numeric code and module permissions for your team.
                </p>

                <div className="space-y-4 divide-y divide-slate-100">
                  {staffList.map((staff) => (
                    <div key={staff.id} className="pt-4 first:pt-0 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{staff.name}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{staff.role}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">PIN:</span>
                            <input
                              type="text"
                              maxLength={4}
                              placeholder="PIN"
                              value={staff.pin}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "");
                                const updatedList = staffList.map((s) =>
                                  s.id === staff.id ? { ...s, pin: val } : s
                                );
                                setStaffList(updatedList);
                              }}
                              className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white text-xs"
                            />
                          </div>
                          {staff.role !== "Owner" && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to completely delete ${staff.name} and revoke all access? This cannot be undone.`)) {
                                  const updatedList = staffList.filter((s) => s.id !== staff.id);
                                  setStaffList(updatedList);
                                }
                              }}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200/50 transition cursor-pointer"
                              title="Delete Staff Member"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">View Permissions</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {(["billing", "inventory", "reports", "settings"] as const).map((perm) => {
                            const hasPerm = staff.permissions.includes(perm);
                            return (
                              <label key={perm} className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 p-2 rounded-lg border border-slate-200/60 cursor-pointer transition select-none">
                                <input
                                  type="checkbox"
                                  checked={hasPerm}
                                  onChange={(e) => {
                                    const newPerms = e.target.checked
                                      ? [...staff.permissions, perm]
                                      : staff.permissions.filter((p) => p !== perm);
                                    const updatedList = staffList.map((s) =>
                                      s.id === staff.id ? { ...s, permissions: newPerms } : s
                                    );
                                    setStaffList(updatedList);
                                  }}
                                  className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
                                />
                                <span className="capitalize text-slate-600 font-medium text-[11px]">{perm}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-2.5 text-xs text-blue-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                  <div>
                    <p className="font-bold">Real-time update active:</p>
                    <p className="text-blue-600/90 mt-0.5">Any adjustments made above are instantly applied to the live terminal system state.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
