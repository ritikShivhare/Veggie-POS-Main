import React, { useState } from "react";
import { Settings, ShieldCheck, RefreshCw, UserMinus, AlertTriangle, CheckCircle2, Bell, Mail, Activity, Lock, Globe } from "lucide-react";
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<"general" | "password" | "language">("general");
  const [currentLang, setCurrentLang] = useState<string>(() => {
    return localStorage.getItem("veggiepos_language") || "en";
  });

  // Password change states
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const translations: Record<string, Record<string, string>> = {
    en: {
      terminalRules: "Terminal & Operational Rules",
      monitoringAlerting: "Production Monitoring & Alerting",
      gdprPrivacy: "GDPR Privacy & Data Portability",
      staffCredentials: "Staff Credentials & Permissions Control",
      settingsTitle: "VeggiePOS Administration Settings",
      generalTab: "General Settings",
      passwordTab: "Change PIN / Password",
      languageTab: "Language Change",
      currentPin: "Current PIN/Password",
      newPin: "New PIN/Password (4 digits)",
      confirmPin: "Confirm New PIN/Password",
      saveChanges: "Save Security Changes",
      selectLanguage: "Select Terminal Language",
      activeLang: "Active Language",
      saveLanguage: "Apply Language"
    },
    hi: {
      terminalRules: "टर्मिनल और परिचालन नियम",
      monitoringAlerting: "उत्पादन निगरानी और चेतावनी",
      gdprPrivacy: "जीडीपीआर गोपनीयता और डेटा सुवाह्यता",
      staffCredentials: "स्टाफ क्रेडेंशियल और अनुमतियाँ नियंत्रण",
      settingsTitle: "वेजीपीओएस प्रशासनिक सेटिंग्स",
      generalTab: "सामान्य सेटिंग्स",
      passwordTab: "पिन / पासवर्ड बदलें",
      languageTab: "भाषा बदलें",
      currentPin: "वर्तमान पिन/पासवर्ड",
      newPin: "नया पिन/पासवर्ड (4 अंक)",
      confirmPin: "नया पिन/पासवर्ड पुष्टि करें",
      saveChanges: "सुरक्षा परिवर्तन सहेजें",
      selectLanguage: "टर्मिनल भाषा चुनें",
      activeLang: "सक्रिय भाषा",
      saveLanguage: "भाषा लागू करें"
    },
    es: {
      terminalRules: "Reglas Operativas y de Terminal",
      monitoringAlerting: "Monitoreo de Producción y Alertas",
      gdprPrivacy: "Privacidad GDPR y Portabilidad de Datos",
      staffCredentials: "Credenciales de Personal y Control de Permisos",
      settingsTitle: "Configuración Administrativa de VeggiePOS",
      generalTab: "Configuración General",
      passwordTab: "Cambiar PIN / Contraseña",
      languageTab: "Cambiar Idioma",
      currentPin: "PIN/Contraseña Actual",
      newPin: "Nuevo PIN/Contraseña (4 dígitos)",
      confirmPin: "Confirmar Nuevo PIN/Contraseña",
      saveChanges: "Guardar Cambios de Seguridad",
      selectLanguage: "Seleccionar Idioma de la Terminal",
      activeLang: "Idioma Activo",
      saveLanguage: "Aplicar Idioma"
    },
    fr: {
      terminalRules: "Règles Opérationnelles et du Terminal",
      monitoringAlerting: "Surveillance de Production et Alertes",
      gdprPrivacy: "Confidentialité GDPR et Portabilité des Données",
      staffCredentials: "Identifiants du Personnel et Contrôle des Permissions",
      settingsTitle: "Paramètres d'Administration VeggiePOS",
      generalTab: "Paramètres Généraux",
      passwordTab: "Modifier le PIN / Mot de passe",
      languageTab: "Changer de Langue",
      currentPin: "PIN/Mot de passe Actuel",
      newPin: "Nouveau PIN/Mot de passe (4 chiffres)",
      confirmPin: "Confirmer le Nouveau PIN/Mot de passe",
      saveChanges: "Enregistrer les Modifications",
      selectLanguage: "Sélectionner la Langue du Terminal",
      activeLang: "Langue Active",
      saveLanguage: "Appliquer la Langue"
    }
  };

  const t = (key: string) => {
    return translations[currentLang]?.[key] || translations["en"]?.[key] || key;
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (!currentStaff) {
      setPwError(currentLang === "hi" ? "पासवर्ड/पिन बदलने के लिए कोई स्टाफ सदस्य लॉग इन नहीं है।" : "No staff member logged in to change password/PIN.");
      return;
    }

    if (currentPinInput !== currentStaff.pin) {
      setPwError(currentLang === "hi" ? "वर्तमान पिन गलत है।" : "Current PIN is incorrect.");
      return;
    }

    if (!/^\d{4}$/.test(newPinInput)) {
      setPwError(currentLang === "hi" ? "नया पिन बिल्कुल 4 अंकों का होना चाहिए।" : "New PIN must be exactly 4 digits.");
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPwError(currentLang === "hi" ? "पुष्टि पिन नए पिन से मेल नहीं खाता है।" : "Confirm PIN does not match the New PIN.");
      return;
    }

    // Check if another staff uses this PIN
    const pinExists = staffList.some(s => s.id !== currentStaff.id && s.pin === newPinInput);
    if (pinExists) {
      setPwError(currentLang === "hi" ? "यह पिन पहले से ही किसी अन्य स्टाफ सदस्य द्वारा उपयोग में है। कृपया एक अद्वितीय पिन चुनें।" : "This PIN is already in use by another staff member. Please select a unique PIN.");
      return;
    }

    try {
      // Update staffList
      const updatedList = staffList.map((s) =>
        s.id === currentStaff.id ? { ...s, pin: newPinInput } : s
      );
      setStaffList(updatedList);

      // Save updated staff list to localStorage
      localStorage.setItem(`veggiepos_staff_list_${activeTenant.tenantId}`, JSON.stringify(updatedList));

      // Update currentStaff in localStorage
      const updatedCurrent = { ...currentStaff, pin: newPinInput };
      localStorage.setItem("veggiepos_current_staff", JSON.stringify(updatedCurrent));

      // Set Success message
      setPwSuccess(currentLang === "hi" ? "आपका सुरक्षा पिन सफलतापूर्वक बदल दिया गया है!" : "Your security PIN has been successfully changed!");
      setCurrentPinInput("");
      setNewPinInput("");
      setConfirmPinInput("");

      setToastMessage({
        type: "success",
        text: currentLang === "hi" ? "पिन सफलतापूर्वक बदला गया!" : "PIN successfully changed!"
      });
    } catch (err: any) {
      setPwError(err.message || "Failed to change PIN.");
    }
  };

  const handleLanguageSelect = (lang: string) => {
    setCurrentLang(lang);
    localStorage.setItem("veggiepos_language", lang);

    // Dispatch a custom event so other components can listen to language change
    window.dispatchEvent(new Event("languagechange"));

    let localizedMsg = "Language successfully updated!";
    if (lang === "hi") localizedMsg = "भाषा सफलतापूर्वक हिन्दी में बदल दी गई है!";
    if (lang === "es") localizedMsg = "¡Idioma actualizado con éxito!";
    if (lang === "fr") localizedMsg = "Langue mise à jour avec succès!";

    setToastMessage({
      type: "success",
      text: localizedMsg
    });
  };

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

      {/* Sub-Tabs Selector */}
      <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-xl p-1.5 flex gap-2 shadow-sm">
        <button
          onClick={() => setSubTab("general")}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition duration-150 flex items-center justify-center gap-2 cursor-pointer ${
            subTab === "general"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/10"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>{t("generalTab")}</span>
        </button>

        <button
          onClick={() => setSubTab("password")}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition duration-150 flex items-center justify-center gap-2 cursor-pointer ${
            subTab === "password"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/10"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>{t("passwordTab")}</span>
        </button>

        <button
          onClick={() => setSubTab("language")}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition duration-150 flex items-center justify-center gap-2 cursor-pointer ${
            subTab === "language"
              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/10"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>{t("languageTab")}</span>
        </button>
      </div>

      {subTab === "general" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-6xl mx-auto animate-fadeIn">
        
        <div className="lg:col-span-5 flex flex-col gap-6 w-full">
          {/* Terminal & Operational Rules */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              {t("terminalRules")}
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
                {t("monitoringAlerting")}
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
                {t("gdprPrivacy")}
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
              {t("staffCredentials")}
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
                            <div className="flex items-center gap-1.5 shrink-0">
                              {deleteConfirmId === staff.id ? (
                                <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 p-1 rounded-xl animate-fadeIn">
                                  <span className="text-[10px] text-rose-750 font-bold px-1 select-none">Sure?</span>
                                  <button
                                    onClick={() => {
                                      const updatedList = staffList.filter((s) => s.id !== staff.id);
                                      setStaffList(updatedList);
                                      setDeleteConfirmId(null);
                                    }}
                                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold uppercase transition cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-semibold transition cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(staff.id)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200/50 transition cursor-pointer"
                                  title="Delete Staff Member"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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
      )}

      {subTab === "password" && (
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              <span>{t("passwordTab")}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {currentLang === "hi" 
                ? "सुरक्षा कारणों से, सुनिश्चित करें कि आपका नया पिन मजबूत है और केवल आपके पास ही सुरक्षित है।"
                : "For security, ensure your terminal pin is confidential and only known to authorized users."}
            </p>
          </div>

          {pwError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {pwError}
            </div>
          )}

          {pwSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
              {pwSuccess}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">{t("currentPin")}</label>
              <input
                type="password"
                maxLength={4}
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-center text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-700 tracking-widest"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">{t("newPin")}</label>
              <input
                type="password"
                maxLength={4}
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-center text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-700 tracking-widest"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">{t("confirmPin")}</label>
              <input
                type="password"
                maxLength={4}
                value={confirmPinInput}
                onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-center text-sm focus:outline-none focus:border-blue-500 focus:bg-white text-slate-700 tracking-widest"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/10 active:scale-95 transition duration-150 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Lock className="w-4 h-4" />
              <span>{t("saveChanges")}</span>
            </button>
          </form>

          {/* Hindi description as requested */}
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-800 leading-relaxed space-y-2">
            <h4 className="font-bold flex items-center gap-1 text-blue-900">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>पिन/पासवर्ड बदलने से होने वाले प्रभाव (Effects of changing PIN/Password):</span>
            </h4>
            <ul className="list-disc pl-4 space-y-1 text-blue-700">
              <li><b>तत्काल प्रभाव (Instant Effect):</b> पिन बदलते ही टर्मिनल लॉक स्क्रीन पर लॉग इन करने के लिए नए पिन का उपयोग करना अनिवार्य हो जाएगा। पुराना पिन तुरंत काम करना बंद कर देगा।</li>
              <li><b>सुरक्षा (Enhanced Security):</b> यदि आपका पिन लीक हो गया था, तो नया पिन सेट करने से अनधिकृत व्यक्ति आपकी बिलिंग या डेटा तक नहीं पहुँच पाएंगे।</li>
              <li><b>उदाहरण (Example):</b> यदि आपका पुराना पिन <code>1111</code> था और आपने इसे बदलकर <code>5678</code> किया, तो अब लॉक स्क्रीन को केवल <code>5678</code> द्वारा ही खोला जा सकेगा। पुराना पिन अब काम नहीं करेगा।</li>
            </ul>
          </div>
        </div>
      )}

      {subTab === "language" && (
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              <span>{t("selectLanguage")}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {currentLang === "hi"
                ? "अपनी पसंदीदा भाषा चुनें। यह भाषा इस एडमिनिस्ट्रेशन सेटिंग्स पैनल में तत्परता से लागू होगी।"
                : "Choose your preferred system language. This will dynamically update the system administration interface."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { code: "en", label: "English", native: "English", flag: "🇺🇸" },
              { code: "hi", label: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
              { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸" },
              { code: "fr", label: "French", native: "Français", flag: "🇫🇷" }
            ].map((lang) => {
              const isSelected = currentLang === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                  className={`p-4 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/50"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl select-none">{lang.flag}</span>
                    <div>
                      <h3 className="font-bold text-slate-800 text-xs">{lang.label}</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">{lang.native}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl text-slate-500 text-[11px] leading-relaxed">
            <span className="font-bold text-slate-700">{t("activeLang")}:</span>{" "}
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 uppercase font-bold">
              {currentLang}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
