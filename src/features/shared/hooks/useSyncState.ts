import { useState, useEffect, useRef, useMemo } from "react";
import { MenuItem, Ingredient, Recipe, Purchase, StaffMember, Shift, Order, InventorySettings, Customer } from "../types";
import { ApiClient } from "../services/api";
import { createClient } from "@supabase/supabase-js";
import {
  INITIAL_MENU_ITEMS,
  INITIAL_INGREDIENTS,
  INITIAL_RECIPES,
  INITIAL_STAFF,
  INITIAL_ORDERS,
  INITIAL_CUSTOMERS
} from "../data";

interface UseSyncStateProps {
  activeTenantId: string;
  currentStaff: StaffMember | null;
  currentSessionId: string | null;
}

export function useSyncState({ activeTenantId, currentStaff, currentSessionId }: UseSyncStateProps) {
  const isMainTenant = activeTenantId === "veg-main-001";

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => INITIAL_MENU_ITEMS);
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => INITIAL_INGREDIENTS);
  const [recipes, setRecipes] = useState<Recipe[]>(() => INITIAL_RECIPES);
  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    if (isMainTenant) return INITIAL_STAFF;
    const isReetesh = activeTenantId === "veg-reetesh-dhaba";
    const isCP = activeTenantId === "veg-cp-002";
    let list = INITIAL_STAFF.map(s => ({ ...s, id: `${s.id}-${activeTenantId}` }));
    if (isReetesh) {
      list = list.map(s => s.role === "Owner" ? { ...s, name: "Reetesh", pin: "12345" } : s);
    } else if (isCP) {
      list = list.map(s => s.role === "Owner" ? { ...s, name: "Amit Verma", pin: "22222" } : s);
    }
    return list;
  });
  const [orders, setOrders] = useState<Order[]>(() => INITIAL_ORDERS);
  const [customers, setCustomers] = useState<Customer[]>(() => INITIAL_CUSTOMERS);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [shifts, setShifts] = useState<Shift[]>(() => isMainTenant ? [
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
  ] : []);

  const [settings, setSettings] = useState<InventorySettings>({
    autoDeductStock: true,
    blockOrdersIfInsufficient: true,
    managerCanAddPurchases: true,
    managerCanEditRecipes: true,
    kdsSoundAlerts: false,
    quickPinRequired: false,
    sentryDsn: "",
    slackWebhookUrl: "",
    emailAlertAddress: "",
    enableAlerts: true,
    gstPercentage: 5
  });

  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Gemini AI Report State
  const [aiReport, setAiReport] = useState<string>("");
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string>("");

  // Sync state refs
  const isLoadedRef = useRef(false);
  const loadedTenantIdRef = useRef<string>("");
  const pendingOwnerRef = useRef<StaffMember | null>(null);
  const hasPendingChangesRef = useRef(false);
  const lastSaveTimeRef = useRef(0);
  const lastFetchedStateRef = useRef<string>("");

  // Reset states synchronously when activeTenantId changes to avoid showing stale data from previous tenant
  useEffect(() => {
    const isMain = activeTenantId === "veg-main-001";
    setMenuItems(INITIAL_MENU_ITEMS);
    setIngredients(INITIAL_INGREDIENTS);
    setRecipes(INITIAL_RECIPES);
    setOrders(INITIAL_ORDERS);
    setCustomers(INITIAL_CUSTOMERS);
    setPurchases([]);
    
    let list = INITIAL_STAFF;
    if (!isMain) {
      const isReetesh = activeTenantId === "veg-reetesh-dhaba";
      const isCP = activeTenantId === "veg-cp-002";
      list = INITIAL_STAFF.map(s => ({ ...s, id: `${s.id}-${activeTenantId}` }));
      if (isReetesh) {
        list = list.map(s => s.role === "Owner" ? { ...s, name: "Reetesh", pin: "12345" } : s);
      } else if (isCP) {
        list = list.map(s => s.role === "Owner" ? { ...s, name: "Amit Verma", pin: "22222" } : s);
      }
    }
    setStaffList(list);

    setShifts(isMain ? [
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
    ] : []);
    
    setSettings({
      autoDeductStock: true,
      blockOrdersIfInsufficient: true,
      managerCanAddPurchases: true,
      managerCanEditRecipes: true,
      kdsSoundAlerts: false,
      quickPinRequired: false,
      sentryDsn: "",
      slackWebhookUrl: "",
      emailAlertAddress: "",
      enableAlerts: true,
      gstPercentage: 5
    });

    isLoadedRef.current = false;
    loadedTenantIdRef.current = "";
    lastFetchedStateRef.current = "";
  }, [activeTenantId]);

  // Toast Auto-dismiss Timer Effect
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Initial Sync load & Background Sync Polling
  useEffect(() => {
    if (!currentStaff || !currentSessionId) {
      return;
    }
    let active = true;
    isLoadedRef.current = false;

    let channel: any = null;
    let supabase: any = null;
    let interval: any = null;

    const fetchSyncUpdates = async () => {
      try {
        if (hasPendingChangesRef.current || (Date.now() - lastSaveTimeRef.current < 1500)) {
          return;
        }

        const json = await ApiClient.getTenantSync(activeTenantId, currentSessionId || undefined);
        if (!active) return;

        if (hasPendingChangesRef.current || (Date.now() - lastSaveTimeRef.current < 1500)) {
          return;
        }

        if (json.success && json.initialized && json.data) {
          const d = json.data;
          if (loadedTenantIdRef.current === activeTenantId) {
            const serverStateStr = JSON.stringify({
              menuItems: d.menuItems,
              ingredients: d.ingredients,
              recipes: d.recipes,
              staffList: d.staffList,
              orders: d.orders,
              customers: d.customers,
              purchases: d.purchases,
              shifts: d.shifts,
              settings: d.settings
            });
            lastFetchedStateRef.current = serverStateStr;

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
        console.warn("[Realtime] Skipped background synchronization update due to network status:", err);
      }
    };

    const fetchSync = async () => {
      try {
        const json = await ApiClient.getTenantSync(activeTenantId, currentSessionId || undefined);
        if (!active) return;

        if (json.success && json.initialized && json.data) {
          const d = json.data;
          
          const serverStateStr = JSON.stringify({
            menuItems: d.menuItems,
            ingredients: d.ingredients,
            recipes: d.recipes,
            staffList: d.staffList,
            orders: d.orders,
            customers: d.customers,
            purchases: d.purchases,
            shifts: d.shifts,
            settings: d.settings
          });
          lastFetchedStateRef.current = serverStateStr;

          if (d.menuItems) setMenuItems(d.menuItems);
          if (d.ingredients) setIngredients(d.ingredients);
          if (d.recipes) setRecipes(d.recipes);
          if (d.staffList) setStaffList(d.staffList);
          if (d.orders) setOrders(d.orders);
          if (d.customers) setCustomers(d.customers);
          if (d.purchases) setPurchases(d.purchases);
          if (d.shifts) setShifts(d.shifts);
          if (d.settings) setSettings(d.settings);
          
          loadedTenantIdRef.current = activeTenantId;
          isLoadedRef.current = true;
        } else if (json.success && !json.initialized) {
          const isMainTenant = activeTenantId === "veg-main-001";
          
          let initialStaffList = isMainTenant ? INITIAL_STAFF : INITIAL_STAFF.map(s => ({ ...s, id: `${s.id}-${activeTenantId}` }));
          if (activeTenantId === "veg-reetesh-dhaba") {
            initialStaffList = initialStaffList.map(s => {
              if (s.role === "Owner") {
                return {
                  ...s,
                  name: "Reetesh",
                  pin: "12345"
                };
              }
              return s;
            });
          } else if (activeTenantId === "veg-cp-002") {
            initialStaffList = initialStaffList.map(s => {
              if (s.role === "Owner") {
                return {
                  ...s,
                  name: "Amit Verma",
                  pin: "22222"
                };
              }
              return s;
            });
          }
          if (pendingOwnerRef.current) {
            initialStaffList = [pendingOwnerRef.current, ...initialStaffList.filter(s => s.role !== "Owner")];
            pendingOwnerRef.current = null;
          }

          const initialPayload = {
            menuItems: INITIAL_MENU_ITEMS,
            ingredients: INITIAL_INGREDIENTS,
            recipes: INITIAL_RECIPES,
            staffList: initialStaffList,
            orders: INITIAL_ORDERS,
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
            ] : [
              {
                id: "sh-1",
                staffId: `s-rahul-${activeTenantId}`,
                staffName: activeTenantId === "veg-reetesh-dhaba" ? "Reetesh" : "Amit Verma",
                role: "Owner" as const,
                startTime: new Date(Date.now() - 3600000 * 4).toISOString(),
                status: "Active" as const
              }
            ],
            settings: {
              autoDeductStock: true,
              blockOrdersIfInsufficient: true,
              managerCanAddPurchases: true,
              managerCanEditRecipes: true,
              kdsSoundAlerts: false,
              quickPinRequired: false
            }
          };

          const saveRes = await ApiClient.saveTenantSync(activeTenantId, initialPayload, currentSessionId || undefined);
          
          if (active && saveRes.success) {
            const serverStateStr = JSON.stringify({
              menuItems: initialPayload.menuItems,
              ingredients: initialPayload.ingredients,
              recipes: initialPayload.recipes,
              staffList: initialPayload.staffList,
              orders: initialPayload.orders,
              customers: initialPayload.customers,
              purchases: initialPayload.purchases,
              shifts: initialPayload.shifts,
              settings: initialPayload.settings
            });
            lastFetchedStateRef.current = serverStateStr;

            setMenuItems(initialPayload.menuItems);
            setIngredients(initialPayload.ingredients);
            setRecipes(initialPayload.recipes);
            setStaffList(initialPayload.staffList);
            setOrders(initialPayload.orders);
            setCustomers(initialPayload.customers);
            setPurchases(initialPayload.purchases);
            setShifts(initialPayload.shifts);
            setSettings(initialPayload.settings);
            
            loadedTenantIdRef.current = activeTenantId;
            isLoadedRef.current = true;
          }
        } else if (json.error) {
          throw new Error(json.error);
        }
      } catch (err) {
        console.warn("Failed to perform initial database synchronization for tenant:", activeTenantId, err);
      }
    };

    const startPollingFallback = () => {
      console.log(`[Realtime] Fallback polling enabled (3.5s interval) for tenant: ${activeTenantId}`);
      interval = setInterval(async () => {
        if (hasPendingChangesRef.current || (Date.now() - lastSaveTimeRef.current < 2500)) {
          return;
        }
        await fetchSyncUpdates();
      }, 3500);
    };

    const setupRealtime = async () => {
      try {
        const configRes = await ApiClient.getSupabaseConfig();
        if (!active) return;

        if (configRes.success && configRes.supabaseUrl && configRes.supabaseAnonKey &&
            configRes.supabaseUrl !== "YOUR_SUPABASE_URL" && configRes.supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY") {
          
          supabase = createClient(configRes.supabaseUrl, configRes.supabaseAnonKey);
          
          channel = supabase
            .channel(`public:tenant-${activeTenantId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public'
              },
              (payload: any) => {
                const payloadTenantId = payload.new?.tenant_id || payload.old?.tenant_id;
                if (payloadTenantId && payloadTenantId !== activeTenantId) {
                  return;
                }
                
                // Do not fetch if we have local unsaved mutations
                if (hasPendingChangesRef.current || (Date.now() - lastSaveTimeRef.current < 1500)) {
                  return;
                }

                fetchSyncUpdates();
              }
            )
            .subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                console.log(`[Realtime] Successfully subscribed to live changes for tenant: ${activeTenantId}`);
              }
            });
            
        } else {
          startPollingFallback();
        }
      } catch (err) {
        console.warn("[Realtime] Failed to initialize Supabase Realtime subscriptions. Falling back to polling.", err);
        startPollingFallback();
      }
    };

    // Execute Initial Load
    fetchSync().then(() => {
      if (active) {
        // Setup Realtime connection (or fallback)
        setupRealtime();
      }
    });

    return () => {
      active = false;
      if (interval) {
        clearInterval(interval);
      }
      if (supabase && channel) {
        supabase.removeChannel(channel);
        console.log(`[Realtime] Cleaned up Supabase subscription channel for tenant: ${activeTenantId}`);
      }
    };
  }, [activeTenantId, currentStaff, currentSessionId]);

  // Sync state modifications to server
  useEffect(() => {
    if (!isLoadedRef.current || loadedTenantIdRef.current !== activeTenantId || !currentSessionId) {
      return;
    }

    const currentState = {
      menuItems,
      ingredients,
      recipes,
      staffList,
      orders,
      customers,
      purchases,
      shifts,
      settings
    };

    const currentStateStr = JSON.stringify(currentState);

    if (currentStateStr === lastFetchedStateRef.current) {
      return;
    }

    hasPendingChangesRef.current = true;

    const saveSync = async () => {
      try {
        const res = await ApiClient.saveTenantSync(activeTenantId, currentState, currentSessionId || undefined);
        if (res.success) {
          hasPendingChangesRef.current = false;
          lastSaveTimeRef.current = Date.now();
          lastFetchedStateRef.current = currentStateStr;
        } else {
          console.warn("Server ignored state synchronization update:", res.error);
          setToastMessage({
            type: "error",
            text: `Data Sync Issue: ${res.error || "The server rejected the transaction packet."}`
          });
        }
      } catch (err: any) {
        console.warn("Failed to push synchronized update:", err);
        setToastMessage({
          type: "error",
          text: `Database Connection Failed: ${err.message || "Network offline or access denied."}`
        });
      }
    };
    const timeout = setTimeout(saveSync, 300);
    return () => clearTimeout(timeout);
  }, [menuItems, ingredients, recipes, staffList, orders, customers, purchases, shifts, settings, activeTenantId, currentSessionId]);

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

  // Handle Menu Item updates
  const handleUpdateMenuItems = (updated: MenuItem[]) => {
    setMenuItems(updated);
  };

  // Handle Purchase log creation
  const handleAddPurchase = (purchase: Purchase) => {
    setPurchases([purchase, ...purchases]);
  };

  // Calculate Real-Time Stats for Dashboard Bento Grid
  const dashboardStats = useMemo(() => {
    const safeOrders = orders || [];
    const safeShifts = shifts || [];
    const safeIngredients = ingredients || [];

    const today = new Date().toDateString();
    const todayOrders = safeOrders.filter((o) => o && o.date && new Date(o.date).toDateString() === today);
    const totalRevenue = todayOrders
      .filter((o) => o && o.status !== "Cancelled")
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const cashRevenue = todayOrders
      .filter((o) => o && o.status !== "Cancelled" && o.paymentMethod === "Cash")
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const upiRevenue = todayOrders
      .filter((o) => o && o.status !== "Cancelled" && o.paymentMethod === "UPI")
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const activeShiftsCount = safeShifts.filter((s) => s && s.status === "Active").length;
    const lowStockItems = safeIngredients.filter((ing) => ing && ing.currentStock <= ing.minStock);
    const totalStockValue = safeIngredients.reduce((sum, ing) => sum + (ing ? (ing.currentStock || 0) * (ing.costPerUnit || 0) : 0), 0);

    const itemSalesMap: { [id: string]: { name: string; qty: number; sales: number } } = {};
    safeOrders
      .filter((o) => o && o.status !== "Cancelled")
      .forEach((order) => {
        if (!order || !order.items) return;
        order.items.forEach((item) => {
          if (!item || !item.menuItem) return;
          const mId = item.menuItem.id;
          if (!mId) return;
          if (!itemSalesMap[mId]) {
            itemSalesMap[mId] = {
              name: item.menuItem.name || "Unknown Item",
              qty: 0,
              sales: 0
            };
          }
          itemSalesMap[mId].qty += item.quantity || 0;
          itemSalesMap[mId].sales += (item.quantity || 0) * (item.menuItem.price || 0);
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

  return {
    menuItems,
    setMenuItems,
    ingredients,
    setIngredients,
    recipes,
    setRecipes,
    staffList,
    setStaffList,
    orders,
    setOrders,
    customers,
    setCustomers,
    purchases,
    setPurchases,
    shifts,
    setShifts,
    settings,
    setSettings,
    toastMessage,
    setToastMessage,
    aiReport,
    setAiReport,
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
    handleAddPurchase
  };
}
