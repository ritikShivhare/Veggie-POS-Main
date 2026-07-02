import React, { useState, useEffect } from "react";
import {
  Zap,
  Cpu,
  Database,
  Activity,
  Bell,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Sliders,
  Coins,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
  Plus,
  Minus
} from "lucide-react";

interface AppEvent {
  id: string;
  type: "INVENTORY_UPDATE" | "ORDER_COMPLETE" | "PAYMENT_SUCCESS";
  timestamp: string;
  tenantId: string;
  payload: any;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  actor: string;
  description: string;
  details: any;
}

interface EventAnalytics {
  totalEventsProcessed: number;
  totalOrdersCompleted: number;
  totalPaymentsProcessed: number;
  totalRevenue: number;
  inventoryAdjustments: number;
  lastUpdated: string;
}

export default function EventDrivenDashboard() {
  const [history, setHistory] = useState<AppEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [analytics, setAnalytics] = useState<EventAnalytics>({
    totalEventsProcessed: 0,
    totalOrdersCompleted: 0,
    totalPaymentsProcessed: 0,
    totalRevenue: 0,
    inventoryAdjustments: 0,
    lastUpdated: new Date().toISOString()
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [activePane, setActivePane] = useState<"simulator" | "logs" | "architecture">("simulator");

  // Simulation states
  const [invItem, setInvItem] = useState("Tomato (Veg)");
  const [invChange, setInvChange] = useState<number>(-5);
  const [invLevel, setInvLevel] = useState<number>(12);
  const [invManager, setInvManager] = useState("Suresh Kumar");

  const [ordId, setOrdId] = useState(() => `ORD-${Math.floor(100000 + Math.random() * 900000)}`);
  const [ordTotal, setOrdTotal] = useState<number>(450);
  const [ordCashier, setOrdCashier] = useState("Pooja Sharma");
  const [ordEmail, setOrdEmail] = useState("ritikshiv53@gmail.com");

  const [payId, setPayId] = useState(() => `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`);
  const [payAmount, setPayAmount] = useState<number>(450);
  const [payMethod, setPayMethod] = useState("UPI (GPay)");
  const [payPhone, setPayPhone] = useState("+91 98765 12345");

  const [simulating, setSimulating] = useState<string | null>(null);

  const fetchEventData = async (silent = false) => {
    if (!silent) setSyncing(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
        setAuditLogs(data.auditLogs || []);
        if (data.analytics) {
          setAnalytics(data.analytics);
        }
      }
    } catch (err) {
      console.error("Failed to sync EventBus telemetry:", err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchEventData();
    const interval = setInterval(() => fetchEventData(true), 6000);
    return () => clearInterval(interval);
  }, []);

  const handlePublishEvent = async (type: string, payload: any) => {
    setSimulating(type);
    try {
      const res = await fetch("/api/events/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh
        await fetchEventData(true);
        
        // Regenerate random IDs
        if (type === "ORDER_COMPLETE") {
          setOrdId(`ORD-${Math.floor(100000 + Math.random() * 900000)}`);
        } else if (type === "PAYMENT_SUCCESS") {
          setPayId(`TXN-${Math.floor(100000000 + Math.random() * 900000000)}`);
        }
      }
    } catch (err) {
      console.error("Failed to publish event:", err);
    } finally {
      setSimulating(null);
    }
  };

  const handleResetBus = async () => {
    if (!window.confirm("Are you sure you want to purge all events, audit records, and dashboard metrics?")) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/events/clear", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setHistory([]);
        setAuditLogs([]);
        setAnalytics({
          totalEventsProcessed: 0,
          totalOrdersCompleted: 0,
          totalPaymentsProcessed: 0,
          totalRevenue: 0,
          inventoryAdjustments: 0,
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Purge error:", err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="font-semibold text-slate-700 text-sm">Synchronizing Event Stream Bus...</p>
        <p className="text-xs text-slate-400 mt-1">Configuring dynamic pub-sub architecture channels...</p>
      </div>
    );
  }

  return (
    <div className="h-full p-4 sm:p-6 bg-[#f8fafc] overflow-y-auto space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-600 animate-pulse animate-bounce" />
            Event-Driven Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time visual monitoring dashboard of state transitions. Loose coupling enables background modules to listen and act instantly.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchEventData(false)}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-sm flex items-center gap-2 text-xs font-semibold cursor-pointer"
            disabled={syncing}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-indigo-600" : ""}`} />
            <span>Refresh Bus</span>
          </button>

          <button
            onClick={handleResetBus}
            className="p-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl transition shadow-sm flex items-center gap-2 text-xs font-bold cursor-pointer"
            title="Purge Telemetry History"
          >
            <Trash2 className="w-4 h-4" />
            <span>Purge Data</span>
          </button>
        </div>
      </div>

      {/* METRICS ROW (REAL TIME DYNAMIC CONSUMPTION) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm relative overflow-hidden">
          <div className="absolute right-2 bottom-2 opacity-10">
            <Zap className="w-16 h-16 text-indigo-600" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Total Events Dispatched</p>
          <h3 className="text-2xl font-extrabold text-slate-800 mt-1.5 font-mono">
            {analytics.totalEventsProcessed}
          </h3>
          <p className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 mt-1">
            <Activity className="w-3 h-3 text-indigo-500 animate-pulse" />
            Active Pub/Sub listeners: 3
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm relative overflow-hidden">
          <div className="absolute right-2 bottom-2 opacity-10">
            <CheckCircle2 className="w-16 h-16 text-emerald-600" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Completed Orders</p>
          <h3 className="text-2xl font-extrabold text-emerald-600 mt-1.5 font-mono">
            {analytics.totalOrdersCompleted}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Listeners triggered: Notifications, Audit, Stats
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm relative overflow-hidden">
          <div className="absolute right-2 bottom-2 opacity-10">
            <Coins className="w-16 h-16 text-blue-600" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Total Sales Revenue</p>
          <h3 className="text-2xl font-extrabold text-blue-600 mt-1.5 font-mono">
            Rs. {analytics.totalRevenue}
          </h3>
          <p className="text-[10px] text-blue-600 font-bold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" />
            Updated dynamically via event metrics
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm relative overflow-hidden">
          <div className="absolute right-2 bottom-2 opacity-10">
            <Sliders className="w-16 h-16 text-amber-600" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Inventory Changes</p>
          <h3 className="text-2xl font-extrabold text-amber-600 mt-1.5 font-mono">
            {analytics.inventoryAdjustments}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Tracks real-time low stock warnings
          </p>
        </div>
      </div>

      {/* THREE-PANE CONTROLLER NAVIGATION */}
      <div className="flex border-b border-slate-200 gap-1 bg-slate-100 p-1 rounded-xl max-w-md">
        <button
          onClick={() => setActivePane("simulator")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activePane === "simulator" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Sliders className="w-4 h-4 text-indigo-600" />
          Simulator Lab
        </button>
        
        <button
          onClick={() => setActivePane("logs")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activePane === "logs" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-600" />
          Audit Logs ({auditLogs.length})
        </button>

        <button
          onClick={() => setActivePane("architecture")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activePane === "architecture" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Cpu className="w-4 h-4 text-pink-600" />
          Coupling Map
        </button>
      </div>

      {/* MAIN CONTAINER LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: ACTIVE VIEW BODY */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 min-h-[450px]">
          
          {/* SIMULATOR PANE */}
          {activePane === "simulator" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                  Interactive Event Dispatcher Console
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Trigger mock transaction payloads below to see how listeners (Audit log entries, notifications, dashboard counters) capture them with zero direct code coupling.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                
                {/* SIMULATE EVENT 1: INVENTORY UPDATE */}
                <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-mono font-bold uppercase tracking-wider block w-max">
                      INVENTORY_UPDATE
                    </span>
                    <h3 className="text-xs font-bold text-slate-700">Simulate Ingredient Shift</h3>
                    
                    <div className="space-y-2.5 pt-1 text-[11px]">
                      <div>
                        <label className="text-slate-400 block font-bold mb-1">Ingredient</label>
                        <select
                          value={invItem}
                          onChange={(e) => setInvItem(e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded text-[11px] font-semibold outline-none"
                        >
                          <option value="Tomato (Veg)">Tomato (Veg)</option>
                          <option value="Paneer Cube (Farmed)">Paneer Cube (Farmed)</option>
                          <option value="Cheese Mozzarella">Cheese Mozzarella</option>
                          <option value="Mushroom Slices">Mushroom Slices</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-400 block font-bold mb-1">Adjustment</label>
                          <input
                            type="number"
                            value={invChange}
                            onChange={(e) => setInvChange(Number(e.target.value))}
                            className="w-full p-1 bg-white border border-slate-200 rounded text-[11px] font-bold text-center outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 block font-bold mb-1">Current Stock</label>
                          <input
                            type="number"
                            value={invLevel}
                            onChange={(e) => setInvLevel(Number(e.target.value))}
                            className="w-full p-1 bg-white border border-slate-200 rounded text-[11px] font-bold text-center outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-400 block font-bold mb-1">Responsible Operator</label>
                        <input
                          type="text"
                          value={invManager}
                          onChange={(e) => setInvManager(e.target.value)}
                          className="w-full p-1 bg-white border border-slate-200 rounded text-[11px] font-semibold outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePublishEvent("INVENTORY_UPDATE", {
                      itemName: invItem,
                      changeAmount: invChange,
                      newQuantity: invLevel,
                      updatedBy: invManager
                    })}
                    disabled={simulating !== null}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {simulating === "INVENTORY_UPDATE" ? (
                      <span className="w-3.5 h-3.5 border-2 border-indigo-500/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Dispatch Event</span>
                      </>
                    )}
                  </button>
                </div>

                {/* SIMULATE EVENT 2: ORDER COMPLETE */}
                <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-mono font-bold uppercase tracking-wider block w-max">
                      ORDER_COMPLETE
                    </span>
                    <h3 className="text-xs font-bold text-slate-700">Simulate POS Checkout</h3>

                    <div className="space-y-2.5 pt-1 text-[11px]">
                      <div>
                        <label className="text-slate-400 block font-bold mb-1">Generated Order ID</label>
                        <input
                          type="text"
                          value={ordId}
                          onChange={(e) => setOrdId(e.target.value)}
                          className="w-full p-1 bg-white border border-slate-200 rounded font-mono text-[10px] outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block font-bold mb-1">Billing Subtotal (Rs)</label>
                        <input
                          type="number"
                          value={ordTotal}
                          onChange={(e) => {
                            setOrdTotal(Number(e.target.value));
                            setPayAmount(Number(e.target.value));
                          }}
                          className="w-full p-1 bg-white border border-slate-200 rounded text-[11px] font-bold outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block font-bold mb-1">Terminal Cashier</label>
                        <input
                          type="text"
                          value={ordCashier}
                          onChange={(e) => setOrdCashier(e.target.value)}
                          className="w-full p-1 bg-white border border-slate-200 rounded text-[11px] font-semibold outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block font-bold mb-1">Customer E-mail</label>
                        <input
                          type="email"
                          value={ordEmail}
                          onChange={(e) => setOrdEmail(e.target.value)}
                          className="w-full p-1 bg-white border border-slate-200 rounded text-[11px] font-semibold outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePublishEvent("ORDER_COMPLETE", {
                      orderId: ordId,
                      itemsCount: 3,
                      totalAmount: ordTotal,
                      cashierName: ordCashier,
                      customerEmail: ordEmail
                    })}
                    disabled={simulating !== null}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {simulating === "ORDER_COMPLETE" ? (
                      <span className="w-3.5 h-3.5 border-2 border-indigo-500/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Dispatch Event</span>
                      </>
                    )}
                  </button>
                </div>

                {/* SIMULATE EVENT 3: PAYMENT SUCCESS */}
                <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[9px] font-mono font-bold uppercase tracking-wider block w-max">
                      PAYMENT_SUCCESS
                    </span>
                    <h3 className="text-xs font-bold text-slate-700">Simulate Payment Credit</h3>

                    <div className="space-y-2.5 pt-1 text-[11px]">
                      <div>
                        <label className="text-slate-400 block font-bold mb-1">Transaction Ref ID</label>
                        <input
                          type="text"
                          value={payId}
                          onChange={(e) => setPayId(e.target.value)}
                          className="w-full p-1 bg-white border border-slate-200 rounded font-mono text-[10px] outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block font-bold mb-1">Settlement Amount (Rs)</label>
                        <input
                          type="number"
                          value={payAmount}
                          onChange={(e) => setPayAmount(Number(e.target.value))}
                          className="w-full p-1 bg-white border border-slate-200 rounded text-[11px] font-bold outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block font-bold mb-1">Gateway Gateway</label>
                        <select
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded text-[11px] font-semibold outline-none"
                        >
                          <option value="UPI (GPay)">UPI (GPay)</option>
                          <option value="Debit Card">Debit Card</option>
                          <option value="Cash Drawer">Cash Drawer</option>
                          <option value="Net Banking">Net Banking</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 block font-bold mb-1">Payer Phone Number</label>
                        <input
                          type="text"
                          value={payPhone}
                          onChange={(e) => setPayPhone(e.target.value)}
                          className="w-full p-1 bg-white border border-slate-200 rounded text-[11px] font-semibold outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePublishEvent("PAYMENT_SUCCESS", {
                      transactionId: payId,
                      orderId: ordId,
                      amount: payAmount,
                      method: payMethod,
                      payerName: "Ritik Shiv",
                      customerPhone: payPhone,
                      customerEmail: ordEmail
                    })}
                    disabled={simulating !== null}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {simulating === "PAYMENT_SUCCESS" ? (
                      <span className="w-3.5 h-3.5 border-2 border-indigo-500/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-blue-400" />
                        <span>Dispatch Event</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* AUDIT LOGS PANE */}
          {activePane === "logs" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Loosely-Coupled Audit Trail Logs
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    This compliance log is populated purely via background event listeners reacting asynchronously to EventBus dispatches.
                  </p>
                </div>
              </div>

              {auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 text-slate-400 space-y-2">
                  <Clock className="w-10 h-10 text-slate-200" />
                  <p className="font-bold text-slate-600 text-xs">No Audit Entries Recorded</p>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Please use the **Simulator Lab** to dispatch transactional events to initialize log entries.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto space-y-0.5 pr-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-3 flex items-start gap-4 text-xs">
                      {/* Log Category Badges */}
                      <div className="shrink-0 mt-0.5">
                        {log.eventType === "ORDER_COMPLETE" && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-mono font-bold uppercase">
                            ORDER
                          </span>
                        )}
                        {log.eventType === "PAYMENT_SUCCESS" && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[9px] font-mono font-bold uppercase">
                            PAYMENT
                          </span>
                        )}
                        {log.eventType === "INVENTORY_UPDATE" && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-mono font-bold uppercase">
                            INVENTORY
                          </span>
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-semibold text-slate-700">
                            {log.description}
                          </p>
                          <span className="text-[9.5px] font-mono text-slate-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-semibold">
                          <span>Actor: <strong className="text-slate-600">{log.actor}</strong></span>
                          <span>Reference ID: <strong className="text-slate-600 font-mono">{log.id}</strong></span>
                        </div>

                        {/* Expandable JSON Payload Block */}
                        <details className="mt-1 pb-1">
                          <summary className="text-[9.5px] font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer outline-none select-none">
                            View RAW Payload metadata
                          </summary>
                          <pre className="mt-1.5 p-2 bg-slate-900 text-slate-300 font-mono text-[9px] rounded-lg overflow-x-auto max-w-full">
                            {JSON.stringify(log.details || {}, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ARCHITECTURE DIAGRAM MAP */}
          {activePane === "architecture" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-pink-600" />
                  Visualizing Loose Coupling (Pub-Sub Topology)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Our architecture guarantees complete isolation of domain concerns. Publishers do not require handles to notification protocols, email clients, databases, or log files.
                </p>
              </div>

              {/* GRAPHIC TOPOLOGY CHART */}
              <div className="border border-slate-150 rounded-xl bg-slate-50/50 p-6 space-y-8">
                
                {/* STAGE 1: PUBLISHERS */}
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400 font-mono tracking-wider bg-white border px-2.5 py-0.5 rounded-full shadow-sm">
                      Stage 1: Event Dispatchers (Publishers)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white p-3 rounded-xl border text-center text-[11px] font-bold text-amber-700 shadow-sm flex flex-col items-center">
                      <Sliders className="w-4 h-4 mb-1 text-amber-500" />
                      <span>Inventory Update</span>
                      <span className="text-[8.5px] text-slate-400 mt-0.5 font-normal font-mono">Stock Shifts</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border text-center text-[11px] font-bold text-emerald-700 shadow-sm flex flex-col items-center">
                      <CheckCircle2 className="w-4 h-4 mb-1 text-emerald-500" />
                      <span>Order Complete</span>
                      <span className="text-[8.5px] text-slate-400 mt-0.5 font-normal font-mono">POS Checkout</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border text-center text-[11px] font-bold text-blue-700 shadow-sm flex flex-col items-center">
                      <Coins className="w-4 h-4 mb-1 text-blue-500" />
                      <span>Payment Success</span>
                      <span className="text-[8.5px] text-slate-400 mt-0.5 font-normal font-mono">Receipt Gateways</span>
                    </div>
                  </div>
                </div>

                {/* CONNECTOR ARROWS */}
                <div className="flex flex-col items-center gap-1 -my-4">
                  <div className="w-0.5 h-6 bg-slate-300 border-dashed" />
                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-700 font-mono text-[9px] font-extrabold rounded-md">
                    publish(type, payload)
                  </span>
                  <div className="w-0.5 h-6 bg-slate-300 border-dashed" />
                </div>

                {/* STAGE 2: EVENT BUS ENGINE */}
                <div className="space-y-3 bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 relative shadow-md">
                  <div className="absolute top-2 right-2 animate-ping shrink-0 w-2 h-2 bg-indigo-500 rounded-full" />
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-xl">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold font-mono tracking-wide">EventBus.ts (Core Dispatch Ring)</h4>
                      <p className="text-[10px] text-slate-400">Processes asynchronous, non-blocking broadcasts to dynamic subscribers.</p>
                    </div>
                  </div>
                </div>

                {/* CONNECTOR ARROWS */}
                <div className="flex flex-col items-center gap-1 -my-4">
                  <div className="w-0.5 h-6 bg-slate-300 border-dashed" />
                  <span className="px-2 py-0.5 bg-pink-50 border border-pink-150 text-pink-700 font-mono text-[9px] font-extrabold rounded-md">
                    parallel_broadcast()
                  </span>
                  <div className="w-0.5 h-6 bg-slate-300 border-dashed" />
                </div>

                {/* STAGE 3: LISTENERS */}
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400 font-mono tracking-wider bg-white border px-2.5 py-0.5 rounded-full shadow-sm">
                      Stage 3: Loosely-Coupled Subscriptions (Listeners)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-pink-100 shadow-sm space-y-1 text-center">
                      <div className="mx-auto p-1.5 bg-pink-50 rounded-full w-max text-pink-600">
                        <Bell className="w-4 h-4" />
                      </div>
                      <h4 className="text-[11px] font-bold text-slate-800">NotificationListener</h4>
                      <p className="text-[9.5px] text-slate-500">Triggers In-App, Email receipts, and Twilio SMS alerts.</p>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm space-y-1 text-center">
                      <div className="mx-auto p-1.5 bg-emerald-50 rounded-full w-max text-emerald-600">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h4 className="text-[11px] font-bold text-slate-800">AuditLogListener</h4>
                      <p className="text-[9.5px] text-slate-500">Writes secure audit logs to `system_audit_logs` automatically.</p>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm space-y-1 text-center">
                      <div className="mx-auto p-1.5 bg-blue-50 rounded-full w-max text-blue-600">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <h4 className="text-[11px] font-bold text-slate-800">DashboardStatsListener</h4>
                      <p className="text-[9.5px] text-slate-500">Updates live sales counters and revenue aggregates.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: RECENT RAW EVENTS MEMORY HISTORY STREAM */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[450px]">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-indigo-400 tracking-wider uppercase">
                🔴 EventBus Active Ring Buffer
              </span>
              <span className="text-[9px] font-mono text-slate-500">Memory log (last 50)</span>
            </div>

            {history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-1">
                <Activity className="w-8 h-8 text-slate-700 animate-pulse" />
                <p className="font-bold text-slate-400 text-xs font-mono">Stream is idle</p>
                <p className="text-[9.5px] text-slate-500 max-w-xs font-mono">
                  Listening on loop for state transitions...
                </p>
              </div>
            ) : (
              <div className="flex-1 divide-y divide-slate-850 overflow-y-auto max-h-[500px]">
                {history.map((evt) => (
                  <div key={evt.id} className="p-3 hover:bg-slate-950/50 transition space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        evt.type === "ORDER_COMPLETE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        evt.type === "PAYMENT_SUCCESS" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                        "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {evt.type}
                      </span>
                      <span className="text-[8.5px] font-mono text-slate-500">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <p className="text-[9.5px] font-mono text-slate-300">
                      ID: <span className="text-white">{evt.id}</span>
                    </p>

                    <div className="bg-slate-950 p-2 rounded border border-slate-850 mt-1">
                      <pre className="text-[8.5px] font-mono text-slate-400 overflow-x-auto">
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
