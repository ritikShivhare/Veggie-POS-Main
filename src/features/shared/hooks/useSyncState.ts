import { useState, useEffect, useRef, useMemo } from "react";
import { MenuItem, Ingredient, Recipe, Purchase, StaffMember, Shift, Order, InventorySettings, Customer } from "../types";
import { ApiClient, SyncResponse } from "../services/api";
import { offlineRepository, OutboxProcessor } from "../services/offline";

interface UseSyncStateProps {
  activeTenantId: string;
  currentStaff: StaffMember | null;
  currentSessionId: string | null;
}

// Helper to safely retrieve cached tenant state
function getCachedTenantData(tenantId: string) {
  try {
    const raw = localStorage.getItem(`veggiepos_sync_cache_${tenantId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Filter out legacy demo items if previously cached
      if (parsed.menuItems && Array.isArray(parsed.menuItems)) {
        parsed.menuItems = parsed.menuItems.filter((m: any) => m.id !== "m-thali" && m.id !== "m-paneer-butter" && m.id !== "m-paneer-tikka");
      }
      if (parsed.orders && Array.isArray(parsed.orders)) {
        parsed.orders = parsed.orders.filter((o: any) => !o.id?.startsWith("ORD-100"));
      }
      if (parsed.staffList && Array.isArray(parsed.staffList)) {
        parsed.staffList = parsed.staffList.filter((s: any) => s.id !== "s-rahul" && s.id !== "s-amit" && s.id !== "s-mohan");
      }
      return parsed;
    }
  } catch (e) {
    console.warn("Failed to read local sync cache:", e);
  }
  return null;
}

export function useSyncState({ activeTenantId, currentStaff, currentSessionId }: UseSyncStateProps) {
  const isMainTenant = activeTenantId === "veg-main-001";
  const initialCache = getCachedTenantData(activeTenantId);

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => initialCache?.menuItems || []);
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => initialCache?.ingredients || []);
  const [recipes, setRecipes] = useState<Recipe[]>(() => initialCache?.recipes || []);
  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    if (initialCache?.staffList && initialCache.staffList.length > 0) return initialCache.staffList;
    if (currentStaff) return [currentStaff];
    return [];
  });
  const [orders, setOrders] = useState<Order[]>(() => initialCache?.orders || []);
  const [customers, setCustomers] = useState<Customer[]>(() => initialCache?.customers || []);
  const [purchases, setPurchases] = useState<Purchase[]>(() => initialCache?.purchases || []);
  const [shifts, setShifts] = useState<Shift[]>(() => initialCache?.shifts || []);

  const [settings, setSettings] = useState<InventorySettings>(() => initialCache?.settings || {
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
    gstPercentage: 5,
    gstin: "",
    upiVpa: "",
    upiMerchantName: ""
  });

  const [isInitialSyncLoading, setIsInitialSyncLoading] = useState<boolean>(false);
  const [isTenantDataReady, setIsTenantDataReady] = useState(false);
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

  // Reset or load cached states from IndexedDB offline database when activeTenantId changes
  useEffect(() => {
    let cancelled = false;

    async function loadFromIndexedDB() {
      try {
        const localData = await offlineRepository.getFullTenantState(activeTenantId);
        if (cancelled) return;

        if (localData.menuItems && localData.menuItems.length > 0) {
          setMenuItems(localData.menuItems);
          if (localData.ingredients && localData.ingredients.length > 0) setIngredients(localData.ingredients);
          if (localData.recipes && localData.recipes.length > 0) setRecipes(localData.recipes);
          if (localData.staffList && localData.staffList.length > 0) setStaffList(localData.staffList as any);
          if (localData.orders && localData.orders.length > 0) setOrders(localData.orders as any);
          if (localData.customers && localData.customers.length > 0) setCustomers(localData.customers as any);
          if (localData.shifts && localData.shifts.length > 0) setShifts(localData.shifts as any);
          if (localData.settings && Object.keys(localData.settings).length > 0) {
            setSettings(prev => ({ ...prev, ...localData.settings }));
          }
          setIsInitialSyncLoading(false);
          return;
        }
      } catch (err) {
        console.warn("[useSyncState] Error loading initial tenant state from IndexedDB:", err);
      }

      if (cancelled) return;
      // Do not block UI if local state is already available
      setIsInitialSyncLoading(false);
      setMenuItems([]);
      setIngredients([]);
      setRecipes([]);
      setOrders([]);
      setCustomers([]);
      setPurchases([]);
      setStaffList(currentStaff ? [currentStaff] : []);
      setShifts([]);
      
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
    }

    loadFromIndexedDB();

    isLoadedRef.current = false;
    setIsTenantDataReady(false);
    loadedTenantIdRef.current = "";
    lastFetchedStateRef.current = "";

    return () => {
      cancelled = true;
    };
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

  // Guaranteed safety watchdog: Never block the UI for more than 2.5 seconds under any circumstance
  useEffect(() => {
    if (isInitialSyncLoading) {
      const timer = setTimeout(() => {
        setIsInitialSyncLoading(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isInitialSyncLoading]);

  // Initial Sync load & Background Sync Polling
  useEffect(() => {
    if (!currentStaff || !currentSessionId) {
      setIsTenantDataReady(false);
      setIsInitialSyncLoading(false);
      return;
    }
    let active = true;
    offlineRepository.resumeAuthOperations(activeTenantId).then(()=>OutboxProcessor.triggerDrain(activeTenantId)).catch(console.warn);
    isLoadedRef.current = false;
    setIsTenantDataReady(false);

    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let pingInterval: any = null;
    let pollingInterval: any = null;

    let syncReadInFlight = false;
    const fetchSyncUpdates = async () => {
      if (!active || syncReadInFlight) return;
      syncReadInFlight = true;
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
          await offlineRepository.saveFullTenantState(activeTenantId,d);
          if (!active) return;
          d.orders=await offlineRepository.getOrders(activeTenantId) as Order[];
          if (!active) return;
          {
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
            setIsTenantDataReady(true);
            setIsInitialSyncLoading(false);

            try {
              offlineRepository.saveFullTenantState(activeTenantId, d).catch(e => console.warn(e));
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn("[Realtime] Skipped background synchronization update due to network status:", err);
      } finally {
        syncReadInFlight = false;
      }
    };

    const fetchSync = async () => {
      try {
        const json = await ApiClient.getTenantSync(activeTenantId, currentSessionId || undefined);
        if (!active) return;

        if (json.success && json.initialized && json.data) {
          const d = json.data;
          await offlineRepository.saveFullTenantState(activeTenantId,d);
          if (!active) return;
          d.orders=await offlineRepository.getOrders(activeTenantId) as Order[];
          if (!active) return;
          
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
          
          try {
            offlineRepository.saveFullTenantState(activeTenantId, d).catch(e => console.warn(e));
          } catch (e) {}

          loadedTenantIdRef.current = activeTenantId;
          isLoadedRef.current = true;
          setIsTenantDataReady(true);
          setIsInitialSyncLoading(false);
        } else if (json.success && !json.initialized) {
          setToastMessage({type:"error",text:"Restaurant setup is incomplete. Contact the owner."});
        } else if (json.error) {
          throw new Error(json.error);
        }
      } catch (err) {
        console.warn("Failed to perform initial database synchronization for tenant:", activeTenantId, err);
      } finally {
        if (active) {
          setIsInitialSyncLoading(false);
        }
      }
    };

    const startPollingFallback = () => {
      if (pollingInterval) return;
      console.log(`[Realtime] Fallback polling enabled (3.5s interval) for tenant: ${activeTenantId}`);
      pollingInterval = setInterval(async () => {
        if (hasPendingChangesRef.current || (Date.now() - lastSaveTimeRef.current < 2500)) {
          return;
        }
        await fetchSyncUpdates();
      }, 3500);
    };

    const setupServerMediatedRealtime = () => {
      if (!active) return;
      try {
        if (typeof window === "undefined" || !window.WebSocket) {
          startPollingFallback();
          return;
        }

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!active) {
            ws?.close();
            return;
          }
          console.log(`[Realtime] Connected to server-mediated WebSocket for authenticated tenant.`);
          
          // Send server auth message with session token
          if (currentSessionId && ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "auth", token: currentSessionId }));
          }

          // Trigger outbox drain on WebSocket connect/reconnect
          OutboxProcessor.triggerDrain(activeTenantId).catch(err => {
            console.warn("[Realtime] Outbox drain on WS connect error:", err);
          });

          // Heartbeat ping every 25s
          pingInterval = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "pong" || msg.type === "connection:ready") {
              return;
            }

            // Minimal payload event dispatched from server
            if (
              msg.type === "sync:updated" || msg.type === "order:created" || msg.type === "order:updated" || msg.type === "customer:updated" ||
              msg.type === "order:completed" ||
              msg.type === "inventory:updated" ||
              msg.type === "payment:success"
            ) {
              // Ensure we don't overwrite if local unsaved mutations exist
              if (hasPendingChangesRef.current || (Date.now() - lastSaveTimeRef.current < 1500)) {
                return;
              }
              fetchSyncUpdates();
            }
          } catch (e) {
            console.warn("[Realtime] Failed to parse WebSocket message:", e);
          }
        };

        ws.onerror = (err) => {
          console.warn("[Realtime] WebSocket encountered connection error. Enabling polling fallback.", err);
          startPollingFallback();
        };

        ws.onclose = (event) => {
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          if (!active) return;

          // If unauthorized (4401), do not reconnect continuously
          if (event.code === 4401) {
            console.warn("[Realtime] WebSocket closed with 4401 Unauthorized.");
            return;
          }

          // Automatic resilient reconnect after 3s
          reconnectTimer = setTimeout(() => {
            if (active) {
              setupServerMediatedRealtime();
            }
          }, 3000);
        };
      } catch (err) {
        console.warn("[Realtime] Failed to initialize server-mediated WebSocket. Falling back to polling.", err);
        startPollingFallback();
      }
    };

    // Execute Initial Load
    fetchSync().then(() => {
      if (active) {
        startPollingFallback();
        setupServerMediatedRealtime();
      }
    });

    return () => {
      active = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
      if (ws) {
        try {
          ws.close();
        } catch (e) {}
        ws = null;
      }
    };
  }, [activeTenantId, currentStaff, currentSessionId]);

  // Save only changed management records. Orders/payments/purchases have one
  // durable command path and are never replayed as snapshots.
  useEffect(()=>{
    if(!isLoadedRef.current || loadedTenantIdRef.current!==activeTenantId || !currentSessionId || !["Owner","Manager"].includes(currentStaff?.role || "")) return;
    const baseline=JSON.parse(lastFetchedStateRef.current || "{}");
    const current:any={menuItems,ingredients,recipes,...(currentStaff?.role==="Owner"?{settings}:{})};
    const payload:any={},deletions:any={};
    const clean=(row:any)=>{const {tenantId,branchId,deviceId,updatedAt,createdAt,...safe}=row;return safe;};
    for(const key of Object.keys(current)) {
      if(key==="settings") {if(JSON.stringify(current.settings)!==JSON.stringify(baseline.settings)) payload.settings=current.settings;continue;}
      const previous=baseline[key] || [],idKey=key==="recipes"?"menuItemId":"id";
      const rows=current[key];
      const changed=rows.filter((r:any)=>{const old=previous.find((p:any)=>p[idKey]===r[idKey]);return !old || JSON.stringify(clean(old))!==JSON.stringify(clean(r));});
      if(changed.length) payload[key]=changed.map(clean);
      const removed=previous.filter((p:any)=>!rows.some((r:any)=>r[idKey]===p[idKey])).map((p:any)=>({id:p[idKey],version:p.version || 1}));
      if(removed.length) deletions[key]=removed;
    }
    if(Object.keys(deletions).length) payload.deletions=deletions;
    if(!Object.keys(payload).length) return;
    hasPendingChangesRef.current=true;
    const timer=setTimeout(async()=>{
      try {
        const res=await ApiClient.saveTenantSync(activeTenantId,payload,currentSessionId);
        if(!res.success) throw new Error(res.message || res.error || "Save failed");
        lastFetchedStateRef.current=JSON.stringify(res.data);
        if(res.data.menuItems) setMenuItems(res.data.menuItems);
        if(res.data.ingredients) setIngredients(res.data.ingredients);
        if(res.data.recipes) setRecipes(res.data.recipes);
        if(res.data.staffList) setStaffList(res.data.staffList);
        if(res.data.settings) setSettings(res.data.settings);
        await offlineRepository.saveFullTenantState(activeTenantId,res.data);
      } catch(err:any) {
        setToastMessage({type:"error",text:`Changes were not saved: ${err.message}. Keep this page open and retry when online.`});
      } finally {hasPendingChangesRef.current=false;}
    },500);
    return()=>clearTimeout(timer);
  },[menuItems,ingredients,recipes,staffList,settings,activeTenantId,currentSessionId,currentStaff?.role]);

  useEffect(()=>{
    const onSync=(e:any)=>{if(e.detail?.tenantId!==activeTenantId) return;offlineRepository.getOrders(activeTenantId).then(rows=>setOrders(rows as Order[]));};
    const onError=(e:any)=>{if(e.detail?.item?.tenantId===activeTenantId) setToastMessage({type:"error",text:`Order sync needs attention: ${e.detail.errorMsg}`});};
    window.addEventListener("veggiepos_realtime_event",onSync);
    for(const event of ["veggiepos_reconcile_conflict","veggiepos_validation_failed","veggiepos_forbidden_error"]) window.addEventListener(event,onError);
    return()=>{window.removeEventListener("veggiepos_realtime_event",onSync);for(const event of ["veggiepos_reconcile_conflict","veggiepos_validation_failed","veggiepos_forbidden_error"]) window.removeEventListener(event,onError);};
  },[activeTenantId]);

  // Global order creation handler
  // POS write operations commit to IndexedDB first; UI does NOT wait for cloud API
  const handleOrderCreated=async(newOrder:Order)=>{
    if(newOrder.managerPin) {
      if(!navigator.onLine) throw new Error("Manager PIN discounts require an online connection.");
      const response=await ApiClient.authenticatedFetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json','x-tenant-id':activeTenantId,'Idempotency-Key':`manager-order-${newOrder.id}`},body:JSON.stringify(newOrder)});
      const result=await response.json();
      if(!response.ok || !result.success) throw new Error(result.message || result.error || 'Order was rejected.');
      const canonical=result.order || result.data;
      setOrders(prev=>[canonical,...prev.filter(o=>o.id!==canonical.id)]);
      await offlineRepository.putOrder(activeTenantId,canonical).catch(console.warn);
      return;
    }
    await offlineRepository.recordOrderOffline(activeTenantId,newOrder);
    setOrders(prev=>[newOrder,...prev]);
    OutboxProcessor.triggerDrain(activeTenantId).catch(console.warn);
  };
  const handleUpdateOrderStatus=async(orderId:string,status:any,paymentMethod?:"Cash"|"UPI",paidAt?:string)=>{
    if(status==="Cancelled") {
      const response=await ApiClient.authenticatedFetch(`/api/orders/${encodeURIComponent(orderId)}`);const result=await response.json();
      if(!response.ok || !result.success) throw new Error(result.message || "Failed to refresh cancellation.");
      await offlineRepository.putOrder(activeTenantId,result.data);setOrders(prev=>prev.map(o=>o.id===orderId?result.data:o));return;
    }
    await offlineRepository.recordPaymentOffline(activeTenantId,orderId,{status,paymentMethod,paidAt});
    // Payment is queued, not settled: do not mark Paid in React state until
    // the canonical server response arrives via the offline sync event.
    if (!paymentMethod) setOrders(prev=>prev.map(o=>o.id===orderId?{...o,status}:o));
    OutboxProcessor.triggerDrain(activeTenantId).catch(console.warn);
  };

  // Handle Ingredient stock updates
  const handleUpdateIngredients=(updated:Ingredient[])=>{setIngredients(updated);};

  // Handle Recipe updates
  const handleUpdateRecipes = (updated: Recipe[]) => {
    setRecipes(updated);
    offlineRepository.saveRecipes(activeTenantId, updated).catch(err => {
      console.warn("[useSyncState] Error recording recipes offline:", err);
    });
  };

  // Handle Menu Item updates
  const handleUpdateMenuItems = (updated: MenuItem[]) => {
    hasPendingChangesRef.current = true;
    lastSaveTimeRef.current = Date.now();
    setMenuItems(updated);
    offlineRepository.saveMenuItems(activeTenantId, updated).catch(err => {
      console.warn("[useSyncState] Error recording menu items offline:", err);
    });
  };

  // Handle Purchase log creation with Weighted Average Cost calculation
  const handleAddPurchase = (purchase: Purchase) => {
    setPurchases([purchase, ...purchases]);

    offlineRepository.recordPurchaseOffline(activeTenantId, purchase).then(() => {
      OutboxProcessor.triggerDrain(activeTenantId);
    }).catch(err => {
      console.warn("[useSyncState] Error recording purchase offline:", err);
    });
  };

  // Calculate Real-Time Stats for Dashboard Bento Grid
  const dashboardStats = useMemo(() => {
    const safeOrders = orders || [];
    const safeShifts = shifts || [];
    const safeIngredients = ingredients || [];

    const today = new Date().toDateString();
    const todayOrders = safeOrders.filter((o) => o && o.date && new Date(o.date).toDateString() === today);
    const totalRevenue = todayOrders
      .filter((o) => o && o.status === "Completed" && Boolean(o.paidAt))
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const cashRevenue = todayOrders
      .filter((o) => o && o.status === "Completed" && Boolean(o.paidAt) && o.paymentMethod === "Cash")
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const upiRevenue = todayOrders
      .filter((o) => o && o.status === "Completed" && Boolean(o.paidAt) && o.paymentMethod === "UPI")
      .reduce((sum, o) => sum + (o.total || 0), 0);

    const activeShiftsCount = safeShifts.filter((s) => s && s.status === "Active").length;
    const lowStockItems = safeIngredients.filter((ing) => ing && ing.currentStock <= ing.minStock);
    const totalStockValue = safeIngredients.reduce((sum, ing) => sum + (ing ? (ing.currentStock || 0) * (ing.costPerUnit || 0) : 0), 0);

    const itemSalesMap: { [id: string]: { name: string; qty: number; sales: number } } = {};
    safeOrders
      .filter((o) => o && o.status === "Completed" && Boolean(o.paidAt))
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
  const handleGenerateAIReport = async (language: "hindi" | "hinglish" | "english" = "hindi") => {
    setIsGeneratingReport(true);
    setReportError("");
    setAiReport("");

    try {
      const data = await ApiClient.generateReport({
        language,
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
        setAiReport((data.isSimulated ? "Local summary (AI provider is not configured)\n\n" : "")+data.report);
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
    isInitialSyncLoading,
    isTenantDataReady,
    setIsInitialSyncLoading,
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
