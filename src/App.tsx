import React, { useState, useEffect } from "react";
import { StaffMember, RestaurantTenant } from "./features/shared/types";
import { AppContextProvider, useAppContext } from "./features/shared/context/AppContext";

import Sidebar from "./features/shared/components/Sidebar";
import SaasAdminDashboard from "./features/saas/SaasAdminDashboard";
import SaasAdminLogin from "./features/saas/SaasAdminLogin";
import PinLogin from "./features/staff/PinLogin";
import POSBilling from "./features/pos/POSBilling";
import InventoryManagement from "./features/inventory/InventoryManagement";
import StaffShifts from "./features/staff/StaffShifts";
import CRMLoyalty from "./features/crm/CRMLoyalty";
import DeliveryIntegration from "./features/delivery/DeliveryIntegration";
import LandingPage from "./features/shared/components/LandingPage";
import SignupPage from "./features/shared/components/SignupPage";
import LegalPage from "./features/shared/components/LegalPage";
import AICopilot from "./features/copilot/AICopilot";
import BackgroundJobsDashboard from "./features/shared/components/BackgroundJobsDashboard";
import NotificationCenter from "./features/shared/components/NotificationCenter";
import EventDrivenDashboard from "./features/shared/components/EventDrivenDashboard";
import SessionManagementDashboard from "./features/shared/components/SessionManagementDashboard";
import Dashboard from "./features/shared/components/Dashboard";
import { ToastContainer } from "./features/shared/components/ToastContainer";
import { toast } from "./features/shared/services/toast";

const KitchenKDS = React.lazy(() => import("./features/kitchen/KitchenKDS"));
const AIReportsView = React.lazy(() => import("./features/shared/components/AIReportsView"));
const SettingsPanel = React.lazy(() => import("./features/shared/components/SettingsPanel"));

import {
  Bell,
  Sparkles,
  Menu,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

function AppContent() {
  const {
    showSignup,
    setShowSignup,
    showAdminPanel,
    setShowAdminPanel,
    tenants,
    setTenants,
    activeTenant,
    setActiveTenant,
    showTerminalLogin,
    setShowTerminalLogin,
    menuItems,
    setMenuItems,
    ingredients,
    setIngredients,
    recipes,
    setRecipes,
    staffList,
    setStaffList,
    orders,
    customers,
    setCustomers,
    purchases,
    shifts,
    settings,
    setSettings,
    toastMessage,
    setToastMessage,
    aiReport,
    isGeneratingReport,
    reportError,
    pendingOwnerRef,
    dashboardStats,
    handleGenerateAIReport,
    handleOrderCreated,
    handleUpdateOrderStatus,
    handleUpdateIngredients,
    handleUpdateRecipes,
    handleUpdateMenuItems,
    handleAddPurchase,
    currentStaff,
    setCurrentStaff,
    currentSessionId,
    setCurrentSessionId,
    showIdleWarning,
    setShowIdleWarning,
    idleCountdown,
    activeShift,
    handleLoginSuccess,
    handleLogout,
    handleShiftAction
  } = useAppContext();

  // Active view tab state
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [initialSignupData, setInitialSignupData] = useState<{
    businessName: string;
    ownerName: string;
    ownerPhone: string;
    email: string;
    region: string;
    pin: string;
  } | null>(null);

  // Active legal page state
  const [activeLegalPage, setActiveLegalPage] = useState<"terms" | "privacy" | "refund-policy" | null>(() => {
    const path = window.location.pathname;
    if (path === "/terms") return "terms";
    if (path === "/privacy") return "privacy";
    if (path === "/refund-policy") return "refund-policy";
    return null;
  });

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path === "/terms") setActiveLegalPage("terms");
      else if (path === "/privacy") setActiveLegalPage("privacy");
      else if (path === "/refund-policy") setActiveLegalPage("refund-policy");
      else setActiveLegalPage(null);
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  // Bridge legacy toastMessage state calls to the new modern stackable toast service
  useEffect(() => {
    if (toastMessage) {
      if (toastMessage.type === "success") {
        toast.success(toastMessage.text);
      } else {
        toast.error(toastMessage.text);
      }
      setToastMessage(null);
    }
  }, [toastMessage, setToastMessage]);

  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);

  // Poll notifications for real-time badge count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!currentStaff) return;
      try {
        const res = await fetch("/api/notifications");
        const data = await res.json();
        if (data.success && data.notifications) {
          const unread = data.notifications.filter((n: any) => !n.read).length;
          setUnreadNotifsCount(unread);
        }
      } catch (err) {
        console.warn("Failed to poll unread notifications:", err);
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [activeTab, currentStaff]);

  const handleSignupSuccess = (data: {
    tenant: RestaurantTenant;
    staff: StaffMember;
    sessionId: string;
  }) => {
    setTenants((prev) => {
      const updated = [...prev, data.tenant];
      localStorage.setItem("veggiepos_tenants", JSON.stringify(updated));
      return updated;
    });
    setActiveTenant(data.tenant);
    localStorage.setItem("veggiepos_active_tenant_id", data.tenant.tenantId);

    setStaffList([data.staff]);

    // Do not log in automatically after signup. Show the secure keypad terminal instead!
    setCurrentStaff(null);
    setCurrentSessionId(null);
    setShowTerminalLogin(true);

    setShowSignup(false);
    window.history.pushState({}, "", "/");
  };

  if (activeLegalPage) {
    return (
      <LegalPage
        page={activeLegalPage}
        onBack={() => {
          window.history.pushState({}, "", "/");
          setActiveLegalPage(null);
        }}
      />
    );
  }

  if (showSignup) {
    return (
      <SignupPage
        initialData={initialSignupData}
        onBack={() => {
          setShowSignup(false);
          setInitialSignupData(null);
          window.history.pushState({}, "", "/");
        }}
        onSignupSuccess={(data) => {
          setInitialSignupData(null);
          handleSignupSuccess(data);
        }}
      />
    );
  }

  if (showAdminPanel) {
    const isSaaSUser = (currentStaff?.role as string) === "SaaS Owner";

    if (!isSaaSUser) {
      return (
        <SaasAdminLogin
          currentStaff={currentStaff}
          setCurrentStaff={setCurrentStaff}
          setCurrentSessionId={setCurrentSessionId}
          setActiveTab={setActiveTab}
          setShowAdminPanel={setShowAdminPanel}
        />
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <header className="bg-slate-900 text-white py-4 px-6 flex items-center justify-between border-b border-slate-800 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-pink-500 to-indigo-600 rounded-xl flex items-center justify-center font-bold text-sm text-white">
              S
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight">SaaS Owner Console</h1>
              <p className="text-[10px] text-pink-400 font-mono">Role: Super-Admin</p>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("veggiepos_current_session_id");
              localStorage.removeItem("veggiepos_current_staff");
              setCurrentSessionId(null);
              setCurrentStaff(null);
              setShowAdminPanel(false);
              window.history.pushState({}, "", "/");
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm border border-slate-700 cursor-pointer"
          >
            <span>Lock & Exit Console</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <SaasAdminDashboard
            tenants={tenants}
            activeTenant={activeTenant}
            onSelectTenant={(t) => setActiveTenant(t)}
            onRegisterBusiness={(data) => {
              const cleanedName = data.businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
              const randomSuffix = Math.floor(100 + Math.random() * 900);
              const newTenantId = `veg-${cleanedName}-${randomSuffix}`;
              
              const newTenant: RestaurantTenant = {
                id: `t-${Date.now()}`,
                name: data.businessName,
                tenantId: newTenantId,
                status: "active",
                created: new Date().toISOString().slice(0, 10),
                ownerName: data.ownerName,
                ownerPhone: data.ownerPhone,
                email: data.email,
                region: data.region
              };

              const cleanedOwner = data.ownerName.toLowerCase().replace(/[^a-z0-9]/g, "");
              const ownerId = `s-${cleanedOwner}-${randomSuffix}`;
              const newOwner: StaffMember = {
                id: ownerId,
                name: data.ownerName,
                role: "Owner",
                pin: data.pin,
                permissions: ["billing", "inventory", "reports", "settings"]
              };

              setTenants((prev) => [...prev, newTenant]);
              setStaffList((prev) => [...prev, newOwner]);
            }}
            orders={orders}
            currentSessionId={currentSessionId}
          />
        </main>
      </div>
    );
  }

  if (!currentStaff) {
    if (showTerminalLogin) {
      return (
        <>
          <PinLogin
            staffList={staffList}
            onLoginSuccess={(staff, sessId) => {
              handleLoginSuccess(staff, sessId);
              setActiveTab(staff.permissions.includes("reports") ? "dashboard" : "billing");
            }}
            restaurantName={activeTenant.name}
            tenantId={activeTenant.tenantId}
            onBackToLanding={() => setShowTerminalLogin(false)}
          />
          <AICopilot activeTenant={activeTenant} currentStaff={currentStaff} />
        </>
      );
    }
    return (
      <>
        <LandingPage
          tenants={tenants}
          staffList={staffList}
          activeTenant={activeTenant}
          onSelectTenant={(t) => {
            setActiveTenant(t);
            setShowTerminalLogin(true);
          }}
          onRegisterBusiness={(data) => {
            setInitialSignupData(data);
            setShowSignup(true);
            window.history.pushState({}, "", "/signup");
          }}
          onLoginBusiness={async (data) => {
            try {
              const matchingTenant = tenants.find(
                (t) => t.name.toLowerCase() === data.businessName.toLowerCase()
              );
              const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  pin: data.pin,
                  email: data.email,
                  tenantId: matchingTenant ? matchingTenant.tenantId : undefined
                })
              });

              if (res.status === 423) {
                const errData = await res.json();
                alert(`Access Blocked: ${errData.message}`);
                return;
              }

              if (!res.ok) {
                const errData = await res.json();
                if (errData.locked) {
                  alert(`Access locked: ${errData.message}`);
                } else {
                  alert(`Authentication failed: ${errData.message} (${errData.remainingAttempts} attempts remaining)`);
                }
                return;
              }

              const result = await res.json();
              if (result.success) {
                const existingTenant = tenants.find(
                  (t) => t.name.toLowerCase() === data.businessName.toLowerCase()
                );

                if (existingTenant) {
                  setActiveTenant(existingTenant);
                } else {
                  const cleanedName = data.businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
                  const randomSuffix = Math.floor(100 + Math.random() * 900);
                  const newTenantId = `veg-${cleanedName}-${randomSuffix}`;
                  const newTenant: RestaurantTenant = {
                    id: `t-${Date.now()}`,
                    name: data.businessName,
                    tenantId: newTenantId,
                    status: "active",
                    created: new Date().toISOString().slice(0, 10)
                  };

                  const defaultOwner: StaffMember = {
                    id: result.user.id,
                    name: result.user.name,
                    role: "Owner",
                    pin: data.pin || "1111",
                    permissions: ["billing", "inventory", "reports", "settings"]
                  };
                  pendingOwnerRef.current = defaultOwner;

                  setTenants((prev) => [...prev, newTenant]);
                  setActiveTenant(newTenant);
                }

                setCurrentStaff(result.user);
                setCurrentSessionId(result.session.sessionId);
                setActiveTab(result.user.permissions.includes("reports") ? "dashboard" : "billing");
                alert(`Welcome back, ${result.user.name}!`);
              }
            } catch (err) {
              console.warn("API login failed, logging in locally:", err);
              const matchingStaff = staffList.find(
                (s) => s.pin === data.pin && s.role === "Owner"
              );

              if (matchingStaff) {
                const existingTenant = tenants.find(
                  (t) => t.name.toLowerCase() === data.businessName.toLowerCase()
                );

                if (existingTenant) {
                  setActiveTenant(existingTenant);
                }

                setCurrentStaff(matchingStaff);
                setCurrentSessionId(`sess-${Date.now()}`);
                setActiveTab("dashboard");
                alert(`Logged in to terminal for "${data.businessName}".`);
              } else {
                const anyMatchingStaff = staffList.find((s) => s.pin === data.pin);
                if (anyMatchingStaff) {
                  setCurrentStaff(anyMatchingStaff);
                  setCurrentSessionId(`sess-${Date.now()}`);
                  setActiveTab(anyMatchingStaff.permissions.includes("reports") ? "dashboard" : "billing");
                  alert(`Logged in to terminal as ${anyMatchingStaff.name} (${anyMatchingStaff.role}).`);
                } else {
                  alert("Could not authenticate. Verify your Owner Passcode PIN (Demo: 1111).");
                }
              }
            }
          }}
          onOpenStaffTerminal={() => setShowTerminalLogin(true)}
        />
        <AICopilot activeTenant={activeTenant} currentStaff={currentStaff} />
      </>
    );
  }

  return (
    <div className="h-screen w-full flex bg-[#f8fafc] text-[#1e293b] font-sans overflow-hidden select-none">
      
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentStaff={currentStaff}
        onLogout={handleLogout}
        activeShift={activeShift}
        onShiftAction={handleShiftAction}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        activeTenant={activeTenant}
      />

      <main className="flex-1 flex flex-col overflow-hidden bg-[#fafbfd]">
        
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 sm:px-8 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] shrink-0 z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 focus:outline-none transition shrink-0"
              id="mobile-menu-trigger-btn"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight font-display">
              {activeTab === "saas-admin" && "SaaS Multi-Tenant Control Panel"}
              {activeTab === "dashboard" && "Operations Center"}
              {activeTab === "billing" && "Order Entry Desk"}
              {activeTab === "kds" && "Kitchen Assembly Line"}
              {activeTab === "crm" && "Customer Relations (CRM)"}
              {activeTab === "delivery" && "Food Delivery Channel Gateway"}
              {activeTab === "inventory" && "Raw Supplies Ledger"}
              {activeTab === "shifts" && "Attendance & Shifts"}
              {activeTab === "ai-reports" && "Business Audit & Strategy"}
              {activeTab === "jobs" && "Background Jobs Command Center"}
              {activeTab === "notifications" && "Central Notification Center"}
              {activeTab === "events" && "Event-Driven Command Center"}
              {activeTab === "security" && "Security Session Command Center"}
              {activeTab === "settings" && "Rules Settings Panel"}
            </h2>

            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/50 border border-emerald-100/50 text-emerald-700 rounded-md text-[10px] font-semibold tracking-wide font-mono">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              {activeTenant.name}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            <div className="hidden md:block font-mono bg-slate-50 border border-slate-150 px-2.5 py-1 rounded text-slate-500 text-[10px]">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} | {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </div>

            <button
              onClick={() => setActiveTab("notifications")}
              className="relative p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition cursor-pointer flex items-center justify-center shrink-0"
              title="Central Notification Center"
              id="header-notifications-bell-btn"
            >
              <Bell className="w-4 h-4 text-pink-600" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-pink-600 text-white font-mono font-extrabold text-[8.5px] px-1.5 rounded-full border border-white animate-pulse min-w-[16px] h-4 flex items-center justify-center">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {activeTab === "dashboard" && (
              <button
                onClick={() => {
                  setActiveTab("ai-reports");
                  handleGenerateAIReport();
                }}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] transition shadow-[0_2px_4px_rgba(0,0,0,0.05)] flex items-center gap-1.5 cursor-pointer"
                id="header-audit-btn"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>AI Business Audit</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          
          {activeTab === "dashboard" && (
            <Dashboard
              dashboardStats={dashboardStats}
              ingredients={ingredients}
              orders={orders}
              shifts={shifts}
              setActiveTab={setActiveTab}
              handleGenerateAIReport={handleGenerateAIReport}
            />
          )}

          {activeTab === "billing" && (
            <POSBilling
              menuItems={menuItems}
              ingredients={ingredients}
              recipes={recipes}
              settings={settings}
              currentStaff={currentStaff}
              onOrderCreated={handleOrderCreated}
              onUpdateIngredients={handleUpdateIngredients}
              orders={orders}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              customers={customers}
              setCustomers={setCustomers}
            />
          )}

          {activeTab === "kds" && (
            <React.Suspense fallback={
              <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-sm font-medium text-slate-400 font-mono">Loading Kitchen Display System...</p>
              </div>
            }>
              <KitchenKDS
                orders={orders}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                kdsSoundAlerts={settings.kdsSoundAlerts}
              />
            </React.Suspense>
          )}

          {activeTab === "crm" && (
            <CRMLoyalty
              customers={customers}
              setCustomers={setCustomers}
            />
          )}

          {activeTab === "delivery" && (
            <DeliveryIntegration
              menuItems={menuItems}
              onUpdateMenuItems={handleUpdateMenuItems}
              orders={orders}
              onOrderCreated={handleOrderCreated}
              settings={settings}
            />
          )}

          {activeTab === "inventory" && (
            <InventoryManagement
              ingredients={ingredients}
              menuItems={menuItems}
              recipes={recipes}
              purchases={purchases}
              settings={settings}
              currentStaff={currentStaff}
              onUpdateIngredients={handleUpdateIngredients}
              onUpdateRecipes={handleUpdateRecipes}
              onUpdateMenuItems={handleUpdateMenuItems}
              onAddPurchase={handleAddPurchase}
              onUpdateSettings={setSettings}
            />
          )}

          {activeTab === "shifts" && (
            <StaffShifts
              shifts={shifts}
              activeShift={activeShift}
              onShiftAction={handleShiftAction}
              currentStaff={currentStaff}
              staffList={staffList}
              onUpdateStaffList={setStaffList}
              activeTenant={activeTenant}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === "ai-reports" && (
            <React.Suspense fallback={
              <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-sm font-medium text-slate-400 font-mono">Loading Reports & Analytics...</p>
              </div>
            }>
              <AIReportsView
                handleGenerateAIReport={handleGenerateAIReport}
                isGeneratingReport={isGeneratingReport}
                reportError={reportError}
                aiReport={aiReport}
              />
            </React.Suspense>
          )}

          {activeTab === "saas-admin" && (
            <SaasAdminDashboard
              tenants={tenants}
              activeTenant={activeTenant}
              onSelectTenant={(t) => setActiveTenant(t)}
              onRegisterBusiness={(data) => {
                const cleanedName = data.businessName.toLowerCase().replace(/[^a-z0-9]/g, "");
                const randomSuffix = Math.floor(100 + Math.random() * 900);
                const newTenantId = `veg-${cleanedName}-${randomSuffix}`;
                
                const newTenant: RestaurantTenant = {
                  id: `t-${Date.now()}`,
                  name: data.businessName,
                  tenantId: newTenantId,
                  status: "active",
                  created: new Date().toISOString().slice(0, 10),
                  ownerName: data.ownerName,
                  ownerPhone: data.ownerPhone,
                  email: data.email,
                  region: data.region
                };

                const cleanedOwner = data.ownerName.toLowerCase().replace(/[^a-z0-9]/g, "");
                const ownerId = `s-${cleanedOwner}-${randomSuffix}`;
                const newOwner: StaffMember = {
                  id: ownerId,
                  name: data.ownerName,
                  role: "Owner",
                  pin: data.pin,
                  permissions: ["billing", "inventory", "reports", "settings"]
                };

                setTenants((prev) => [...prev, newTenant]);
                setStaffList((prev) => [...prev, newOwner]);
              }}
              orders={orders}
            />
          )}

          {activeTab === "jobs" && (
            <BackgroundJobsDashboard />
          )}

          {activeTab === "notifications" && (
            <NotificationCenter />
          )}

          {activeTab === "events" && (
            <EventDrivenDashboard />
          )}

          {activeTab === "settings" && (
            <React.Suspense fallback={
              <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-sm font-medium text-slate-400 font-mono">Loading Settings & Configurations...</p>
              </div>
            }>
              <SettingsPanel
                activeTenant={activeTenant}
                settings={settings}
                setSettings={setSettings}
                toastMessage={toastMessage}
                setToastMessage={setToastMessage}
                currentStaff={currentStaff}
                staffList={staffList}
                setStaffList={setStaffList}
                menuItems={menuItems}
                ingredients={ingredients}
                recipes={recipes}
                orders={orders}
                customers={customers}
                setCustomers={setCustomers}
                purchases={purchases}
                shifts={shifts}
                handleLogout={handleLogout}
                tenants={tenants}
                setTenants={setTenants}
              />
            </React.Suspense>
          )}

          {activeTab === "security" && (
            <SessionManagementDashboard
              currentSessionId={currentSessionId}
              onSessionTerminated={handleLogout}
            />
          )}

        </div>

      </main>

      {showIdleWarning && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 max-w-sm w-full text-center space-y-4 animate-scale-up">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-800">Inactivity Idle Warning</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                You have been idle. To protect sensitive customer & POS billing details, you will be securely logged out automatically.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200/60 text-amber-800 font-mono font-bold py-2.5 rounded-xl text-lg tracking-wider">
              00:{idleCountdown.toString().padStart(2, "0")}
            </div>

            <button
              onClick={() => {
                setShowIdleWarning(false);
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/10 transition cursor-pointer"
            >
              Keep Me Logged In
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-[99999] flex items-center gap-3.5 px-4.5 py-4 rounded-2xl shadow-2xl border text-xs font-semibold tracking-wide animate-bounce duration-300 max-w-sm ${
          toastMessage.type === "success" 
            ? "bg-slate-900 border-slate-850 text-emerald-400" 
            : "bg-rose-950/95 border-rose-900 text-rose-100 backdrop-blur"
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${toastMessage.type === "success" ? "bg-emerald-500 animate-ping" : "bg-rose-500 animate-pulse"}`} />
          <span className="flex-1 leading-relaxed">{toastMessage.text}</span>
          <button 
            onClick={() => setToastMessage(null)} 
            className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-white px-1.5 py-1 transition-colors rounded hover:bg-white/5 ml-1"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppContextProvider>
      <AppContent />
      <ToastContainer />
    </AppContextProvider>
  );
}
