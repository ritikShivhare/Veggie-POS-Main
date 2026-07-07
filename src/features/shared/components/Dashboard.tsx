import React from "react";
import { TrendingUp, Activity, Clock, AlertTriangle, Sparkles } from "lucide-react";
import { Ingredient, Order, Shift } from "../types";

interface DashboardProps {
  dashboardStats: {
    totalRevenue: number;
    cashRevenue: number;
    upiRevenue: number;
    totalOrders: number;
    activeShiftsCount: number;
    lowStockItems: Ingredient[];
    totalStockValue: number;
    topSellingItems: { name: string; qty: number; sales: number }[];
  };
  ingredients: Ingredient[];
  orders: Order[];
  shifts: Shift[];
  setActiveTab: (tab: string) => void;
  handleGenerateAIReport: () => void;
}

export default function Dashboard({
  dashboardStats,
  ingredients,
  orders,
  shifts,
  setActiveTab,
  handleGenerateAIReport
}: DashboardProps) {
  return (
    <div className="h-full p-6 flex flex-col gap-6 overflow-y-auto bg-[#fafbfd]">
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Net Sales Today */}
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)] flex flex-col justify-between transition hover:shadow-md animate-fade-in">
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

        {/* Today's Transactions */}
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

        {/* Labor Shift Coverage */}
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

        {/* Critical Stock Alerts */}
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

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* Real-time Order Stream */}
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
                      const itemsSummarized = (order.items || [])
                        .map((i) => `${i?.menuItem?.name || "Unknown Item"} (x${i?.quantity || 1})`)
                        .join(", ");
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

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-hidden">
          
          {/* Popular Menu Items */}
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

          {/* Critical Ingredients */}
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
  );
}
