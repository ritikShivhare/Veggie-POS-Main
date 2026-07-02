import React, { useState, useMemo, useEffect, useRef } from "react";
import { MenuItem, Ingredient, Recipe, Purchase, StaffMember, Shift, Order, RestaurantTenant, InventorySettings, Customer } from "./features/shared/types";
import { ApiClient } from "./features/shared/services/api";
import {
  INITIAL_MENU_ITEMS,
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
  INITIAL_STAFF,
  INITIAL_ORDERS,
  INITIAL_TENANTS,
  INITIAL_CUSTOMERS
} from "./features/shared/data";
import Sidebar from "./features/shared/components/Sidebar";
import SaasAdminDashboard from "./features/saas/SaasAdminDashboard";
import PinLogin from "./features/staff/PinLogin";
import POSBilling from "./features/pos/POSBilling";
import KitchenKDS from "./features/kitchen/KitchenKDS";
import InventoryManagement from "./features/inventory/InventoryManagement";
import StaffShifts from "./features/staff/StaffShifts";
import CRMLoyalty from "./features/crm/CRMLoyalty";
import DeliveryIntegration from "./features/delivery/DeliveryIntegration";
import MarkdownRenderer from "./features/shared/components/MarkdownRenderer";
import LandingPage from "./features/shared/components/LandingPage";
import AICopilot from "./features/copilot/AICopilot";
import BackgroundJobsDashboard from "./features/shared/components/BackgroundJobsDashboard";
import NotificationCenter from "./features/shared/components/NotificationCenter";
import EventDrivenDashboard from "./features/shared/components/EventDrivenDashboard";
import SessionManagementDashboard from "./features/shared/components/SessionManagementDashboard";
import ApplicationMonitoringDashboard from "./features/shared/components/ApplicationMonitoringDashboard";
import {
  LayoutDashboard,
  Utensils,
  ChefHat,
  Boxes,
  Clock,
  FileText,
  Settings,
  ShieldCheck,
  TrendingUp,
  Plus,
  LogOut,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Activity,
  Sparkles,
  RefreshCw,
  Building,
  User,
  ExternalLink,
  Table,
  Check,
  AlertTriangle,
  Menu,
  Bell,
  Zap
} from "lucide-react";

export default function App() {
  // Multi-tenant selection (Active tenant details)
  const [tenants, setTenants] = useState<RestaurantTenant[]>(INITIAL_TENANTS);
  const [activeTenant, setActiveTenant] = useState<RestaurantTenant>(INITIAL_TENANTS[0]);

  // Core POS datasets state (Dynamic across sessions)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
  const [ingredients, setIngredients] = useState<Ingredient[]>(INITIAL_INGREDIENTS);
  const [recipes, setRecipes] = useState<Recipe[]>(INITIAL_RECIPES);
  const [staffList, setStaffList] = useState<StaffMember[]>(INITIAL_STAFF);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([
    {
      id: "sh-1",
      staffId: "s-rahul",
      staffName: "Rahul Sharma",
      role: "Owner",
      startTime: new Date(Date.now() - 3600000 * 4).toISOString(),
      status: "Active"
    },
    {
      id: "sh-2",
      staffId: "s-mohan",
      staffName: "Mohan Lal",
      role: "Staff",
      startTime: new Date(Date.now() - 3600000 * 5).toISOString(),
      endTime: new Date(Date.now() - 3600000 * 1).toISOString(),
      status: "Completed"
    }
  ]);

  // Inventory and checkout global settings rules
  const [settings, setSettings] = useState<InventorySettings>({
    autoDeductStock: true,
    blockOrdersIfInsufficient: true,
    managerCanAddPurchases: true,
    managerCanEditRecipes: true,
    kdsSoundAlerts: false,
    quickPinRequired: false
  });

  // Authentication State
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showIdleWarning, setShowIdleWarning] = useState<boolean>(false);
  const [idleCountdown, setIdleCountdown] = useState<number>(30);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [showTerminalLogin, setShowTerminalLogin] = useState<boolean>(false);

  // Active view tab state
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);

  // Poll notifications for real-time badge count
  useEffect(() => {
    const fetchUnreadCount = async () => {
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
  }, [activeTab]);

  // Production-level Secure Session Idle Timeout and Keep-Alive Engine
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimeoutMinutesRef = useRef<number>(15);

  useEffect(() => {
    if (!currentStaff || !currentSessionId) {
      setShowIdleWarning(false);
      return;
    }

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      if (showIdleWarning) {
        setShowIdleWarning(false);
        setIdleCountdown(30);
        
        fetch("/api/auth/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, tenantId: activeTenant.tenantId })
        }).catch(err => console.error(err));
      }
    };

    const events = ["mousedown", "mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(ev => window.addEventListener(ev, resetActivity));

    fetch("/api/auth/sessions-data?tenantId=" + activeTenant.tenantId)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.securitySettings) {
          idleTimeoutMinutesRef.current = data.securitySettings.sessionTimeoutMinutes;
        }
      })
      .catch(err => console.error(err));

    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetActivity));
    };
  }, [currentStaff, currentSessionId, showIdleWarning, activeTenant.tenantId]);

  useEffect(() => {
    if (!currentStaff || !currentSessionId) return;

    const validateInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, tenantId: activeTenant.tenantId })
        });
        const data = await res.json();
        if (!data.success) {
          setCurrentStaff(null);
          setCurrentSessionId(null);
          alert(data.message || "Your session has expired or has been revoked by an administrator.");
        }
      } catch (err) {
        console.error("Keep-alive validation failure:", err);
      }
    }, 12000);

    const idleCheckInterval = setInterval(() => {
      const elapsedSeconds = (Date.now() - lastActivityRef.current) / 1000;
      const timeoutSeconds = idleTimeoutMinutesRef.current * 60;
      const warningThresholdSeconds = Math.max(10, timeoutSeconds - 30);

      if (elapsedSeconds >= timeoutSeconds) {
        setCurrentStaff(null);
        setCurrentSessionId(null);
        setShowIdleWarning(false);
        alert("Session expired. You have been automatically logged out due to inactivity.");
      } else if (elapsedSeconds >= warningThresholdSeconds) {
        setShowIdleWarning(true);
        const remaining = Math.ceil(timeoutSeconds - elapsedSeconds);
        setIdleCountdown(remaining);
      } else {
        if (showIdleWarning) {
          setShowIdleWarning(false);
        }
      }
    }, 1000);

    return () => {
      clearInterval(validateInterval);
      clearInterval(idleCheckInterval);
    };
  }, [currentStaff, currentSessionId, showIdleWarning, activeTenant.tenantId]);

  // Gemini AI Report State
  const [aiReport, setAiReport] = useState<string>("");
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string>("");

  // Sync state loaded flag
  const isLoadedRef = useRef(false);
  const loadedTenantIdRef = useRef<string>("");
  const pendingOwnerRef = useRef<StaffMember | null>(null);

  // Initial Sync load & Background Sync Polling
  useEffect(() => {
    let active = true;
    isLoadedRef.current = false;

    const fetchSync = async () => {
      try {
        const json = await ApiClient.getTenantSync(activeTenant.tenantId);
        if (!active) return;

        if (json.success && json.initialized && json.data) {
          const d = json.data;
          if (d.menuItems) setMenuItems(d.menuItems);
          if (d.ingredients) setIngredients(d.ingredients);
          if (d.recipes) setRecipes(d.recipes);
          if (d.staffList) setStaffList(d.staffList);
          if (d.orders) setOrders(d.orders);
          if (d.customers) setCustomers(d.customers);
          if (d.purchases) setPurchases(d.purchases);
          if (d.shifts) setShifts(d.shifts);
          if (d.settings) setSettings(d.settings);
          
          loadedTenantIdRef.current = activeTenant.tenantId;
          isLoadedRef.current = true;
        } else if (json.success && !json.initialized) {
          // Initialize server store with clean default template data instead of leaking the previous tenant's data
          const isMainTenant = activeTenant.tenantId === "veg-main-001";
          
          let initialStaffList = isMainTenant ? INITIAL_STAFF : INITIAL_STAFF.map(s => ({ ...s, id: `${s.id}-${activeTenant.tenantId}` }));
          if (pendingOwnerRef.current) {
            initialStaffList = [pendingOwnerRef.current, ...initialStaffList.filter(s => s.role !== "Owner")];
            // Clear the ref after using it
            pendingOwnerRef.current = null;
          }

          const initialPayload = {
            menuItems: INITIAL_MENU_ITEMS,
            ingredients: INITIAL_INGREDIENTS,
            recipes: INITIAL_RECIPES,
            staffList: initialStaffList,
            orders: isMainTenant ? INITIAL_ORDERS : [],
            customers: INITIAL_CUSTOMERS,
            purchases: [],
            shifts: isMainTenant ? [
              {
                id: "sh-1",
                staffId: "s-rahul",
                staffName: "Rahul Sharma",
                role: "Owner" as const,
                startTime: new Date(Date.now() - 3600000 * 4).toISOString(),
                status: "Active" as const
              }
            ] : [],
            settings: {
              autoDeductStock: true,
              blockOrdersIfInsufficient: true,
              managerCanAddPurchases: true,
              managerCanEditRecipes: true,
              kdsSoundAlerts: false,
              quickPinRequired: false
            }
          };

          const saveRes = await ApiClient.saveTenantSync(activeTenant.tenantId, initialPayload);
          
          if (active && saveRes.success) {
            setMenuItems(initialPayload.menuItems);
            setIngredients(initialPayload.ingredients);
            setRecipes(initialPayload.recipes);
            setStaffList(initialPayload.staffList);
            setOrders(initialPayload.orders);
            setCustomers(initialPayload.customers);
            setPurchases(initialPayload.purchases);
            setShifts(initialPayload.shifts);
            setSettings(initialPayload.settings);
            
            loadedTenantIdRef.current = activeTenant.tenantId;
            isLoadedRef.current = true;
          }
        } else if (json.error) {
          throw new Error(json.error);
        }
      } catch (err) {
        console.warn("Failed to perform initial database synchronization for tenant:", activeTenant.tenantId, err);
      }
    };
    fetchSync();

    // Poll every 3.5 seconds to synchronize active orders & status across devices
    const interval = setInterval(async () => {
      try {
        const json = await ApiClient.getTenantSync(activeTenant.tenantId);
        if (!active) return;

        if (json.success && json.initialized && json.data) {
          const d = json.data;
          // Only apply background updates if we are still on the same tenant and it matches
          if (loadedTenantIdRef.current === activeTenant.tenantId) {
            if (d.menuItems) setMenuItems(d.menuItems);
            if (d.ingredients) setIngredients(d.ingredients);
            if (d.recipes) setRecipes(d.recipes);
            if (d.staffList) setStaffList(d.staffList);
            if (d.orders) setOrders(d.orders);
            if (d.customers) setCustomers(d.customers);
            if (d.purchases) setPurchases(d.purchases);
            if (d.shifts) setShifts(d.shifts);
            if (d.settings) setSettings(d.settings);
          }
        }
      } catch (err) {
        console.warn("Skipped background synchronization poll due to transient network status:", err);
      }
    }, 3500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeTenant.tenantId]);

  // Sync state modifications to server
  useEffect(() => {
    if (!isLoadedRef.current || loadedTenantIdRef.current !== activeTenant.tenantId) {
      return;
    }
    const saveSync = async () => {
      try {
        const res = await ApiClient.saveTenantSync(activeTenant.tenantId, {
          menuItems,
          ingredients,
          recipes,
          staffList,
          orders,
          customers,
          purchases,
          shifts,
          settings
        });
        if (!res.success) {
          console.warn("Server ignored state synchronization update:", res.error);
        }
      } catch (err) {
        console.warn("Failed to push synchronized update:", err);
      }
    };
    const timeout = setTimeout(saveSync, 300);
    return () => clearTimeout(timeout);
  }, [menuItems, ingredients, recipes, staffList, orders, customers, purchases, shifts, settings, activeTenant.tenantId]);

  // Sync active shift details when current staff logs in
  useEffect(() => {
    if (currentStaff) {
      const active = shifts.find((s) => s.staffId === currentStaff.id && s.status === "Active");
      setActiveShift(active || null);
    } else {
      setActiveShift(null);
    }
  }, [currentStaff, shifts]);

  // Sync currentStaff details if staffList changes (e.g. owner edits PIN or permissions)
  useEffect(() => {
    if (currentStaff) {
      const updated = staffList.find((s) => s.id === currentStaff.id);
      if (updated) {
        if (
          updated.pin !== currentStaff.pin ||
          updated.permissions.length !== currentStaff.permissions.length ||
          !updated.permissions.every((p) => currentStaff.permissions.includes(p))
        ) {
          setCurrentStaff(updated);
        }
      }
    }
  }, [staffList, currentStaff]);

  // Handle Employee Login
  const handleLoginSuccess = (staff: StaffMember, sessionId?: string) => {
    setCurrentStaff(staff);
    if (sessionId) {
      setCurrentSessionId(sessionId);
    }
    // If reports permission is missing, fall back to billing
    if (!staff.permissions.includes("reports") && staff.permissions.includes("billing")) {
      setActiveTab("billing");
    } else if (staff.permissions.includes("reports")) {
      setActiveTab("dashboard");
    } else if (staff.permissions.includes("inventory")) {
      setActiveTab("inventory");
    } else {
      setActiveTab("shifts");
    }
  };

  // Handle Employee Logout / Terminal lock
  const handleLogout = () => {
    if (currentSessionId) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, tenantId: activeTenant.tenantId })
      }).catch(err => console.error("Logout propagation failed:", err));
    }
    setCurrentStaff(null);
    setCurrentSessionId(null);
  };

  // Clock In / Clock Out shift actions
  const handleShiftAction = () => {
    if (!currentStaff) return;

    if (activeShift) {
      // Clocking out
      const updatedShifts = shifts.map((s) =>
        s.id === activeShift.id
          ? { ...s, endTime: new Date().toISOString(), status: "Completed" as const }
          : s
      );
      setShifts(updatedShifts);
      alert(`Successfully clocked out. Shift duration: ${getShiftDurationString(activeShift.startTime)}`);
    } else {
      // Clocking in
      const newShift: Shift = {
        id: `sh-${Date.now()}`,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        role: currentStaff.role,
        startTime: new Date().toISOString(),
        status: "Active"
      };
      setShifts([...shifts, newShift]);
      alert("Welcome to duty! Shift started successfully.");
    }
  };

  const getShiftDurationString = (startTime: string): string => {
    const diffMs = Date.now() - new Date(startTime).getTime();
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    if (diffHrs < 1) return `${diffMins} mins`;
    return `${diffHrs}h ${diffMins}m`;
  };

  // Global order creation handler
  const handleOrderCreated = (newOrder: Order) => {
    setOrders([newOrder, ...orders]);
  };

  // Handle Kitchen KDS status change and payment settlement
  const handleUpdateOrderStatus = (orderId: string, nextStatus: any, paymentMethod?: 'Cash' | 'UPI', paidAt?: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const updated = { ...o, status: nextStatus };
          if (paymentMethod) updated.paymentMethod = paymentMethod;
          if (paidAt) updated.paidAt = paidAt;
          return updated;
        }
        return o;
      })
    );
  };

  // Handle Ingredient stock updates
  const handleUpdateIngredients = (updated: Ingredient[]) => {
    setIngredients(updated);
  };

  // Handle Recipe updates
  const handleUpdateRecipes = (updated: Recipe[]) => {
    setRecipes(updated);
  };

  // Handle Menu Item updates (including additions and deletions)
  const handleUpdateMenuItems = (updated: MenuItem[]) => {
    setMenuItems(updated);
  };

  // Handle Purchase log creation
  const handleAddPurchase = (purchase: Purchase) => {
    setPurchases([purchase, ...purchases]);
  };

  // Super Admin Tenant registration
  const handleRegisterTenant = (newTenant: RestaurantTenant) => {
    setTenants([...tenants, newTenant]);
  };

  // Calculate Real-Time Stats for Dashboard Bento Grid
  const dashboardStats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter((o) => new Date(o.date).toDateString() === today);
    const totalRevenue = todayOrders
      .filter((o) => o.status !== "Cancelled")
      .reduce((sum, o) => sum + o.total, 0);

    const cashRevenue = todayOrders
      .filter((o) => o.status !== "Cancelled" && o.paymentMethod === "Cash")
      .reduce((sum, o) => sum + o.total, 0);

    const upiRevenue = todayOrders
      .filter((o) => o.status !== "Cancelled" && o.paymentMethod === "UPI")
      .reduce((sum, o) => sum + o.total, 0);

    const activeShiftsCount = shifts.filter((s) => s.status === "Active").length;
    const lowStockItems = ingredients.filter((ing) => ing.currentStock <= ing.minStock);
    const totalStockValue = ingredients.reduce((sum, ing) => sum + ing.currentStock * ing.costPerUnit, 0);

    // Calculate top selling menu item
    const itemSalesMap: { [id: string]: { name: string; qty: number; sales: number } } = {};
    orders
      .filter((o) => o.status !== "Cancelled")
      .forEach((order) => {
        order.items.forEach((item) => {
          if (!itemSalesMap[item.menuItem.id]) {
            itemSalesMap[item.menuItem.id] = {
              name: item.menuItem.name,
              qty: 0,
              sales: 0
            };
          }
          itemSalesMap[item.menuItem.id].qty += item.quantity;
          itemSalesMap[item.menuItem.id].sales += item.quantity * item.menuItem.price;
        });
      });

    const sortedSales = Object.values(itemSalesMap).sort((a, b) => b.qty - a.qty);
    const topSellingItems = sortedSales.slice(0, 3);

    return {
      totalRevenue,
      cashRevenue,
      upiRevenue,
      totalOrders: todayOrders.length,
      activeShiftsCount,
      lowStockItems,
      totalStockValue,
      topSellingItems
    };
  }, [orders, shifts, ingredients]);

  // Request executive business report using Gemini API route proxy
  const handleGenerateAIReport = async () => {
    setIsGeneratingReport(true);
    setReportError("");
    setAiReport("");

    try {
      const data = await ApiClient.generateReport({
        salesData: {
          totalRevenue: dashboardStats.totalRevenue,
          totalOrders: dashboardStats.totalOrders,
          cashRevenue: dashboardStats.cashRevenue,
          upiRevenue: dashboardStats.upiRevenue,
          topSellingItems: dashboardStats.topSellingItems
        },
        inventoryData: {
          materials: ingredients.map((i) => ({ name: i.name, currentStock: i.currentStock, unit: i.unit })),
          lowStockItems: dashboardStats.lowStockItems,
          totalStockValue: dashboardStats.totalStockValue
        },
        shiftsData: {
          activeStaffCount: dashboardStats.activeShiftsCount,
          recentShifts: shifts.slice(-3).map((s) => ({ staffName: s.staffName, role: s.role, status: s.status }))
        }
      });

      if (data.success) {
        setAiReport(data.report);
      } else {
        setReportError(data.error || "Error response from reports API. Using calculated parameters fallback.");
      }
    } catch (err: any) {
      console.warn("Failed to generate report:", err);
      setReportError("Failed to communicate with report server. Please verify connections.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // If no cashier is currently authenticated, show landing page or PIN passcode terminal
  if (!currentStaff) {
    if (showTerminalLogin) {
      return (
        <>
          <PinLogin
            staffList={staffList}
            onLoginSuccess={handleLoginSuccess}
            restaurantName={activeTenant.name}
            tenantId={activeTenant.tenantId}
            onBackToLanding={() => setShowTerminalLogin(false)}
          />
          {/* Persistent global AI Support Copilot */}
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
          onSelectTenant={(t) => setActiveTenant(t)}
          onRegisterBusiness={(data) => {
            // 1. Create unique Tenant ID
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

            // 2. Create unique Owner staff details
            const cleanedOwner = data.ownerName.toLowerCase().replace(/[^a-z0-9]/g, "");
            const ownerId = `s-${cleanedOwner}-${randomSuffix}`;
            const newOwner: StaffMember = {
              id: ownerId,
              name: data.ownerName,
              role: "Owner",
              pin: data.pin,
              permissions: ["billing", "inventory", "reports", "settings"]
            };

            // Set the pending owner ref so the new tenant database initializes with this owner
            pendingOwnerRef.current = newOwner;

            // 3. Add Tenant to database state list
            setTenants((prev) => [...prev, newTenant]);
            setActiveTenant(newTenant);

            // 4. Update staff list
            setStaffList((prev) => [...prev, newOwner]);

            // 5. Automatically authenticate owner to Operations Center
            setCurrentStaff(newOwner);
            setCurrentSessionId(`sess-reg-owner-${Date.now()}`);
            setActiveTab("dashboard");
            
            alert(`Success! "${data.businessName}" is now fully registered. Terminal ID: ${newTenantId}. Logged in with Owner permissions.`);
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
        {/* Persistent global AI Support Copilot */}
        <AICopilot activeTenant={activeTenant} currentStaff={currentStaff} />
      </>
    );
  }

  return (
    <div className="h-screen w-full flex bg-[#f8fafc] text-[#1e293b] font-sans overflow-hidden select-none">
      
      {/* LEFT SIDEBAR (Dark Slate Theme exactly like Design HTML) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentStaff={currentStaff}
        onLogout={handleLogout}
        activeShift={activeShift}
        onShiftAction={handleShiftAction}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* MAIN CONTAINER AREA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#fafbfd]">
        
        {/* HEADER BAR (Crisp White High-Contrast SaaS Style) */}
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
              {activeTab === "monitoring" && "Real-Time Telemetry & Log Monitoring"}
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

            {/* Live Notification Bell Indicator */}
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

        {/* WORKSPACE VIEW ROUTER */}
        <div className="flex-1 overflow-hidden">
          
          {/* TAB 1: OPERATIONAL DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="h-full p-6 flex flex-col gap-6 overflow-y-auto bg-[#fafbfd]">
              
              {/* METRIC CARD BENTO GRID (Crisp White High Density Style) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                
                {/* Net Sales card */}
                <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] flex flex-col justify-between transition hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Net Sales Today</p>
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100/30">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-extrabold mt-4 tracking-tight text-slate-900 font-display flex items-baseline gap-1">
                      <span className="text-xs text-slate-400 font-normal">INR</span>
                      <span>{dashboardStats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-50 text-[10px]">
                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      +100% Real
                    </span>
                    <span className="text-slate-400 font-mono">
                      Cash: {((dashboardStats.cashRevenue / (dashboardStats.totalRevenue || 1)) * 100).toFixed(0)}% • UPI: {((dashboardStats.upiRevenue / (dashboardStats.totalRevenue || 1)) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Open Orders card */}
                <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] flex flex-col justify-between transition hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Today's Transactions</p>
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100/30">
                        <Activity className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-extrabold mt-4 tracking-tight text-slate-900 font-display">
                      {dashboardStats.totalOrders} <span className="text-xs text-slate-400 font-normal font-sans">checkouts</span>
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-50 text-[10px]">
                    <span className="text-slate-500">
                      Avg ticket: <span className="font-mono text-slate-700 font-bold">INR {(dashboardStats.totalRevenue / (dashboardStats.totalOrders || 1)).toFixed(0)}</span>
                    </span>
                    <button onClick={() => setActiveTab("billing")} className="text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer">
                      New Ticket →
                    </button>
                  </div>
                </div>

                {/* Labor and shift attendance coverage */}
                <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] flex flex-col justify-between transition hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Labor Shift Coverage</p>
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100/30">
                        <Clock className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-extrabold mt-4 tracking-tight text-slate-900 font-display">
                      {dashboardStats.activeShiftsCount} <span className="text-xs text-slate-400 font-normal font-sans">on duty</span>
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-50 text-[10px]">
                    <span className="text-slate-500 truncate max-w-[140px]" title={shifts.filter(s => s.status === 'Active').map(s => s.staffName.split(" ")[0]).join(", ")}>
                      Active: <span className="font-semibold text-slate-700">{shifts.filter(s => s.status === 'Active').map(s => s.staffName.split(" ")[0]).join(", ") || 'None'}</span>
                    </span>
                    <button onClick={() => setActiveTab("shifts")} className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline cursor-pointer">
                      Roster logs
                    </button>
                  </div>
                </div>

                {/* Critical Stock Alerts card */}
                <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] flex flex-col justify-between transition hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Critical Stock Alerts</p>
                      <div className={`p-2 rounded-lg border ${dashboardStats.lowStockItems.length > 0 ? "bg-red-50 text-red-600 border-red-100 animate-pulse" : "bg-slate-50 text-slate-400 border-slate-100"}`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className={`text-2xl font-extrabold mt-4 tracking-tight font-display ${dashboardStats.lowStockItems.length > 0 ? "text-red-600" : "text-slate-900"}`}>
                      {dashboardStats.lowStockItems.length} <span className="text-xs text-slate-400 font-normal font-sans">materials</span>
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-50 text-[10px]">
                    <span className="text-slate-500 truncate max-w-[145px]" title={dashboardStats.lowStockItems.length > 0 ? `Needs reorder: ${dashboardStats.lowStockItems.map(i => i.name).join(", ")}` : "All ingredients sufficient"}>
                      {dashboardStats.lowStockItems.length > 0 ? `Low: ${dashboardStats.lowStockItems.map(i => i.name).join(", ")}` : "All levels healthy"}
                    </span>
                    <button onClick={() => setActiveTab("inventory")} className="text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer">
                      Reorder →
                    </button>
                  </div>
                </div>
              </div>

              {/* SPLIT DETAILS ROW */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                
                {/* LEFT TABLE: REAL TIME ORDERS STREAM (SaaS High-Contrast Grid) */}
                <div className="col-span-12 lg:col-span-8 bg-white border border-slate-150 rounded-2xl flex flex-col shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] overflow-hidden min-h-[350px]">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900 tracking-tight font-display">Real-time Order Stream</h3>
                      <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded text-[9px] font-mono font-bold animate-pulse">LIVE SYNC</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Synced seconds ago</span>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50/75 border-b border-slate-100 sticky top-0 text-slate-500 font-bold">
                        <tr>
                          <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-500">ID</th>
                          <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-500">Staff Server</th>
                          <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-500">Table Ref</th>
                          <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-500">Items Ordered</th>
                          <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-500">Method</th>
                          <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-500">Total</th>
                          <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {orders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-12 text-center text-slate-400 italic font-sans">No checkout records received today.</td>
                          </tr>
                        ) : (
                          orders.map((order) => {
                            const itemsSummarized = order.items.map((i) => `${i.menuItem.name} (x${i.quantity})`).join(", ");
                            return (
                              <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3.5 font-mono">
                                  <span className="bg-blue-50 border border-blue-100/30 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                    #{order.orderNumber}
                                  </span>
                                </td>
                                <td className="p-3.5 font-medium text-slate-700">{order.cashierName}</td>
                                <td className="p-3.5 text-slate-500">{order.tableNo || "Takeaway"}</td>
                                <td className="p-3.5 max-w-[200px] truncate text-slate-600 font-medium" title={itemsSummarized}>{itemsSummarized}</td>
                                <td className="p-3.5">
                                  {order.paymentMethod ? (
                                    <span className="bg-slate-100 border border-slate-200/50 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold text-[9px]">
                                      {order.paymentMethod}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Unsettled</span>
                                  )}
                                </td>
                                <td className="p-3.5 font-bold text-slate-900 font-mono text-[11px]">INR {order.total}</td>
                                <td className="p-3.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      order.status === "Completed"
                                        ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                        : order.status === "Preparing"
                                        ? "bg-blue-50 border-blue-100 text-blue-700"
                                        : order.status === "Ready"
                                        ? "bg-amber-50 border-amber-100 text-amber-700 animate-pulse"
                                        : order.status === "Cancelled"
                                        ? "bg-rose-50 border-rose-100 text-rose-700"
                                        : "bg-slate-50 border-slate-150 text-slate-600"
                                    }`}
                                  >
                                    {order.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  </div>
                </div>

                {/* RIGHT CARDS: TOP DISHES & INGREDIENT PROGRESS */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-hidden">
                  
                  {/* Top dishes card */}
                  <div className="bg-white border border-slate-150 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
                      <h3 className="font-bold text-sm text-slate-900 font-display">Popular Menu Items</h3>
                      <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 text-[9px] font-extrabold uppercase font-mono rounded">Sales Leaderboard</span>
                    </div>
                    <div className="p-5 space-y-3">
                      {dashboardStats.topSellingItems.length === 0 ? (
                        <p className="text-slate-400 text-xs italic">No sales logs to compute popularity yet.</p>
                      ) : (
                        dashboardStats.topSellingItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 bg-blue-50 border border-blue-100/30 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px]">
                                {idx + 1}
                              </span>
                              <span className="font-semibold text-slate-800">{item.name}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">
                              <b className="text-slate-800 font-bold">{item.qty}</b> portions
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Stock Levels Progress Bar Widget */}
                  <div className="bg-white border border-slate-150 rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] flex flex-col flex-1">
                    <div className="p-4 border-b border-slate-100 bg-white">
                      <h3 className="font-bold text-sm text-slate-900 font-display">Critical Ingredients</h3>
                    </div>
                    <div className="p-5 flex-1 space-y-4 overflow-y-auto">
                      {ingredients.slice(0, 4).map((ing) => {
                        const percent = Math.min(100, (ing.currentStock / (ing.minStock * 2 || 1)) * 100);
                        const isLow = ing.currentStock <= ing.minStock;
                        return (
                          <div key={ing.id} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                              <span className="text-slate-800 font-medium">{ing.name}</span>
                              <span className={`font-mono ${isLow ? "text-rose-500 font-bold" : "text-slate-500"}`}>
                                {ing.currentStock} {ing.unit} {isLow ? "• Warning" : ""}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${percent}%` }}
                                className={`h-full rounded-full transition-all duration-300 ${isLow ? "bg-red-500" : percent < 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                      <button
                        onClick={() => setActiveTab("inventory")}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                      >
                        Adjust Raw Inventory
                      </button>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 2: POINT-OF-SALE BILLING TERMINAL */}
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

          {/* TAB 3: KITCHEN DISPLAY SYSTEM */}
          {activeTab === "kds" && (
            <KitchenKDS
              orders={orders}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              kdsSoundAlerts={settings.kdsSoundAlerts}
            />
          )}

          {/* TAB: CRM & LOYALTY DATABASE */}
          {activeTab === "crm" && (
            <CRMLoyalty
              customers={customers}
              setCustomers={setCustomers}
            />
          )}

          {/* TAB: DELIVERY INTEGRATION (ZOMATO & SWIGGY) */}
          {activeTab === "delivery" && (
            <DeliveryIntegration
              menuItems={menuItems}
              onUpdateMenuItems={handleUpdateMenuItems}
              orders={orders}
              onOrderCreated={handleOrderCreated}
            />
          )}

          {/* TAB 4: INVENTORY & RECIPES LEDGER */}
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

          {/* TAB 5: STAFF ROSTER SHIFTS */}
          {activeTab === "shifts" && (
            <StaffShifts
              shifts={shifts}
              activeShift={activeShift}
              onShiftAction={handleShiftAction}
              currentStaff={currentStaff}
              staffList={staffList}
              onUpdateStaffList={setStaffList}
            />
          )}

          {/* TAB 6: AUTOMATED AI ANALYTICS AUDIT */}
          {activeTab === "ai-reports" && (
            <div className="h-full p-6 flex flex-col gap-6 overflow-y-auto bg-[#f8fafc]">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-500" />
                      Gemini Real-Time Operational Audit
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Generate a smart, deep-dive business analysis of sales momentum, raw materials reorder matrix, and labor utility.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleGenerateAIReport}
                    disabled={isGeneratingReport}
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-2 whitespace-nowrap self-start"
                  >
                    {isGeneratingReport ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Querying Gemini 3.5...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-white/90" />
                        <span>Trigger AI Diagnosis</span>
                      </>
                    )}
                  </button>
                </div>

                {reportError && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2.5">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">System Warning:</span> {reportError}
                    </div>
                  </div>
                )}

                {/* AI report rendering area */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 min-h-[400px] shadow-inner">
                  {isGeneratingReport ? (
                    <div className="h-[350px] flex flex-col items-center justify-center text-center text-slate-400 space-y-4">
                      <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin" />
                      <div>
                        <p className="font-semibold text-slate-600">Evaluating restaurant performance metrics...</p>
                        <p className="text-xs text-slate-400 mt-1">Computing raw ingredient margins and staffing allocations with Gemini AI.</p>
                      </div>
                    </div>
                  ) : aiReport ? (
                    <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-sans text-sm">
                      <MarkdownRenderer content={aiReport} />
                    </div>
                  ) : (
                    <div className="h-[350px] flex flex-col items-center justify-center text-center p-8 text-slate-500">
                      <span className="text-5xl filter brightness-90 mb-4">📈</span>
                      <h3 className="font-semibold text-slate-600 text-sm">No Audit Record Generated</h3>
                      <p className="text-xs text-slate-400 max-w-sm mt-1">
                        Click the "Trigger AI Diagnosis" button above. The system will compile active sales, shifts, and raw stock parameters, and call Gemini's advanced reasoning engine.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB: SAAS ADMIN MULTI-TENANT DASHBOARD */}
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

          {/* TAB: BACKGROUND JOBS MANAGEMENT */}
          {activeTab === "jobs" && (
            <BackgroundJobsDashboard />
          )}

          {/* TAB: CENTRAL NOTIFICATION CENTER */}
          {activeTab === "notifications" && (
            <NotificationCenter />
          )}

          {/* TAB: EVENT DRIVEN ARCHITECTURE DASHBOARD */}
          {activeTab === "events" && (
            <EventDrivenDashboard />
          )}

          {/* TAB 7: EDIT RULES SETTINGS */}
          {activeTab === "settings" && (
            <div className="h-full p-6 bg-[#f8fafc] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-6xl mx-auto">
                
                {/* Left Side: Terminal & Operational Rules */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
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

                {/* Right Side: Owner Credentials & Permissions Control */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-blue-600" />
                      Staff Credentials & Permissions Control
                    </h2>
                    
                    {currentStaff.role !== "Owner" ? (
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
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-500">PIN:</span>
                                  <input
                                    type="text"
                                    maxLength={4}
                                    placeholder="PIN"
                                    value={staff.pin}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, ""); // numeric only
                                      const updatedList = staffList.map((s) =>
                                        s.id === staff.id ? { ...s, pin: val } : s
                                      );
                                      setStaffList(updatedList);
                                    }}
                                    className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white text-xs"
                                  />
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
          )}

          {/* TAB: MONITORING & SYSTEM TELEMETRY */}
          {activeTab === "monitoring" && (
            <ApplicationMonitoringDashboard />
          )}

          {/* TAB: SECURITY & SESSIONS CONTROL CENTER */}
          {activeTab === "security" && (
            <SessionManagementDashboard
              currentSessionId={currentSessionId}
              onSessionTerminated={handleLogout}
            />
          )}

        </div>

      </main>

      {/* Persistent global AI Support Copilot */}
      <AICopilot activeTenant={activeTenant} currentStaff={currentStaff} />

      {/* ⚠️ IDLE TIMEOUT FLOATING OVERLAY MODAL */}
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
                lastActivityRef.current = Date.now();
                setShowIdleWarning(false);
                setIdleCountdown(30);
                if (currentSessionId) {
                  fetch("/api/auth/validate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId: currentSessionId, tenantId: activeTenant.tenantId })
                  }).catch(err => console.error(err));
                }
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/10 transition cursor-pointer"
            >
              Keep Me Logged In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
