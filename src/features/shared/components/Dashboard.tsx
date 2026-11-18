import { displayOrderNumber } from "../../../../shared/orderNumber";
import { printReceipt } from '../utils/printReceipt';
import React, { useState, useMemo } from "react";
import ReceiptTotals from "./ReceiptTotals";
import { Card } from "./ui/Card";
import FssaiRegistration from "./FssaiRegistration";
import { 
  TrendingUp, 
  Activity, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  BarChart3, 
  TrendingDown,
  Layers,
  ShoppingBag,
  CircleDollarSign,
  Briefcase,
  Eye,
  X,
  Printer,
  ChevronRight,
  CreditCard,
  User,
  Receipt,
  Search,
  FileText,
  CheckCircle2,
  Share2
} from "lucide-react";
import { Ingredient, Order, Shift, RestaurantTenant, InventorySettings } from "../types";

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
  activeTenant?: RestaurantTenant;
  settings?: InventorySettings;
}

type PeriodType = "yesterday" | "week" | "month" | "custom";
const formatRupees = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const isPaidOrder = (order: Order) => order.status === "Completed" && Boolean(order.paidAt);

export default function Dashboard({
  dashboardStats,
  ingredients,
  orders,
  shifts,
  setActiveTab,
  handleGenerateAIReport,
  activeTenant,
  settings
}: DashboardProps) {
  // Main view toggle
  const [dashboardViewTab, setDashboardViewTab] = useState<"live" | "analytics">("live");

  // Date Range state for analytics view
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("week");

  // Custom date picker states (defaults to last 7 days)
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Drilldown selection state (Option 1)
  const [selectedDrilldownDay, setSelectedDrilldownDay] = useState<{
    dateLabel: string;
    sales: number;
    profit: number;
    cost: number;
    orders: number;
    upi: number;
    cash: number;
    ordersList: Order[];
  } | null>(null);

  // Selected single order for printable Tax Invoice modal
  const [selectedOrderReceipt, setSelectedOrderReceipt] = useState<Order | null>(null);
  const [drilldownSearch, setDrilldownSearch] = useState<string>("");
  const [drilldownPaymentFilter, setDrilldownPaymentFilter] = useState<"All" | "Cash" | "UPI">("All");

  // Use exclusively genuine restaurant orders. No synthetic or dummy data is generated.
  const allOrdersCombined = useMemo(() => {
    const realOrders = orders || [];
    return [...realOrders].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [orders]);

  const liveOrderSummary = useMemo(() => {
    const today = new Date().toDateString();
    const todaysOrders = (orders || []).filter((order) => order.date && new Date(order.date).toDateString() === today);
    return {
      paid: todaysOrders.filter(isPaidOrder).length,
      pending: todaysOrders.filter((order) => order.status !== "Cancelled" && !order.paidAt).length,
    };
  }, [orders]);

  // Compute stats based on the selected period
  const periodAnalytics = useMemo(() => {
    const now = new Date();

    // 1. Define active period boundaries
    let startDate: Date;
    let endDate: Date = new Date();
    endDate.setHours(23, 59, 59, 999);

    // Comparative periods boundaries for calculating trend percentages (Option 4)
    let compStartDate: Date;
    let compEndDate: Date;

    if (selectedPeriod === "yesterday") {
      const yesterdayStart = new Date();
      yesterdayStart.setDate(now.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);

      const yesterdayEnd = new Date();
      yesterdayEnd.setDate(now.getDate() - 1);
      yesterdayEnd.setHours(23, 59, 59, 999);

      startDate = yesterdayStart;
      endDate = yesterdayEnd;

      // Comparative: Day before yesterday
      const dayBeforeStart = new Date();
      dayBeforeStart.setDate(now.getDate() - 2);
      dayBeforeStart.setHours(0, 0, 0, 0);

      const dayBeforeEnd = new Date();
      dayBeforeEnd.setDate(now.getDate() - 2);
      dayBeforeEnd.setHours(23, 59, 59, 999);

      compStartDate = dayBeforeStart;
      compEndDate = dayBeforeEnd;
    } else if (selectedPeriod === "week") {
      const weekStart = new Date();
      weekStart.setDate(now.getDate() - 6); // Last 7 days
      weekStart.setHours(0, 0, 0, 0);

      startDate = weekStart;

      // Comparative: Previous 7 days
      const lastWeekStart = new Date();
      lastWeekStart.setDate(now.getDate() - 13);
      lastWeekStart.setHours(0, 0, 0, 0);

      const lastWeekEnd = new Date();
      lastWeekEnd.setDate(now.getDate() - 7);
      lastWeekEnd.setHours(23, 59, 59, 999);

      compStartDate = lastWeekStart;
      compEndDate = lastWeekEnd;
    } else if (selectedPeriod === "month") {
      const monthStart = new Date();
      monthStart.setDate(now.getDate() - 29); // Last 30 days
      monthStart.setHours(0, 0, 0, 0);

      startDate = monthStart;

      // Comparative: Previous 30 days (days 31 to 60 ago)
      const lastMonthStart = new Date();
      lastMonthStart.setDate(now.getDate() - 59);
      lastMonthStart.setHours(0, 0, 0, 0);

      const lastMonthEnd = new Date();
      lastMonthEnd.setDate(now.getDate() - 30);
      lastMonthEnd.setHours(23, 59, 59, 999);

      compStartDate = lastMonthStart;
      compEndDate = lastMonthEnd;
    } else {
      // Custom date range
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);

      startDate = start;
      endDate = end;

      // Comparative: Equal length period in the past
      const durationMs = end.getTime() - start.getTime();
      const compStart = new Date(start.getTime() - durationMs - 1);
      const compEnd = new Date(start.getTime() - 1);

      compStartDate = compStart;
      compEndDate = compEnd;
    }

    // 2. Filter orders for current period vs comparative period
    const currentPeriodOrders = allOrdersCombined.filter(o => {
      const orderTime = new Date(o.date).getTime();
      return orderTime >= startDate.getTime() && orderTime <= endDate.getTime() && isPaidOrder(o);
    });

    const comparativePeriodOrders = allOrdersCombined.filter(o => {
      const orderTime = new Date(o.date).getTime();
      return orderTime >= compStartDate.getTime() && orderTime <= compEndDate.getTime() && isPaidOrder(o);
    });

    // Preserve the existing estimate: 35% of recorded menu-item prices.
    // This does not include a recipe lookup or operating overhead.
    const calculateOrderFoodCost = (order: Order) => {
      let cost = 0;
      if (!order.items) return 0;

      order.items.forEach(item => {
        if (!item.menuItem) return;

        const itemPrice = item.menuItem.price || 0;
        const itemQuantity = item.quantity || 1;
        cost += (itemPrice * 0.35) * itemQuantity;
      });

      return Math.round(cost);
    };

    // Calculate current stats
    const totalRevenue = currentPeriodOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalFoodCost = currentPeriodOrders.reduce((sum, o) => sum + calculateOrderFoodCost(o), 0);
    const estimatedProfit = Math.max(0, totalRevenue - totalFoodCost);
    const orderCount = currentPeriodOrders.length;
    const avgTicket = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

    const upiRevenue = currentPeriodOrders.filter(o => o.paymentMethod === "UPI").reduce((sum, o) => sum + (o.total || 0), 0);
    const cashRevenue = currentPeriodOrders.filter(o => o.paymentMethod === "Cash").reduce((sum, o) => sum + (o.total || 0), 0);

    // Calculate comparative stats
    const compRevenue = comparativePeriodOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const compFoodCost = comparativePeriodOrders.reduce((sum, o) => sum + calculateOrderFoodCost(o), 0);
    const compProfit = Math.max(0, compRevenue - compFoodCost);
    const compOrderCount = comparativePeriodOrders.length;
    const compAvgTicket = compOrderCount > 0 ? Math.round(compRevenue / compOrderCount) : 0;

    // Calculate Trend Percentages (Option 4)
    const calculateTrend = (current: number, past: number) => {
      if (past === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - past) / past) * 100);
    };

    const salesTrend = calculateTrend(totalRevenue, compRevenue);
    const profitTrend = calculateTrend(estimatedProfit, compProfit);
    const ordersTrend = calculateTrend(orderCount, compOrderCount);
    const ticketTrend = calculateTrend(avgTicket, compAvgTicket);

    // Calculate daily data breakdown for charts and drilldown (Option 1 & 3)
    const dailyMap: { [dateKey: string]: { dateLabel: string; sales: number; profit: number; cost: number; orders: number; upi: number; cash: number; ordersList: Order[] } } = {};

    // Initialize day slots for the selected period
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    // For Yesterday or Custom with 1 day, let's split by hourly intervals. For larger spans, split by days.
    const isHourlySplit = durationDays <= 1.5;

    if (isHourlySplit) {
      // Hourly slots (e.g. "12 PM", "2 PM", etc.)
      for (let h = 11; h <= 22; h += 2) {
        const slotKey = `${h}:00`;
        const displayLabel = h > 12 ? `${h - 12} PM` : h === 12 ? "12 PM" : `${h} AM`;
        dailyMap[slotKey] = {
          dateLabel: displayLabel,
          sales: 0,
          profit: 0,
          cost: 0,
          orders: 0,
          upi: 0,
          cash: 0,
          ordersList: []
        };
      }

      currentPeriodOrders.forEach(o => {
        const oDate = new Date(o.date);
        const hour = oDate.getHours();
        // Snap to nearest 2 hour slot
        const snappedHour = Math.max(11, Math.min(21, Math.floor(hour / 2) * 2 + 1));
        const slotKey = `${snappedHour}:00`;
        if (dailyMap[slotKey]) {
          const cost = calculateOrderFoodCost(o);
          dailyMap[slotKey].sales += o.total || 0;
          dailyMap[slotKey].cost += cost;
          dailyMap[slotKey].profit += (o.total || 0) - cost;
          dailyMap[slotKey].orders += 1;
          dailyMap[slotKey].ordersList.push(o);
          if (o.paymentMethod === "UPI") dailyMap[slotKey].upi += o.total || 0;
          if (o.paymentMethod === "Cash") dailyMap[slotKey].cash += o.total || 0;
        }
      });
    } else {
      // Daily slots
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const key = d.toDateString();
        const displayLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        dailyMap[key] = {
          dateLabel: displayLabel,
          sales: 0,
          profit: 0,
          cost: 0,
          orders: 0,
          upi: 0,
          cash: 0,
          ordersList: []
        };
      }

      currentPeriodOrders.forEach(o => {
        const key = new Date(o.date).toDateString();
        if (dailyMap[key]) {
          const cost = calculateOrderFoodCost(o);
          dailyMap[key].sales += o.total || 0;
          dailyMap[key].cost += cost;
          dailyMap[key].profit += (o.total || 0) - cost;
          dailyMap[key].orders += 1;
          dailyMap[key].ordersList.push(o);
          if (o.paymentMethod === "UPI") dailyMap[key].upi += o.total || 0;
          if (o.paymentMethod === "Cash") dailyMap[key].cash += o.total || 0;
        }
      });
    }

    // Sort orders in each day by time descending (newest first)
    Object.values(dailyMap).forEach(d => {
      d.ordersList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    const chartData = Object.values(dailyMap);

    // Calculate Top Selling Items specifically in this period
    const itemSalesMap: { [id: string]: { name: string; qty: number; sales: number } } = {};
    currentPeriodOrders.forEach((order) => {
      if (!order.items) return;
      order.items.forEach((item) => {
        if (!item.menuItem) return;
        const mId = item.menuItem.id;
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

    const topSellingInPeriod = Object.values(itemSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const comparisonLabel =
      selectedPeriod === "yesterday" ? "vs Yesterday" :
      selectedPeriod === "week" ? "vs Last week" :
      selectedPeriod === "month" ? "vs Last month" :
      "vs Prev Period";

    return {
      startDate,
      endDate,
      totalRevenue,
      totalFoodCost,
      estimatedProfit,
      orderCount,
      avgTicket,
      upiRevenue,
      cashRevenue,
      salesTrend,
      profitTrend,
      ordersTrend,
      ticketTrend,
      chartData,
      topSellingInPeriod,
      comparisonLabel,
      hasSalesComparison: compRevenue > 0,
      hasProfitComparison: compProfit > 0,
      hasOrdersComparison: compOrderCount > 0,
      hasTicketComparison: compAvgTicket > 0,
    };
  }, [selectedPeriod, customStartDate, customEndDate, allOrdersCombined]);

  const analyticsMetrics = [
    { label: "Net Sales", value: formatRupees(periodAnalytics.totalRevenue), hint: periodAnalytics.orderCount ? "Paid sales only" : "No paid sales yet", trend: periodAnalytics.salesTrend, hasComparison: periodAnalytics.hasSalesComparison },
    { label: "Estimated Profit", value: formatRupees(periodAnalytics.estimatedProfit), hint: periodAnalytics.totalRevenue > 0 ? "Uses a 35% cost estimate" : "No paid sales yet", trend: periodAnalytics.profitTrend, hasComparison: periodAnalytics.hasProfitComparison },
    { label: "Paid Checkouts", value: String(periodAnalytics.orderCount), hint: "Pending orders excluded", trend: periodAnalytics.ordersTrend, hasComparison: periodAnalytics.hasOrdersComparison },
    { label: "Average Paid Bill", value: formatRupees(periodAnalytics.avgTicket), hint: "Based on paid checkouts", trend: periodAnalytics.ticketTrend, hasComparison: periodAnalytics.hasTicketComparison },
  ];

  return (
    <div className="h-full p-4 sm:p-6 flex flex-col gap-6 overflow-y-auto bg-[#fafbfd] select-text">

      {/* BRAND & VIEW DESK TAB SELECTOR */}
      <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
            Executive Performance Dashboard
          </h2>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl max-w-sm self-start sm:self-center border border-slate-200/50">
          <button
            onClick={() => setDashboardViewTab("live")}
            className={`min-h-11 px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              dashboardViewTab === "live" ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span>Today Live Stream</span>
          </button>

          <button
            onClick={() => setDashboardViewTab("analytics")}
            className={`min-h-11 px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              dashboardViewTab === "analytics" ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Time-Range Insights</span>
          </button>
        </div>
      </div>

      {/* ================= VIEW 1: TODAY LIVE DESK ================= */}
      {dashboardViewTab === "live" && (
        <>
          <section aria-label="Today's summary" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <article aria-labelledby="dashboard-sales-label" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm">
              <p id="dashboard-sales-label" className="text-xs font-semibold text-slate-600">Net Sales Today</p>
              <p data-testid="dashboard-net-sales" className="mt-3 text-xl sm:text-2xl font-extrabold tabular-nums text-slate-900 [overflow-wrap:anywhere]">{formatRupees(dashboardStats.totalRevenue)}</p>
              <p className="mt-2 text-xs text-slate-600">{dashboardStats.totalRevenue > 0 ? "Paid sales only" : "No paid sales yet"}</p>
              {dashboardStats.totalRevenue > 0 && <p className="mt-3 text-xs text-slate-600 [overflow-wrap:anywhere]">Cash {Math.round(dashboardStats.cashRevenue / dashboardStats.totalRevenue * 100)}% · UPI {Math.round(dashboardStats.upiRevenue / dashboardStats.totalRevenue * 100)}%</p>}
            </article>
            <article aria-labelledby="dashboard-paid-label" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm">
              <p id="dashboard-paid-label" className="text-xs font-semibold text-slate-600">Paid Checkouts</p>
              <p data-testid="dashboard-paid-checkouts" className="mt-3 text-xl sm:text-2xl font-extrabold tabular-nums text-slate-900">{liveOrderSummary.paid}</p>
              <dl className="mt-2 space-y-1 text-xs text-slate-600">
                <div className="flex flex-wrap justify-between gap-1"><dt>Pending orders</dt><dd data-testid="dashboard-pending-orders" className="font-bold text-slate-900">{liveOrderSummary.pending}</dd></div>
                <div className="flex flex-wrap justify-between gap-1"><dt>Orders today</dt><dd>{dashboardStats.totalOrders}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-slate-600 [overflow-wrap:anywhere]">Avg paid bill {formatRupees(liveOrderSummary.paid ? dashboardStats.totalRevenue / liveOrderSummary.paid : 0)}</p>
            </article>
            <article aria-labelledby="dashboard-shifts-label" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm">
              <p id="dashboard-shifts-label" className="text-xs font-semibold text-slate-600">Active Shifts</p>
              <p className="mt-3 text-xl sm:text-2xl font-extrabold tabular-nums text-slate-900">{dashboardStats.activeShiftsCount}</p>
              <p className="mt-2 text-xs text-slate-600">{dashboardStats.activeShiftsCount ? "Clocked-in staff" : "No active shifts"}</p>
              <button type="button" onClick={() => setActiveTab("shifts")} className="mt-2 min-h-11 text-left text-xs font-semibold text-blue-700 hover:underline">View shifts →</button>
            </article>
            <article aria-labelledby="dashboard-stock-label" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-sm">
              <p id="dashboard-stock-label" className="text-xs font-semibold text-slate-600">Low Stock</p>
              <p className={`mt-3 text-xl sm:text-2xl font-extrabold tabular-nums ${dashboardStats.lowStockItems.length ? "text-rose-700" : "text-slate-900"}`}>{dashboardStats.lowStockItems.length}</p>
              <p className="mt-2 text-xs text-slate-600">{!ingredients.length ? "No ingredients yet" : dashboardStats.lowStockItems.length ? "Ingredients to reorder" : "All levels healthy"}</p>
              <button type="button" onClick={() => setActiveTab("inventory")} className="mt-2 min-h-11 text-left text-xs font-semibold text-blue-700 hover:underline">View inventory →</button>
            </article>
          </section>
          <nav aria-label="Quick actions" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[{ label: "New bill", tab: "billing" }, { label: "Inventory", tab: "inventory" }, { label: "Reports", tab: "ai-reports" }, { label: "Settings", tab: "settings" }].map((action) => (
              <button key={action.tab} type="button" onClick={() => setActiveTab(action.tab)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600">{action.label}</button>
            ))}
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
            {/* Real-time Order Stream */}
            <div className="min-w-0 lg:col-span-8 bg-white border border-slate-200 rounded-2xl flex flex-col shadow-sm overflow-hidden min-h-[350px]">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight font-display">Real-time Order Stream</h3>
                  <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded text-[9px] font-mono font-bold">LIVE SYNC</span>
                </div>
                <span className="text-[10px] text-slate-600 font-mono">Synced seconds ago</span>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div tabIndex={0} role="region" aria-label="Order stream table" className="overflow-x-auto w-full">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50/75 border-b border-slate-100 sticky top-0 text-slate-600 font-bold">
                      <tr>
                        <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">ID</th>
                        <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Staff Server</th>
                        <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Table Ref</th>
                        <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Items Ordered</th>
                        <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Method</th>
                        <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Total</th>
                        <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-600 italic font-sans">No checkout records received today.</td>
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
                                  #{displayOrderNumber(order.orderNumber)}
                                </span>
                              </td>
                              <td className="p-3.5 font-medium text-slate-700">{order.cashierName}</td>
                              <td className="p-3.5 text-slate-600">{order.tableNo || "Takeaway"}</td>
                              <td className="p-3.5 max-w-[200px] truncate text-slate-600 font-medium" title={itemsSummarized}>{itemsSummarized}</td>
                              <td className="p-3.5">
                                {order.paymentMethod ? (
                                  <span className="bg-slate-100 border border-slate-200/50 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold text-[9px]">
                                    {order.paymentMethod}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 italic">Unsettled</span>
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

            <div className="min-w-0 lg:col-span-4 flex flex-col gap-6 overflow-hidden">
              {/* Popular Menu Items */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
                  <h3 className="font-bold text-sm text-slate-900 font-display">Popular Menu Items</h3>
                  <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 text-[9px] font-extrabold uppercase font-mono rounded">Sales Leaderboard</span>
                </div>
                <div className="p-5 space-y-3">
                  {dashboardStats.topSellingItems.length === 0 ? (
                    <p className="text-slate-600 text-xs italic">No sales logs to compute popularity yet.</p>
                  ) : (
                    dashboardStats.topSellingItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 bg-blue-50 border border-blue-100/30 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-800">{item.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-600 font-mono">
                          <b className="text-slate-800 font-bold">{item.qty}</b> portions
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Critical Ingredients */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col flex-1">
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
                          <span className={`font-mono ${isLow ? "text-rose-500 font-bold" : "text-slate-600"}`}>
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
        </>
      )}

      {/* ================= VIEW 2: PERIOD CHRONO ANALYTICS ================= */}
      {dashboardViewTab === "analytics" && (
        <div className="space-y-6 animate-fade-in">

          {/* OPTION 1: TIME RANGE SELECTOR BAR */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedPeriod("yesterday")}
                className={`min-h-11 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border ${
                  selectedPeriod === "yesterday"
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Yesterday</span>
              </button>

              <button
                onClick={() => setSelectedPeriod("week")}
                className={`min-h-11 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border ${
                  selectedPeriod === "week"
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Last 7 Days</span>
              </button>

              <button
                onClick={() => setSelectedPeriod("month")}
                className={`min-h-11 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border ${
                  selectedPeriod === "month"
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Last 30 Days</span>
              </button>

              <button
                onClick={() => setSelectedPeriod("custom")}
                className={`min-h-11 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border ${
                  selectedPeriod === "custom"
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Custom Range</span>
              </button>
            </div>

            {/* Custom Range Inputs */}
            {selectedPeriod === "custom" && (
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-150 animate-fade-in">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-600 uppercase font-mono">From</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-white border border-slate-200/80 rounded px-2 py-1 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-600 uppercase font-mono">To</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-white border border-slate-200/80 rounded px-2 py-1 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
              </div>
            )}

            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono">Selected Duration</p>
              <p className="text-xs font-extrabold text-indigo-700 font-mono mt-0.5">
                {periodAnalytics.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {periodAnalytics.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* DYNAMIC METRIC CARDS WITH HIGHEST VISIBILITY CONTRAST */}
          <section aria-label="Selected period summary" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {analyticsMetrics.map((metric) => <Card key={metric.label} role="group" aria-label={metric.label} className="min-w-0">
              <p className="text-xs font-semibold text-slate-600">{metric.label}</p>
              <p className="mt-3 text-xl sm:text-2xl font-extrabold tabular-nums text-slate-900 [overflow-wrap:anywhere]">{metric.value}</p>
              <p className="mt-2 text-xs text-slate-600">{metric.hint}</p>
              <p className="mt-3 text-xs text-slate-600 [overflow-wrap:anywhere]">{metric.hasComparison ? (
                <span className={metric.trend >= 0 ? "font-semibold text-emerald-800" : "font-semibold text-rose-800"}>{metric.trend >= 0 ? "+" : ""}{metric.trend}% {periodAnalytics.comparisonLabel}</span>
              ) : "No comparison data"}</p>
            </Card>)}
          </section>

          {/* OPTION 3 BREAKDOWN: HIGH-CONTRAST CHART & TRANSACTION GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left: SVG Revenue Trend Chart */}
            <div className="min-w-0 lg:col-span-8 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 tracking-tight font-display">Chronological Performance Chart</h3>
                  <p className="text-[10px] text-slate-600 mt-0.5">Paid sales and estimated profit for the selected period.</p>
                </div>
                <div className="flex gap-4 text-xs font-bold">
                  <div className="flex items-center gap-1.5 text-indigo-700">
                    <span className="w-3 h-3 bg-indigo-600 rounded" />
                    <span>Net Sales</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <span className="w-3 h-3 bg-emerald-500 rounded" />
                    <span>Estimated Profit</span>
                  </div>
                </div>
              </div>

              {/* Responsive custom-crafted SVG Chart */}
              <div className="flex-1 w-full min-h-[220px] flex items-end justify-center relative select-none">
                {periodAnalytics.chartData.length === 0 || periodAnalytics.orderCount === 0 ? (
                  <div className="text-slate-600 text-xs italic py-16 text-center">
                    No paid checkouts in the selected period. Real orders placed at the billing terminal will appear here automatically.
                  </div>
                ) : (
                  <div className="w-full h-[220px] flex flex-col justify-between">
                    {/* Visual columns bars container */}
                    <div className="flex-1 w-full flex items-end justify-between px-2 gap-3">
                      {periodAnalytics.chartData.map((d, index) => {
                        const maxSales = Math.max(...periodAnalytics.chartData.map(cd => cd.sales)) || 1;
                        const salesHeightPct = maxSales > 0 ? (d.sales / maxSales) * 85 : 0; // Max height 85% to fit margins
                        const profitHeightPct = maxSales > 0 ? (d.profit / maxSales) * 85 : 0;

                        return (
                          <div key={index} className="flex-1 flex flex-col items-center justify-end group h-full relative">
                            {/* Hover info tooltip box with highest contrast */}
                            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] p-2 rounded-lg pointer-events-none z-10 shadow-lg min-w-[110px] border border-slate-700 font-mono">
                              <p className="font-black text-slate-300 border-b border-slate-700 pb-1 mb-1">{d.dateLabel}</p>
                              <p className="text-indigo-400">Sales: INR {d.sales.toLocaleString()}</p>
                              <p className="text-emerald-400">Profit: INR {d.profit.toLocaleString()}</p>
                              <p className="text-slate-600">Orders: {d.orders}</p>
                            </div>

                            {/* Bar segment Stack */}
                            <div
                              onClick={() => {
                                if (d.orders > 0) {
                                  setSelectedDrilldownDay(d);
                                  setDrilldownSearch("");
                                  setDrilldownPaymentFilter("All");
                                }
                              }}
                              className={`w-full flex items-end justify-center gap-0.5 max-w-[45px] h-full ${d.orders > 0 ? "cursor-pointer hover:opacity-85" : "cursor-default opacity-40"} transition-opacity`}
                            >
                              {/* Sales Bar */}
                              <div
                                style={{ height: d.sales > 0 ? `${Math.max(4, salesHeightPct)}%` : "0%" }}
                                className="w-1/2 bg-indigo-600/95 hover:bg-indigo-700 transition-all rounded-t-sm relative"
                              />
                              {/* Profit Bar */}
                              <div
                                style={{ height: d.profit > 0 ? `${Math.max(4, profitHeightPct)}%` : "0%" }}
                                className="w-1/2 bg-emerald-500 hover:bg-emerald-600 transition-all rounded-t-sm relative"
                              />
                            </div>

                            {/* Column text label */}
                            <span className="text-[9px] text-slate-600 font-bold font-mono mt-2 truncate w-full text-center">
                              {d.dateLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Top Selling menu items specifically in this filtered range */}
            <div className="min-w-0 lg:col-span-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col">
              <h3 className="font-bold text-sm text-slate-900 tracking-tight font-display mb-4 border-b border-slate-100 pb-3">
                Top Sellers in Selected Period
              </h3>

              <div className="flex-1 space-y-4">
                {periodAnalytics.topSellingInPeriod.length === 0 ? (
                  <p className="text-slate-600 text-xs italic">No orders computed for this duration.</p>
                ) : (
                  periodAnalytics.topSellingInPeriod.map((item, idx) => {
                    const maxQty = Math.max(...periodAnalytics.topSellingInPeriod.map(i => i.qty)) || 1;
                    const pct = (item.qty / maxQty) * 100;
                    return (
                      <div key={idx} className="flex flex-col gap-1.5 text-xs">
                        <div className="flex justify-between items-center text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-indigo-50 border border-indigo-100/50 text-indigo-700 rounded-md font-bold text-[10px] flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-slate-800">{item.name}</span>
                          </div>
                          <span className="font-mono text-slate-600">
                            <b className="text-slate-800 font-bold">{item.qty}</b> portions (INR {item.sales})
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* DYNAMIC BREAKDOWN TABLE WITH INTERACTIVE ROW DRILLDOWN (OPTION 1) */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex flex-wrap justify-between items-center gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 font-display">Daily Performance Breakdowns</h3>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100 hidden sm:inline-flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Click any row to view full order bills
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-md font-mono">
                {periodAnalytics.chartData.filter(r => r.orders > 0).length} active dates
              </span>
            </div>

            <div tabIndex={0} role="region" aria-label="Daily performance table" className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-150 text-slate-600 font-bold font-mono">
                  <tr>
                    <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Day Interval / Date</th>
                    <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Checkout count</th>
                    <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">UPI Payments</th>
                    <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Cash Payments</th>
                    <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Net Sales</th>
                    <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Est. Food Cost</th>
                    <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600">Est. Profit Margin</th>
                    <th className="p-3.5 text-[10px] tracking-wider uppercase font-semibold text-slate-600 text-right">Orders Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {periodAnalytics.chartData.filter(r => r.orders > 0).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-600 italic">No checkout records found in this time range.</td>
                    </tr>
                  ) : (
                    periodAnalytics.chartData.filter(row => row.orders > 0).map((row, idx) => (
                      <tr
                        key={idx}
                        onClick={() => {
                          setSelectedDrilldownDay(row);
                          setDrilldownSearch("");
                          setDrilldownPaymentFilter("All");
                        }}
                        className="hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                      >
                        <td className="p-3.5 font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span>{row.dateLabel}</span>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-600 font-mono">{row.orders} orders</td>
                        <td className="p-3.5 text-indigo-700 font-bold font-mono">INR {row.upi.toLocaleString()}</td>
                        <td className="p-3.5 text-slate-700 font-bold font-mono">INR {row.cash.toLocaleString()}</td>
                        <td className="p-3.5 text-slate-900 font-extrabold font-mono text-[12px]">INR {row.sales.toLocaleString()}</td>
                        <td className="p-3.5 text-rose-700 font-medium font-mono">INR {row.cost.toLocaleString()}</td>
                        <td className="p-3.5 text-emerald-800 font-bold font-mono">
                          <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            INR {row.profit.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono">
                          <button
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-lg border border-indigo-200/80 transition-all shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View {row.orders} Bills ➜</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* OPTION 1 DRILLDOWN MODAL: VIEW ALL ORDERS FOR SELECTED DAY */}
      {selectedDrilldownDay && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">

            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900 font-display">
                      Order Details for {selectedDrilldownDay.dateLabel}
                    </h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono">
                      {selectedDrilldownDay.orders} Total Checkouts
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Click any order to inspect or print its full Tax Invoice Bill.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDrilldownDay(null)}
                className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Metrics Bar for the Selected Day */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-100/60 border-b border-slate-200/70 font-mono text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-600 font-bold uppercase block">Total Net Sales</span>
                <span className="text-sm font-black text-slate-900">INR {selectedDrilldownDay.sales.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-600 font-bold uppercase block">UPI Collections</span>
                <span className="text-sm font-black text-indigo-700">INR {selectedDrilldownDay.upi.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-600 font-bold uppercase block">Cash Collections</span>
                <span className="text-sm font-black text-emerald-700">INR {selectedDrilldownDay.cash.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-600 font-bold uppercase block">Est. Day Profit</span>
                <span className="text-sm font-black text-emerald-800">INR {selectedDrilldownDay.profit.toLocaleString()}</span>
              </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  placeholder="Search by Order ID, Customer, Table or Item..."
                  value={drilldownSearch}
                  onChange={(e) => setDrilldownSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] text-slate-600 font-bold uppercase">Payment:</span>
                {(["All", "UPI", "Cash"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setDrilldownPaymentFilter(mode)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer border ${
                      drilldownPaymentFilter === mode
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders List / Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(() => {
                const filteredOrders = selectedDrilldownDay.ordersList.filter((order) => {
                  if (drilldownPaymentFilter !== "All" && order.paymentMethod !== drilldownPaymentFilter) {
                    return false;
                  }
                  if (drilldownSearch.trim()) {
                    const q = drilldownSearch.toLowerCase();
                    const matchId = (order.orderNumber || order.id || "").toLowerCase().includes(q);
                    const matchCust = (order.customerName || "").toLowerCase().includes(q);
                    const matchTable = (order.tableNo || "").toLowerCase().includes(q);
                    const matchItems = order.items?.some(i => i.menuItem?.name?.toLowerCase().includes(q));
                    return matchId || matchCust || matchTable || matchItems;
                  }
                  return true;
                });

                if (filteredOrders.length === 0) {
                  return (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-600 text-xs">
                      No matching order details found for this date.
                    </div>
                  );
                }

                return filteredOrders.map((order, oIdx) => {
                  const orderTimeStr = new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div
                      key={order.id || oIdx}
                      onClick={() => setSelectedOrderReceipt(order)}
                      className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            #{displayOrderNumber(order.orderNumber || order.id.slice(-4))}
                          </span>
                          <span className="text-xs font-semibold text-slate-600 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-600" />
                            {orderTimeStr}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                            order.paymentMethod === "UPI"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            {order.paymentMethod || "Cash"}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {order.type || "Dine-In"} {order.tableNo ? `(${order.tableNo})` : ""}
                          </span>
                          {order.customerName && (
                            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-600" /> {order.customerName}
                            </span>
                          )}
                        </div>

                        {/* Item portions breakdown */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                          {order.items?.map((item, iIdx) => (
                            <span key={iIdx} className="bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                              <b className="text-indigo-600 font-bold">{item.quantity}x</b> {item.menuItem?.name || "Item"}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Total Amount & Action */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-left sm:text-right font-mono">
                          <span className="text-[10px] text-slate-600 font-bold uppercase block">Bill Amount</span>
                          <span className="text-base font-black text-slate-900">
                            INR {(order.total || 0).toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderReceipt(order);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 shadow-2xs"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View Invoice</span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-600">
              <span>Showing historical transactions recorded in selected interval</span>
              <button
                onClick={() => setSelectedDrilldownDay(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DETAILED TAX INVOICE RECEIPT MODAL */}
      {selectedOrderReceipt && (
        <div className="historical-receipt-modal fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">

            {/* Invoice Top Bar */}
            <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs tracking-wider uppercase font-mono">
                  {(settings?.gstin || activeTenant?.gstin) ? "Tax Invoice Receipt" : "Retail Cash Bill"}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrderReceipt(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Receipt Body */}
            <div className="historical-receipt-print-body flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs text-slate-800 bg-white">
              <div className="text-center border-b border-dashed border-slate-300 pb-4">
                <h2 className="text-lg font-black text-slate-900 uppercase font-sans">
                  {activeTenant?.name || "Aatmyam Pos Restaurant"}
                </h2>
                <p className="text-[11px] text-slate-600 mt-0.5">Authentic Dining & Quick Billing Hub</p>
                <p className="text-[10px] text-slate-600 mt-1">
                  {(settings?.gstin || activeTenant?.gstin) ? `GSTIN: ${(settings?.gstin || activeTenant?.gstin)?.toUpperCase()}` : "Retail Cash Bill"}
                </p>
                <FssaiRegistration number={settings?.fssaiNumber} />
              </div>

              {/* Order Meta Info */}
              <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-dashed border-slate-300 pb-3">
                <div>
                  <span className="text-slate-600 block text-[9px] uppercase font-bold">Order ID</span>
                  <span className="font-bold text-slate-900">#{displayOrderNumber(selectedOrderReceipt.orderNumber || selectedOrderReceipt.id.slice(-4))}</span>
                </div>
                <div>
                  <span className="text-slate-600 block text-[9px] uppercase font-bold">Date & Time</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedOrderReceipt.date).toLocaleDateString()} {new Date(selectedOrderReceipt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block text-[9px] uppercase font-bold">Order Type / Table</span>
                  <span className="font-semibold text-slate-800">
                    {selectedOrderReceipt.type || "Dine-In"} {selectedOrderReceipt.tableNo ? `(${selectedOrderReceipt.tableNo})` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block text-[9px] uppercase font-bold">Cashier / Server</span>
                  <span className="font-semibold text-slate-800">{selectedOrderReceipt.cashierName || "Rahul Sharma"}</span>
                </div>
                {selectedOrderReceipt.customerName && (
                  <div className="col-span-2">
                    <span className="text-slate-600 block text-[9px] uppercase font-bold">Customer</span>
                    <span className="font-semibold text-slate-800">{selectedOrderReceipt.customerName}</span>
                  </div>
                )}
              </div>

              {/* Items Breakdown Table */}
              <div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 text-[9px] uppercase">
                      <th className="text-left py-1 font-bold">Item Description</th>
                      <th className="text-center py-1 font-bold">Qty</th>
                      <th className="text-right py-1 font-bold">Rate</th>
                      <th className="text-right py-1 font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrderReceipt.items?.map((item, idx) => {
                      const rate = item.menuItem?.price || 0;
                      const lineTotal = rate * (item.quantity || 1);
                      return (
                        <tr key={idx} className="py-1.5">
                          <td className="py-1.5 font-medium text-slate-800">{item.menuItem?.name || "Item"}</td>
                          <td className="py-1.5 text-center font-bold text-slate-700">{item.quantity}</td>
                          <td className="py-1.5 text-right text-slate-600">₹{rate}</td>
                          <td className="py-1.5 text-right font-bold text-slate-900">₹{lineTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bill Financial Totals */}
              <ReceiptTotals order={selectedOrderReceipt} />

              {/* Payment Method Details */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-slate-600 font-semibold">Payment Mode:</span>
                </div>
                <span className="font-bold font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {selectedOrderReceipt.paymentMethod || "Cash"}
                </span>
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-600">
                <p>Thank you for dining with us!</p>
                <p className="mt-0.5">Please visit again.</p>
              </div>
            </div>

            {/* Invoice Action Buttons */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  printReceipt('.historical-receipt-print-body');
                }}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Bill</span>
              </button>

              <button
                onClick={() => setSelectedOrderReceipt(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
