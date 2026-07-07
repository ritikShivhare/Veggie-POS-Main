import React, { useState } from "react";
import { Order, OrderStatus } from "../shared/types";
import { ChefHat, Play, CheckCircle, Flame, Trash2, Clock, AlertTriangle } from "lucide-react";

interface KitchenKDSProps {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  kdsSoundAlerts: boolean;
}

export default function KitchenKDS({ orders, onUpdateOrderStatus, kdsSoundAlerts }: KitchenKDSProps) {
  // Local sub-tab state under Kitchen KDS
  const [kdsTab, setKdsTab] = useState<"pending" | "preparing" | "ready">("pending");

  // Filter active kitchen orders
  const activeOrders = orders.filter(
    (o) => o.status === "Pending" || o.status === "Preparing" || o.status === "Ready"
  );

  const pendingOrders = activeOrders.filter((o) => o.status === "Pending");
  const preparingOrders = activeOrders.filter((o) => o.status === "Preparing");
  const readyOrders = activeOrders.filter((o) => o.status === "Ready");

  // Filter displayed orders by the currently selected sub-tab
  const displayedOrders = kdsTab === "pending"
    ? pendingOrders
    : kdsTab === "preparing"
    ? preparingOrders
    : readyOrders;

  // Calculate duration elapsed since order was created
  const getElapsedTime = (isoString: string): string => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  };

  const getTimerColorClass = (isoString: string, status: string): string => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (status === "Ready") return "text-emerald-600 font-semibold";
    if (diffMins > 15) return "text-rose-500 animate-pulse font-bold";
    if (diffMins > 8) return "text-amber-500 font-semibold";
    return "text-slate-500";
  };

  const handleActionClick = (order: Order, nextStatus: OrderStatus) => {
    onUpdateOrderStatus(order.id, nextStatus);
    
    // Simulating system alert audio if setting enabled
    if (kdsSoundAlerts && "speechSynthesis" in window) {
      const speech = new SpeechSynthesisUtterance();
      speech.text = `Order ${order.orderNumber} status updated to ${nextStatus}`;
      speech.rate = 1.1;
      window.speechSynthesis.speak(speech);
    }
  };

  return (
    <div className="h-full bg-[#f8fafc] flex flex-col p-4 sm:p-6 font-sans text-slate-800 overflow-hidden">
      {/* Title & Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0 border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-slate-800 leading-tight">
              Kitchen Display System (KDS)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live orders tracking panel. Kitchen-crew control interface.
            </p>
          </div>
        </div>

        {/* Real-time Order Counts badges */}
        <div className="flex gap-2.5 text-xs">
          <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping" />
            <span className="text-amber-800 font-semibold">New: <b className="text-amber-950">{pendingOrders.length}</b></span>
          </div>
          <div className="flex items-center space-x-1.5 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="w-2 h-2 bg-sky-400 rounded-full animate-pulse" />
            <span className="text-sky-800 font-semibold">Prep: <b className="text-sky-950">{preparingOrders.length}</b></span>
          </div>
          <div className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shadow-sm">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
            <span className="text-emerald-800 font-semibold">Ready: <b className="text-emerald-950">{readyOrders.length}</b></span>
          </div>
        </div>
      </div>

      {/* 3 Sub-tabs navigation layout under Kitchen KDS */}
      <div className="flex border-b border-slate-200 mb-6 shrink-0 gap-1.5">
        <button
          onClick={() => setKdsTab("pending")}
          className={`px-5 py-3 border-b-2 text-xs font-bold transition flex items-center gap-2.5 ${
            kdsTab === "pending"
              ? "border-amber-500 text-amber-600 bg-amber-50/40"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
          id="kds-tab-pending-btn"
        >
          <Flame className="w-4 h-4 text-amber-500" />
          <span>1. New Orders</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            kdsTab === "pending" ? "bg-amber-500 text-white" : "bg-slate-200/80 text-slate-700"
          }`}>
            {pendingOrders.length}
          </span>
        </button>

        <button
          onClick={() => setKdsTab("preparing")}
          className={`px-5 py-3 border-b-2 text-xs font-bold transition flex items-center gap-2.5 ${
            kdsTab === "preparing"
              ? "border-blue-500 text-blue-600 bg-blue-50/40"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
          id="kds-tab-preparing-btn"
        >
          <ChefHat className="w-4 h-4 text-blue-500" />
          <span>2. Preparing</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            kdsTab === "preparing" ? "bg-blue-600 text-white" : "bg-slate-200/80 text-slate-700"
          }`}>
            {preparingOrders.length}
          </span>
        </button>

        <button
          onClick={() => setKdsTab("ready")}
          className={`px-5 py-3 border-b-2 text-xs font-bold transition flex items-center gap-2.5 ${
            kdsTab === "ready"
              ? "border-emerald-600 text-emerald-600 bg-emerald-50/40"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
          id="kds-tab-ready-btn"
        >
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span>3. Ready to Serve</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            kdsTab === "ready" ? "bg-emerald-600 text-white" : "bg-slate-200/80 text-slate-700"
          }`}>
            {readyOrders.length}
          </span>
        </button>
      </div>

      {displayedOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-slate-400 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl shadow-inner">
          <span className="text-5xl filter brightness-95 mb-4">
            {kdsTab === "pending" ? "📋" : kdsTab === "preparing" ? "🍳" : "🛎️"}
          </span>
          <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide">
            {kdsTab === "pending" ? "No new orders" : kdsTab === "preparing" ? "No items in prep" : "No orders waiting"}
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-relaxed">
            {kdsTab === "pending"
              ? "All incoming checkout tickets have been accepted or prepared. Standard KDS standby active."
              : kdsTab === "preparing"
              ? "The kitchen is caught up. Start cooking incoming tickets from the 'New Orders' tab."
              : "No ready orders currently waiting to be picked up or cleared."}
          </p>
        </div>
      ) : (
        /* Dynamic Orders Grid */
        <div className="flex-1 overflow-y-auto pb-4 pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedOrders.map((order) => (
              <div
                key={order.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 relative flex flex-col justify-between transition hover:shadow-md ${
                  order.status === "Ready"
                    ? "border-emerald-200 shadow-emerald-50/10"
                    : kdsTab === "preparing"
                    ? "border-blue-100 shadow-blue-50/10"
                    : "border-slate-200/80"
                }`}
                id={`kds-card-${order.id}`}
              >
                <div>
                  {/* Order metadata tag */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                        order.status === "Ready"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : order.status === "Preparing"
                          ? "text-blue-700 bg-blue-50 border-blue-100"
                          : "text-slate-500 bg-slate-100 border-slate-200/60"
                      }`}>
                        {order.type} {order.tableNo ? `• ${order.tableNo}` : ""}
                      </span>
                      <h4 className="font-bold text-slate-800 text-sm mt-1.5">Order #{order.orderNumber}</h4>
                    </div>
                    <div className="flex items-center space-x-1 text-xs">
                      <Clock className={`w-3.5 h-3.5 ${order.status === "Ready" ? "text-emerald-500" : "text-slate-400"}`} />
                      <span className={getTimerColorClass(order.date, order.status)}>
                        {order.status === "Ready" ? "Ready" : getElapsedTime(order.date)}
                      </span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="border-t border-b border-slate-100 py-3 my-2 space-y-2.5">
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="text-xs">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-slate-800">
                            {item?.quantity || 1}x {item?.menuItem?.name || "Unknown Item"}
                          </span>
                        </div>
                        {item.note && (
                          <div className="flex items-center space-x-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded mt-1 w-fit">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Note: {item.note}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* KDS Action Trigger Button */}
                <div className="pt-2">
                  {order.status === "Pending" && (
                    <button
                      onClick={() => handleActionClick(order, "Preparing")}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition duration-150 active:scale-[0.98] shadow-sm shadow-amber-500/15"
                      id={`kds-start-btn-${order.id}`}
                    >
                      <Flame className="w-4 h-4 text-white/90" />
                      <span>Start Preparing</span>
                    </button>
                  )}

                  {order.status === "Preparing" && (
                    <button
                      onClick={() => handleActionClick(order, "Ready")}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition duration-150 active:scale-[0.98] shadow-sm shadow-blue-500/15"
                      id={`kds-ready-btn-${order.id}`}
                    >
                      <CheckCircle className="w-4 h-4 text-white/90" />
                      <span>Mark Ready</span>
                    </button>
                  )}

                  {order.status === "Ready" && (
                    <button
                      onClick={() => handleActionClick(order, "Completed")}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 border border-slate-200 transition duration-150 active:scale-[0.98]"
                      id={`kds-clear-btn-${order.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Clear Order</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
