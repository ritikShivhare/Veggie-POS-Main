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
      setIsInitialSyncLoading(false);
      return;
    }
    let active = true;
    isLoadedRef.current = false;

    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let pingInterval: any = null;
    let pollingInterval: any = null;

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

            try {
              offlineRepository.saveFullTenantState(activeTenantId, d).catch(e => console.warn(e));
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn("[Realtime] Skipped background synchronization update due to network status:", err);
      }
    };

    const fetchSync = async () => {
      try {
        // Enforce 3-second network timeout so initial sync never blocks applet
        const json = await Promise.race([
          ApiClient.getTenantSync(activeTenantId, currentSessionId || undefined),
          new Promise<SyncResponse>((_, reject) =>
            setTimeout(() => reject(new Error("INITIAL_SYNC_TIMEOUT")), 3000)
          )
        ]);
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
          
          try {
            offlineRepository.saveFullTenantState(activeTenantId, d).catch(e => console.warn(e));
          } catch (e) {}

          loadedTenantIdRef.current = activeTenantId;
          isLoadedRef.current = true;
          setIsInitialSyncLoading(false);
        } else if (json.success && !json.initialized) {
          let initialStaffList: StaffMember[] = [];
          if (pendingOwnerRef.current) {
            initialStaffList = [pendingOwnerRef.current];
            pendingOwnerRef.current = null;
          } else if (currentStaff) {
            initialStaffList = [currentStaff];
          }

          const initialPayload = {
            menuItems: [],
            ingredients: [],
            recipes: [],
            staffList: initialStaffList.map(s => ({ ...s, version: s.version ?? 1 })),
            orders: [],
            customers: [],
            purchases: [],
            shifts: [],
            settings: {
              autoDeductStock: true,
              blockOrdersIfInsufficient: true,
              managerCanAddPurchases: true,
              managerCanEditRecipes: true,
              kdsSoundAlerts: false,
              quickPinRequired: false
            }
          };

          if (currentSessionId) {
            await ApiClient.saveTenantSync(activeTenantId, initialPayload, currentSessionId);
          }
          
          if (active) {
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
            
            try {
              offlineRepository.saveFullTenantState(activeTenantId, initialPayload).catch(e => console.warn(e));
            } catch (e) {}

            loadedTenantIdRef.current = activeTenantId;
            isLoadedRef.current = true;
          }
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
        const tokenQuery = currentSessionId ? `?token=${encodeURIComponent(currentSessionId)}` : "";
        const wsUrl = `${protocol}//${host}/ws${tokenQuery}`;

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
              msg.type === "sync:updated" ||
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

  // Sync state modifications to server
  useEffect(() => {
    if (!isLoadedRef.current || loadedTenantIdRef.current !== activeTenantId || !currentSessionId) {
      return;
    }

    const currentState = {
      menuItems: menuItems.map(item => ({
        ...item,
        version: typeof item.version === "number" ? item.version : 1
      })),
      ingredients: ingredients.map(item => ({
        ...item,
        version: typeof (item as any).version === "number" ? (item as any).version : 1
      })),
      recipes,
      staffList: staffList.map(item => ({
        ...item,
        version: typeof item.version === "number" ? item.version : 1
      })),
      orders: orders.map(item => ({
        ...item,
        version: typeof item.version === "number" ? item.version : 1
      })),
      customers: customers.map(item => ({
        ...item,
        version: typeof (item as any).version === "number" ? (item as any).version : 1
      })),
      purchases: purchases.map(item => ({
        ...item,
        version: typeof (item as any).version === "number" ? (item as any).version : 1
      })),
      shifts: shifts.map(item => ({
        ...item,
        version: typeof (item as any).version === "number" ? (item as any).version : 1
      })),
      settings
    };

    const currentStateStr = JSON.stringify(currentState);
 
    // Guard: Do not attempt to sync before local state is loaded, or if user has no active session
    if (!isLoadedRef.current || !currentSessionId) {
      return;
    }

    if (currentStateStr === lastFetchedStateRef.current) {
      return;
    }

    hasPendingChangesRef.current = true;

    const saveSync = async () => {
      try {
        const res = await ApiClient.saveTenantSync(activeTenantId, currentState, currentSessionId);
        if (res.success) {
          hasPendingChangesRef.current = false;
          lastSaveTimeRef.current = Date.now();
          if (res.data) {
            if (res.data.menuItems) setMenuItems(res.data.menuItems);
            if (res.data.staffList) setStaffList(res.data.staffList);
            if (res.data.orders) setOrders(res.data.orders);
            if (res.data.ingredients) setIngredients(res.data.ingredients);
            if (res.data.customers) setCustomers(res.data.customers);
            if (res.data.purchases) setPurchases(res.data.purchases);
            if (res.data.shifts) setShifts(res.data.shifts);
            if (res.data.settings) setSettings(res.data.settings);
          }
          const savedStateStr = JSON.stringify(res.data || currentState);
          lastFetchedStateRef.current = savedStateStr;
          try {
            offlineRepository.saveFullTenantState(activeTenantId, res.data || currentState).catch(e => console.warn(e));
          } catch (e) {}
        } else {
          console.warn("Server rejected state synchronization update:", res.error);

          if (res.error === "OPTIMISTIC_LOCK_CONFLICT") {
            hasPendingChangesRef.current = false;
            setToastMessage({
              type: "error",
              text: "Data Conflict (409 CONFLICT): Stale updates detected. Re-syncing latest data to prevent lost updates."
            });
            try {
              const fresh = await ApiClient.getTenantSync(activeTenantId, currentSessionId || undefined);
              if (fresh.success && fresh.data) {
                const d = fresh.data;
                if (d.menuItems) setMenuItems(d.menuItems);
                if (d.staffList) setStaffList(d.staffList);
                if (d.orders) setOrders(d.orders);
                if (d.ingredients) setIngredients(d.ingredients);
                if (d.customers) setCustomers(d.customers);
                if (d.purchases) setPurchases(d.purchases);
                if (d.shifts) setShifts(d.shifts);
                if (d.settings) setSettings(d.settings);
                const freshStr = JSON.stringify(d);
                lastFetchedStateRef.current = freshStr;
                offlineRepository.saveFullTenantState(activeTenantId, d).catch(e => console.warn(e));
              }
            } catch (reErr) {
              console.warn("Failed to reconcile state after 409 conflict:", reErr);
            }
            return;
          }

          try {
            // Persist locally in IndexedDB and enqueue in outbox for offline sync
            offlineRepository.saveFullTenantState(activeTenantId, currentState).catch(e => console.warn(e));
            offlineRepository.enqueueOutbox(
              activeTenantId,
              "SYNC_FULL_STATE",
              `/api/sync?tenantId=${encodeURIComponent(activeTenantId)}`,
              "POST",
              currentState,
              ApiClient.generateIdempotencyKey("sync_state")
            ).catch(e => console.warn(e));
          } catch (e) {}

          const isDbUnavailable = res.error === "DATABASE_UNAVAILABLE";
          setToastMessage({
            type: "error",
            text: isDbUnavailable
              ? "Database Unavailable (503 DATABASE_UNAVAILABLE): In-memory fallback is disabled. Local cache marked as stale/readonly."
              : `Data Sync Issue: ${res.message || res.error || "The server rejected the transaction packet."}`
          });
        }
      } catch (err: any) {
        console.warn("Failed to push synchronized update:", err);
        try {
          // Persist locally in IndexedDB and enqueue in outbox for offline sync
          offlineRepository.saveFullTenantState(activeTenantId, currentState).catch(e => console.warn(e));
          offlineRepository.enqueueOutbox(
            activeTenantId,
            "SYNC_FULL_STATE",
            `/api/sync?tenantId=${encodeURIComponent(activeTenantId)}`,
            "POST",
            currentState,
            ApiClient.generateIdempotencyKey("sync_state")
          ).catch(e => console.warn(e));
        } catch (e) {}
        setToastMessage({
          type: "error",
          text: `Database Unavailable (503 DATABASE_UNAVAILABLE): ${err.message || "Write could not be committed. Local cache marked as stale/readonly."}`
        });
      }
    };
    const timeout = setTimeout(saveSync, 300);
    return () => clearTimeout(timeout);
  }, [menuItems, ingredients, recipes, staffList, orders, customers, purchases, shifts, settings, activeTenantId, currentSessionId]);

  // Global order creation handler
  // POS write operations commit to IndexedDB first; UI does NOT wait for cloud API
  const handleOrderCreated = (newOrder: Order) => {
    const orderWithVersion: Order = {
      ...newOrder,
      version: typeof newOrder.version === "number" ? newOrder.version : 1
    };
    // 1. Instantaneous UI state update
    setOrders([orderWithVersion, ...orders]);

    // 2. Commit to IndexedDB first & queue in durable outbox
    offlineRepository.recordOrderOffline(activeTenantId, orderWithVersion).then(() => {
      // Fire-and-forget outbox drain in background
      OutboxProcessor.triggerDrain(activeTenantId);
    }).catch(err => {
      console.warn("[useSyncState] Error recording order offline:", err);
    });
  };

  // Handle Kitchen KDS status change and payment settlement
  // Commits to IndexedDB first; non-blocking UI
  const handleUpdateOrderStatus = (orderId: string, nextStatus: any, paymentMethod?: 'Cash' | 'UPI', paidAt?: string) => {
    // 1. Instantaneous UI state update
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

    // 2. Commit to IndexedDB first & queue in durable outbox
    offlineRepository.recordPaymentOffline(activeTenantId, orderId, {
      status: nextStatus,
      paymentMethod,
      paidAt
    }).then(() => {
      OutboxProcessor.triggerDrain(activeTenantId);
    }).catch(err => {
      console.warn("[useSyncState] Error recording payment/order status offline:", err);
    });
  };

  // Handle Ingredient stock updates
  const handleUpdateIngredients = (updated: Ingredient[]) => {
    setIngredients(updated);
    offlineRepository.recordInventoryOffline(activeTenantId, updated).then(() => {
      OutboxProcessor.triggerDrain(activeTenantId);
    }).catch(err => {
      console.warn("[useSyncState] Error recording inventory offline:", err);
    });
  };

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

  // Handle Purchase log creation
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
    isInitialSyncLoading,
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
