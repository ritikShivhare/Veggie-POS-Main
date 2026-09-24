import React, { useState, useMemo, useEffect } from "react";
import QRCode from "qrcode";
import { MenuItem, Ingredient, Recipe, CartItem, Order, StaffMember, InventorySettings, OrderStatus, Customer } from "../shared/types";
import { ApiClient } from "../shared/services/api";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  ChefHat,
  Receipt,
  CreditCard,
  Clock,
  Utensils,
  ChevronRight,
  Coins,
  Flame,
  Printer,
  QrCode,
  LayoutGrid,
  Copy,
  Check,
  FileText,
  X
} from "lucide-react";

interface POSBillingProps {
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  settings: InventorySettings;
  currentStaff: StaffMember;
  onOrderCreated: (order: Order) => void;
  onUpdateIngredients: (updated: Ingredient[]) => void;
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, paymentMethod?: 'Cash' | 'UPI', paidAt?: string) => void;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  activeTenant?: { name: string; tenantId?: string; vpa?: string };
}

export default function POSBilling({
  menuItems,
  ingredients,
  recipes,
  settings,
  currentStaff,
  onOrderCreated,
  onUpdateIngredients,
  orders = [],
  onUpdateOrderStatus,
  customers = [],
  setCustomers,
  activeTenant
}: POSBillingProps) {
  const [billingTab, setBillingTab] = useState<"catalog" | "billing">("catalog");
  const [billingOrder, setBillingOrder] = useState<Order | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartOnMobile, setShowCartOnMobile] = useState(false);
  
  // Checkout Form
  const [orderType, setOrderType] = useState<"Dine-In" | "Takeaway">("Dine-In");
  const [tableNo, setTableNo] = useState("T-01");
  const [customerName, setCustomerName] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [redeemPoints, setRedeemPoints] = useState<boolean>(false);
  const [itemNotes, setItemNotes] = useState<{ [key: string]: string }>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  // Payment popup
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<"Cash" | "UPI">("UPI");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string | null>(null);
  const [upiCopied, setUpiCopied] = useState(false);

  // Printing & Floor Map Modals
  const [receiptModalOrder, setReceiptModalOrder] = useState<Order | null>(null);
  const [kotModalOrder, setKotModalOrder] = useState<Order | null>(null);
  const [showFloorMap, setShowFloorMap] = useState<boolean>(false);
  const [billsFilter, setBillsFilter] = useState<"unpaid" | "settled" | "all">("unpaid");

  // Order Cancellation Modal State (Problem 1)
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelManagerPin, setCancelManagerPin] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Cash Drawer Pop Modal State (Problem 3)
  const [showDrawerPopModal, setShowDrawerPopModal] = useState(false);
  const [drawerPopReason, setDrawerPopReason] = useState("");
  const [drawerPopError, setDrawerPopError] = useState<string | null>(null);

  // Custom Discount Modal State (Problem 2)
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [customDiscountVal, setCustomDiscountVal] = useState<string>("");
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState("");
  const [discountManagerPin, setDiscountManagerPin] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);

  // Handle Order Cancellation with Manager PIN & Reason
  const handleConfirmCancelOrder = async () => {
    if (!cancelModalOrder) return;
    setCancelError(null);

    if (!cancelReason.trim()) {
      setCancelError("Cancellation reason is mandatory and cannot be left empty.");
      return;
    }

    if (!cancelManagerPin || cancelManagerPin.length < 4 || cancelManagerPin.length > 6) {
      setCancelError("Please enter a valid 4 to 6-digit Manager/Owner PIN.");
      return;
    }

    try {
      const sessId = ApiClient.getSessionId() || "";
      const currentTenantId = localStorage.getItem("veggiepos_active_tenant_id") || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessId) headers["x-session-id"] = sessId;
      if (currentTenantId) headers["x-tenant-id"] = currentTenantId;

      const res = await fetch(`/api/orders/${cancelModalOrder.id}/cancel`, {
        method: "POST",
        headers: {
          ...headers,
          "Idempotency-Key": ApiClient.generateIdempotencyKey(`cancel_${cancelModalOrder.id}`)
        },
        credentials: "include",
        body: JSON.stringify({
          managerPin: cancelManagerPin,
          reason: cancelReason.trim(),
          staffName: currentStaff?.name || "Staff",
          sessionId: sessId,
          tenantId: currentTenantId
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCancelError(data.message || data.error || "Failed to cancel order.");
        return;
      }

      onUpdateOrderStatus(cancelModalOrder.id, "Cancelled");
      alert(`Order #${cancelModalOrder.orderNumber} successfully cancelled! Cryptographic audit entry recorded.`);
      setCancelModalOrder(null);
      setCancelReason("");
      setCancelManagerPin("");
      setCancelError(null);
    } catch (err: any) {
      setCancelError(err.message || "Failed to communicate with server.");
    }
  };

  // Handle Cash Drawer Manual Pop Audit
  const handleConfirmCashDrawerPop = async () => {
    setDrawerPopError(null);
    if (!drawerPopReason.trim()) {
      setDrawerPopError("Reason for opening cash drawer without sale is mandatory.");
      return;
    }

    try {
      const sessId = ApiClient.getSessionId() || "";
      const currentTenantId = localStorage.getItem("veggiepos_active_tenant_id") || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessId) headers["x-session-id"] = sessId;
      if (currentTenantId) headers["x-tenant-id"] = currentTenantId;

      const res = await fetch("/api/pos/open-cash-drawer", {
        method: "POST",
        headers: {
          ...headers,
          "Idempotency-Key": ApiClient.generateIdempotencyKey("drawer_pop")
        },
        credentials: "include",
        body: JSON.stringify({
          staffName: currentStaff?.name || "Cashier",
          reason: drawerPopReason.trim(),
          sessionId: sessId,
          tenantId: currentTenantId
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setDrawerPopError(data.message || data.error || "Failed to trigger cash drawer pop.");
        return;
      }

      alert(`Cash drawer opened! Audit entry logged for "${drawerPopReason.trim()}" by ${currentStaff?.name || "Cashier"}.`);
      setShowDrawerPopModal(false);
      setDrawerPopReason("");
      setDrawerPopError(null);
    } catch (err: any) {
      setDrawerPopError(err.message || "Failed to communicate with server.");
    }
  };

  // Handle Custom Discount Application with Manager PIN
  const handleApplyDiscountSubmit = async () => {
    setDiscountError(null);
    const numVal = parseFloat(customDiscountVal);
    if (isNaN(numVal) || numVal <= 0) {
      setDiscountError("Please enter a valid discount amount.");
      return;
    }

    if (!discountReason.trim()) {
      setDiscountError("Discount reason is mandatory for audit logging.");
      return;
    }

    if (!discountManagerPin || discountManagerPin.length < 4 || discountManagerPin.length > 6) {
      setDiscountError("Please enter a valid 4 to 6-digit Owner/Manager PIN.");
      return;
    }

    try {
      const origTotal = subtotal + tax;
      const sessId = ApiClient.getSessionId() || "";
      const currentTenantId = localStorage.getItem("veggiepos_active_tenant_id") || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessId) headers["x-session-id"] = sessId;
      if (currentTenantId) headers["x-tenant-id"] = currentTenantId;

      const res = await fetch("/api/orders/audit-discount", {
        method: "POST",
        headers: {
          ...headers,
          "Idempotency-Key": ApiClient.generateIdempotencyKey(`disc_${billingOrder?.id || "cart"}`)
        },
        credentials: "include",
        body: JSON.stringify({
          originalAmount: origTotal,
          discountAmount: numVal,
          finalAmount: Math.max(0, origTotal - numVal),
          managerPin: discountManagerPin,
          reason: discountReason.trim(),
          sessionId: sessId,
          tenantId: currentTenantId
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setDiscountError(data.message || data.error || "Discount authorization failed.");
        return;
      }

      setAppliedDiscount(numVal);
      alert(`Discount of INR ${numVal.toFixed(2)} authorized by ${data.authorizer}! Audit entry logged.`);
      setShowDiscountModal(false);
      setCustomDiscountVal("");
      setDiscountReason("");
      setDiscountManagerPin("");
      setDiscountError(null);
    } catch (err: any) {
      setDiscountError(err.message || "Server communication error.");
    }
  };

  // Categories list
  const categories = ["All", "Recommended", "Starters", "Main Course", "Rice & Biryani", "Breads", "Chinese", "Desserts", "Beverages"];

  // Search and filter menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.nameHindi && item.nameHindi.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Recipe calculation - check how many portions can be made with current ingredients
  const getAvailablePortions = (menuItem: MenuItem): number => {
    const recipe = recipes.find((r) => r.menuItemId === menuItem.id);
    if (!recipe || recipe.ingredients.length === 0) return 99; // Unlimited if no recipe mapped

    let maxPortions = 999;
    for (const req of recipe.ingredients) {
      const ing = ingredients.find((i) => i.id === req.ingredientId);
      if (!ing) continue;
      const portions = Math.floor(ing.currentStock / req.quantity);
      if (portions < maxPortions) {
        maxPortions = portions;
      }
    }
    return maxPortions;
  };

  const handleAddToCart = (item: MenuItem) => {
    const available = getAvailablePortions(item);
    const existing = cart.find((c) => c.menuItem.id === item.id);
    const currentQtyInCart = existing ? existing.quantity : 0;

    if (settings.blockOrdersIfInsufficient && currentQtyInCart >= available) {
      alert(`Cannot add more ${item.name}. Insufficient stock of raw ingredients in inventory!`);
      return;
    }

    if (existing) {
      setCart(
        cart.map((c) =>
          c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      setCart([...cart, { menuItem: item, quantity: 1 }]);
    }
    setCheckoutError(null);
  };

  const handleRemoveFromCart = (itemId: string) => {
    const existing = cart.find((c) => c.menuItem.id === itemId);
    if (!existing) return;

    if (existing.quantity === 1) {
      setCart(cart.filter((c) => c.menuItem.id !== itemId));
    } else {
      setCart(
        cart.map((c) =>
          c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
        )
      );
    }
  };

  const handleDeleteItem = (itemId: string) => {
    setCart(cart.filter((c) => c.menuItem.id !== itemId));
  };

  const handleNoteSave = (itemId: string) => {
    setItemNotes({
      ...itemNotes,
      [itemId]: noteText
    });
    setEditingNoteId(null);
    setNoteText("");
  };

  // Pricing calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  }, [cart]);

  const gstRate = (settings.gstPercentage !== undefined ? settings.gstPercentage : 5) / 100;
  const tax = useMemo(() => {
    return Number((subtotal * gstRate).toFixed(2));
  }, [subtotal, gstRate]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const loyaltyDiscount = useMemo(() => {
    if (!selectedCustomer || !redeemPoints) return 0;
    return Math.min(selectedCustomer.loyaltyPoints, Number((subtotal + tax).toFixed(2)));
  }, [selectedCustomer, redeemPoints, subtotal, tax]);

  const total = useMemo(() => {
    return Math.max(0, Number((subtotal + tax - loyaltyDiscount - appliedDiscount).toFixed(2)));
  }, [subtotal, tax, loyaltyDiscount, appliedDiscount]);

  const orderAmount = billingOrder ? billingOrder.total : total;
  const parsedReceived = parseFloat(receivedAmount);
  const actualReceived = isNaN(parsedReceived) ? 0 : parsedReceived;
  const changeDue = Math.max(0, actualReceived - orderAmount);

  // Dynamic UPI QR Code generator based on current settlement amount
  useEffect(() => {
    if (!showPaymentModal || selectedPayment !== "UPI") {
      setUpiQrDataUrl(null);
      return;
    }

    const currentAmount = billingOrder ? billingOrder.total : total;
    const vpa = activeTenant?.vpa || "veggiepos@upi";
    const brandName = encodeURIComponent(activeTenant?.name || "Veggie POS");
    const note = encodeURIComponent(`Order ${billingOrder?.orderNumber || "New"}`);
    const upiUri = `upi://pay?pa=${vpa}&pn=${brandName}&am=${currentAmount.toFixed(2)}&cu=INR&tn=${note}`;

    QRCode.toDataURL(upiUri, {
      width: 260,
      margin: 1,
      color: {
        dark: "#181A18",
        light: "#FFFFFF"
      },
      errorCorrectionLevel: "M"
    })
      .then((url) => setUpiQrDataUrl(url))
      .catch((err) => console.error("Error generating UPI QR Code:", err));
  }, [showPaymentModal, selectedPayment, billingOrder, total, activeTenant]);

  // Table Occupancy Status Helper (Occupied, Dining, Billing, Vacant)
  const getTableOccupancy = (tbl: string) => {
    const tableOrder = orders.find(
      (o) => o.tableNo === tbl && (!o.paidAt || !o.paymentMethod)
    );
    if (!tableOrder) {
      return { status: "Vacant" as const, order: null, badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200", dotBg: "bg-emerald-500" };
    }
    if (tableOrder.status === "Ready" || tableOrder.status === "Completed") {
      return { status: "Billing" as const, order: tableOrder, badgeBg: "bg-purple-50 text-purple-700 border-purple-200", dotBg: "bg-purple-500" };
    }
    if (tableOrder.status === "Preparing") {
      return { status: "Dining" as const, order: tableOrder, badgeBg: "bg-blue-50 text-blue-700 border-blue-200", dotBg: "bg-blue-500" };
    }
    return { status: "In Kitchen" as const, order: tableOrder, badgeBg: "bg-amber-50 text-amber-700 border-amber-200", dotBg: "bg-amber-500" };
  };

  // Submit order to kitchen (KDS)
  const handleSubmitOrderToKitchen = () => {
    if (cart.length === 0) return;
    
    // Validate inventory stock deductions before sending to kitchen
    let insufficientIngredients: { name: string; shortBy: number; unit: string }[] = [];

    // Calculate total ingredient quantities needed for all items in the cart
    const neededIngredients: { [id: string]: number } = {};
    for (const item of cart) {
      const recipe = recipes.find((r) => r.menuItemId === item.menuItem.id);
      if (recipe) {
        for (const req of recipe.ingredients) {
          neededIngredients[req.ingredientId] = (neededIngredients[req.ingredientId] || 0) + req.quantity * item.quantity;
        }
      }
    }

    // Compare with current stock
    for (const [ingId, qtyNeeded] of Object.entries(neededIngredients)) {
      const ing = ingredients.find((i) => i.id === ingId);
      if (ing && ing.currentStock < qtyNeeded) {
        insufficientIngredients.push({
          name: ing.name,
          shortBy: qtyNeeded - ing.currentStock,
          unit: ing.unit
        });
      }
    }

    if (settings.blockOrdersIfInsufficient && insufficientIngredients.length > 0) {
      const errorMsg = "Cannot send to kitchen! The following raw materials are short in inventory:\n" + 
        insufficientIngredients.map(i => `• ${i.name} (Short by ${i.shortBy}${i.unit})`).join("\n");
      setCheckoutError(errorMsg);
      return;
    }

    setCheckoutError(null);

    // 1. Deduct stock if auto-deduct is enabled
    if (settings.autoDeductStock) {
      const updatedIngredients = ingredients.map((ing) => {
        let totalDeduction = 0;
        for (const cartItem of cart) {
          const recipe = recipes.find((r) => r.menuItemId === cartItem.menuItem.id);
          if (recipe) {
            const reqIngredient = recipe.ingredients.find((req) => req.ingredientId === ing.id);
            if (reqIngredient) {
              totalDeduction += reqIngredient.quantity * cartItem.quantity;
            }
          }
        }
        return {
          ...ing,
          currentStock: Math.max(0, ing.currentStock - totalDeduction)
        };
      });
      onUpdateIngredients(updatedIngredients);
    }

    // 2. Format cart items with final notes
    const finalCartItems = cart.map((item) => ({
      ...item,
      note: itemNotes[item.menuItem.id] || undefined
    }));

    // 3. Create the order
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: `${randomNum}`,
      date: new Date().toISOString(),
      type: orderType,
      tableNo: orderType === "Dine-In" ? tableNo : undefined,
      customerName: customerName || undefined,
      items: finalCartItems,
      subtotal,
      tax,
      total,
      status: "Pending",
      cashierId: currentStaff.id,
      cashierName: currentStaff.name
    };

    if (selectedCustomerId) {
      const updatedCustomers = customers.map((c) => {
        if (c.id === selectedCustomerId) {
          const earned = Math.floor(subtotal / 100);
          const used = redeemPoints ? loyaltyDiscount : 0;
          const newPoints = Math.max(0, c.loyaltyPoints + earned - used);
          return {
            ...c,
            loyaltyPoints: newPoints,
            lastVisited: new Date().toISOString().split("T")[0],
            totalVisits: c.totalVisits + 1,
            totalSpend: c.totalSpend + total,
            maxBillAmount: Math.max(c.maxBillAmount, total),
            minBillAmount: c.minBillAmount === 0 ? total : Math.min(c.minBillAmount, total)
          };
        }
        return c;
      });
      setCustomers(updatedCustomers);
    }

    onOrderCreated(newOrder);

    // 4. Reset Cart State
    setCart([]);
    setItemNotes({});
    setCustomerName("");
    setSelectedCustomerId("");
    setRedeemPoints(false);
    setShowCartOnMobile(false);
    // Open KOT ticket print modal for immediate kitchen ticket printing
    setKotModalOrder(newOrder);
  };

  // Settle billing & payment for a kitchen order
  const handleSettleOrderPayment = () => {
    if (!billingOrder) return;

    const paidTimestamp = new Date().toISOString();
    const completedOrder: Order = {
      ...billingOrder,
      status: "Completed",
      paymentMethod: selectedPayment,
      paidAt: paidTimestamp
    };

    // Update existing order status to Completed and record payment details
    onUpdateOrderStatus(
      billingOrder.id,
      "Completed",
      selectedPayment,
      paidTimestamp
    );

    // Prompt immediate thermal receipt printing
    setReceiptModalOrder(completedOrder);
    setBillingOrder(null);
    setShowPaymentModal(false);
    setReceivedAmount("");
  };  return (
    <div className="flex h-full bg-[#f8fafc] text-slate-800 font-sans overflow-hidden relative">
      {/* LEFT PANEL: Menu Catalog or Active Billing Desk */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden pb-24 lg:pb-6">
        
        {/* Navigation Subtabs: Take New Order vs Settle Served Bills */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 mb-5 shrink-0 border border-slate-200/50">
          <button
            onClick={() => setBillingTab("catalog")}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 select-none ${
              billingTab === "catalog"
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/40"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
            id="pos-subtab-catalog"
          >
            <Utensils className="w-4 h-4" />
            <span>1. Order Entry Desk (Take Order)</span>
          </button>
          <button
            onClick={() => setBillingTab("billing")}
            className={`flex-1 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 select-none relative ${
              billingTab === "billing"
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/40"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
            id="pos-subtab-billing"
          >
            <Receipt className="w-4 h-4" />
            <span>2. Active & Served Bills</span>
            {/* Active unpaid orders count */}
            {orders.filter(o => !o.paidAt || !o.paymentMethod).length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full font-mono">
                {orders.filter(o => !o.paidAt || !o.paymentMethod).length}
              </span>
            )}
            {/* Highlight with a pulsing ring if any order is served & ready */}
            {orders.some(o => (o.status === "Ready" || o.status === "Completed") && (!o.paidAt || !o.paymentMethod)) && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            )}
          </button>
        </div>

        {billingTab === "catalog" ? (
          <>
            {/* Header Search & Filter */}
            <div className="flex items-center justify-between gap-4 mb-6 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search dishes (e.g. Paneer, Biryani...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-blue-500 text-sm font-medium text-slate-800 shadow-sm"
                  id="pos-search-input"
                />
              </div>
              
              {/* Active User & Cash Drawer Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFloorMap(!showFloorMap)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm border ${
                    showFloorMap
                      ? "bg-blue-50 text-blue-700 border-blue-300"
                      : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                  title="Live Visual Floor Map & Table Status"
                  id="pos-floor-map-toggle-btn"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Floor Map</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 font-mono text-blue-800">
                    {orderType === "Dine-In" ? tableNo : "Takeaway"}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowDrawerPopModal(true);
                    setDrawerPopReason("");
                    setDrawerPopError(null);
                  }}
                  className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  title="Open Cash Drawer without sale (Logged to Audit Trail)"
                  id="pos-open-drawer-btn"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">No-Sale Cash Drawer Pop</span>
                  <span className="sm:hidden">Pop Drawer</span>
                </button>
                <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-500 shadow-sm">
                  Cashier: <span className="text-blue-600 font-bold">{currentStaff.name}</span>
                </div>
              </div>
            </div>

            {/* Live Interactive Visual Floor Map (Collapsible) */}
            {showFloorMap && (
              <div className="mb-5 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm animate-fade-in shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">Restaurant Floor Map</span>
                    <span className="text-xs text-slate-500 font-mono">Live Table Status</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Vacant</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> In Kitchen</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Dining</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Billing</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
                  {["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07", "T-08"].map((tbl) => {
                    const occ = getTableOccupancy(tbl);
                    const isSelected = orderType === "Dine-In" && tableNo === tbl;
                    return (
                      <button
                        key={tbl}
                        onClick={() => {
                          setTableNo(tbl);
                          setOrderType("Dine-In");
                          if (occ.order) {
                            // If table already has active order, allow easy switch to view bill or add more items
                          }
                        }}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between select-none ${
                          isSelected
                            ? "ring-2 ring-blue-500 border-blue-500 bg-blue-50/20 shadow-sm"
                            : "bg-slate-50/60 hover:bg-slate-100/80 border-slate-200"
                        }`}
                        id={`pos-table-card-${tbl}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold font-mono text-xs text-slate-800">{tbl}</span>
                          <span className={`w-2 h-2 rounded-full ${occ.dotBg}`} />
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border inline-block w-fit ${occ.badgeBg}`}>
                            {occ.status}
                          </span>
                          {occ.order && (
                            <span className="text-[10px] font-mono text-slate-600 mt-1 font-semibold">
                              INR {occ.order.total.toFixed(0)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category horizontal scroll list */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-3 shrink-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition duration-150 ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/15"
                      : "bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 border border-slate-200 shadow-sm"
                  }`}
                  id={`pos-category-btn-${cat}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu Items Grid */}
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
              {filteredMenuItems.map((item) => {
                const available = getAvailablePortions(item);
                const isOutOfStock = available <= 0;
                const isLowStock = available <= 5 && available > 0;
                const qtyInCart = cart.find((c) => c.menuItem.id === item.id)?.quantity || 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => !isOutOfStock && handleAddToCart(item)}
                    className={`group relative bg-white border rounded-xl p-4 flex flex-col justify-between transition-all duration-150 select-none shadow-sm ${
                      isOutOfStock
                        ? "border-slate-100 opacity-60 cursor-not-allowed"
                        : "border-slate-200 hover:border-blue-500/50 hover:bg-slate-50/50 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                    }`}
                    id={`menu-item-card-${item.id}`}
                  >
                    {/* Quantity in cart badge */}
                    {qtyInCart > 0 && (
                      <div className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md shadow-blue-600/20">
                        {qtyInCart}
                      </div>
                    )}

                    <div>
                      {/* Visual food emoji badge or image & vegetarian dot */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-slate-100/80 rounded-xl flex items-center justify-center text-3xl overflow-hidden shrink-0 border border-slate-200/60">
                          {item.imageUrl && (item.imageUrl.startsWith("http://") || item.imageUrl.startsWith("https://") || item.imageUrl.startsWith("/")) ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="filter drop-shadow">{item.imageUrl || "🍲"}</span>
                          )}
                        </div>
                        {/* Vegetarian green box with green dot */}
                        {item.isVegetarian && (
                          <div className="border border-emerald-500/50 p-0.5 rounded bg-emerald-50">
                            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                          </div>
                        )}
                      </div>

                      <h3 className="font-display font-bold text-slate-800 text-sm line-clamp-1 group-hover:text-blue-600 transition">
                        {item.name}
                      </h3>
                      {item.nameHindi && (
                        <p className="text-slate-400 text-xs font-semibold font-sans mt-0.5">
                          {item.nameHindi}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-slate-400 text-[10px] uppercase font-mono">Price</p>
                        <p className="text-sm font-bold text-slate-800">INR {item.price}</p>
                      </div>

                      {/* Stock Level Warning labels */}
                      {isOutOfStock ? (
                        <span className="text-[10px] bg-rose-50 border border-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-mono font-bold">
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-mono font-bold">
                          {available} left
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {available > 50 ? "Available" : `${available} portions`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* BILLING TAB VIEW: Dynamic Kitchen Orders Settlement Center */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-200 pb-3 shrink-0">
              <div>
                <h2 className="font-display font-bold text-slate-800 text-base">Bills & Settlement Register</h2>
                <p className="text-slate-500 text-xs mt-0.5">Collect payments, print official ESC/POS thermal receipts, and view live order slips.</p>
              </div>
              
              {/* Filter Tabs: Unpaid vs Settled vs All */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200/60">
                <button
                  onClick={() => setBillsFilter("unpaid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    billsFilter === "unpaid"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                  id="pos-bills-filter-unpaid"
                >
                  <span>Pending</span>
                  <span className="bg-rose-500 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full">
                    {orders.filter(o => !o.paidAt || !o.paymentMethod).length}
                  </span>
                </button>
                <button
                  onClick={() => setBillsFilter("settled")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    billsFilter === "settled"
                      ? "bg-white text-emerald-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                  id="pos-bills-filter-settled"
                >
                  <span>Settled</span>
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-mono px-1.5 py-0.2 rounded-full">
                    {orders.filter(o => Boolean(o.paidAt && o.paymentMethod)).length}
                  </span>
                </button>
                <button
                  onClick={() => setBillsFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    billsFilter === "all"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                  id="pos-bills-filter-all"
                >
                  <span>All ({orders.length})</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {orders.filter(o => {
                if (billsFilter === "unpaid") return !o.paidAt || !o.paymentMethod;
                if (billsFilter === "settled") return Boolean(o.paidAt && o.paymentMethod);
                return true;
              }).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <span className="text-5xl filter grayscale mb-3">🛎️</span>
                  <h3 className="text-sm font-bold text-slate-700">No orders found in this view</h3>
                  <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-relaxed">
                    {billsFilter === "unpaid"
                      ? "There are no unpaid orders right now. New orders taken by waiters will appear here for checkout once dispatched to KDS."
                      : "No settled orders recorded yet in this session."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {orders
                    .filter(o => {
                      if (billsFilter === "unpaid") return !o.paidAt || !o.paymentMethod;
                      if (billsFilter === "settled") return Boolean(o.paidAt && o.paymentMethod);
                      return true;
                    })
                    .map((order) => {
                      const isPaid = Boolean(order.paidAt && order.paymentMethod);
                      const isReady = order.status === "Ready" || order.status === "Completed";
                      return (
                        <div
                          key={order.id}
                          className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between ${
                            isPaid
                              ? "border-emerald-300 bg-emerald-50/10 shadow-emerald-500/5"
                              : isReady
                              ? "border-emerald-500/35 bg-emerald-50/15 shadow-emerald-500/5 ring-1 ring-emerald-500/10"
                              : "border-slate-200"
                          }`}
                          id={`billing-order-card-${order.id}`}
                        >
                          <div>
                            {/* Card Header metadata */}
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                                  isPaid
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                    : isReady
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                    : "text-slate-500 bg-slate-100 border-slate-200"
                                }`}>
                                  {order.type} {order.tableNo ? `• ${order.tableNo}` : ""}
                                </span>
                                <h4 className="font-bold text-slate-800 text-sm mt-1.5">Order #{order.orderNumber}</h4>
                              </div>
                              <div className="flex flex-col items-end">
                                {isPaid ? (
                                  <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                    <Check className="w-3 h-3" />
                                    <span>Paid ({order.paymentMethod})</span>
                                  </span>
                                ) : isReady ? (
                                  <span className="text-[10px] bg-emerald-500 text-white font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                                    <span>Served / Ready</span>
                                  </span>
                                ) : order.status === "Preparing" ? (
                                  <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">
                                    🍳 Preparing
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                                    📋 Queued
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 font-mono mt-1">
                                  {new Date(order.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            </div>

                            {/* Customer details */}
                            {order.customerName && (
                              <p className="text-[11px] font-semibold text-slate-600 mb-2">
                                Customer: <span className="text-slate-800">{order.customerName}</span>
                              </p>
                            )}

                            {/* Itemized List */}
                            <div className="border-t border-slate-100 pt-3 mt-2 space-y-2">
                              {(order.items || []).map((item, index) => {
                                if (!item) return null;
                                const itemName = item.menuItem?.name || "Unknown Item";
                                const itemPrice = item.menuItem?.price || 0;
                                return (
                                  <div key={index} className="flex justify-between text-xs text-slate-600 font-medium">
                                    <span>
                                      {item.quantity}x {itemName}
                                      {item.note && (
                                        <span className="block text-[10px] text-amber-700 italic">
                                          Note: {item.note}
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-mono text-slate-700">
                                      INR {item.quantity * itemPrice}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Order Totals & Action Controls */}
                          <div className="border-t border-slate-100 pt-4 mt-4">
                            <div className="flex justify-between items-center text-xs mb-3">
                              <span className="text-slate-500 font-semibold">
                                {isPaid ? "Total Paid:" : "Total Amount Due:"}
                              </span>
                              <span className="font-bold font-mono text-slate-800 text-sm">
                                INR {order.total.toFixed(2)}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                              {/* Print KOT Slip Button */}
                              <button
                                onClick={() => setKotModalOrder(order)}
                                className="px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center justify-center gap-1"
                                title="Print Kitchen Order Ticket (KOT Slip)"
                                id={`pos-print-kot-btn-${order.id}`}
                              >
                                <ChefHat className="w-3.5 h-3.5 text-slate-600" />
                                <span>KOT</span>
                              </button>

                              {!isPaid ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setCancelModalOrder(order);
                                      setCancelReason("");
                                      setCancelManagerPin("");
                                      setCancelError(null);
                                    }}
                                    className="px-2.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition flex items-center justify-center gap-1"
                                    title="Cancel / Void Order (Manager PIN Required)"
                                    id={`pos-cancel-btn-${order.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Void</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setBillingOrder(order);
                                      setReceivedAmount(order.total.toFixed(2));
                                      setShowPaymentModal(true);
                                    }}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 select-none ${
                                      isReady
                                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.98]"
                                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-[0.98]"
                                    }`}
                                    id={`pos-settle-btn-${order.id}`}
                                  >
                                    <Coins className="w-3.5 h-3.5" />
                                    <span>{isReady ? "Collect & Settle Bill" : "Pre-Settle"}</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setReceiptModalOrder(order)}
                                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                                  id={`pos-print-receipt-btn-${order.id}`}
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Print Thermal Receipt</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
        {/* Floating Mobile Cart Trigger Bar */}
        {cart.length > 0 && !showCartOnMobile && (
          <div className="lg:hidden fixed bottom-4 left-4 right-4 z-30 bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-xl animate-bounce shadow-blue-600/30">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
              <div>
                <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Order Basket</p>
                <p className="font-bold text-sm font-mono">INR {total.toFixed(2)}</p>
              </div>
            </div>
            <button
              onClick={() => setShowCartOnMobile(true)}
              className="bg-white text-blue-600 font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl active:scale-95 transition shadow-sm"
            >
              View Cart →
            </button>
          </div>
        )}

      {/* Backdrop for mobile cart drawer */}
      {showCartOnMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setShowCartOnMobile(false)}
        />
      )}

      {/* RIGHT PANEL: Shopping Cart & Order Summary */}
      <div className={`
        fixed inset-y-0 right-0 z-50 w-full sm:w-[380px] bg-white border-l border-slate-200 flex flex-col justify-between overflow-hidden shrink-0 shadow-xl transition-transform duration-300
        lg:static lg:translate-x-0
        ${showCartOnMobile ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
      `}>
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCartOnMobile(false)}
              className="lg:hidden p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition mr-1 font-semibold text-xs"
            >
              ← Back
            </button>
            <ShoppingCart className="w-5 h-5 text-blue-500" />
            <h2 className="font-display font-bold text-slate-800 text-sm">Current Cart</h2>
          </div>
          <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-full font-mono text-slate-500 font-bold border border-slate-200/60">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} items
          </span>
        </div>

        {/* Scrollable Container (Items + Forms + Summary) */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-[#f8fafc]/50">
          {/* Cart Item list */}
          <div className="p-4 space-y-3 shrink-0">
            {cart.length === 0 ? (
              <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <span className="text-4xl filter grayscale mb-3">🛒</span>
                <p className="text-sm font-bold text-slate-500">Cart is empty</p>
                <p className="text-xs text-slate-400 mt-1">Select items from catalog to start ordering</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.menuItem.id}
                  className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-1">
                        {item.menuItem.name}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">INR {item.menuItem.price} each</p>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.menuItem.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition"
                      id={`pos-delete-cart-item-${item.menuItem.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Notes and Quantities row */}
                  <div className="flex items-center justify-between mt-3">
                    {/* Note trigger */}
                    <div className="relative">
                      {editingNoteId === item.menuItem.id ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="text"
                            placeholder="Note..."
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            className="bg-white border border-slate-300 rounded text-xs px-2 py-1 w-28 focus:outline-none focus:border-blue-500 text-slate-800"
                          />
                          <button
                            onClick={() => handleNoteSave(item.menuItem.id)}
                            className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 text-xs font-bold"
                            id={`pos-save-note-${item.menuItem.id}`}
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingNoteId(item.menuItem.id);
                            setNoteText(itemNotes[item.menuItem.id] || "");
                          }}
                          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-blue-500 transition font-semibold"
                          id={`pos-add-note-btn-${item.menuItem.id}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[120px]">
                            {itemNotes[item.menuItem.id] ? itemNotes[item.menuItem.id] : "Add Chef Note"}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Quantity adjustment buttons */}
                    <div className="flex items-center space-x-1.5 bg-slate-50 rounded-lg border border-slate-200 p-0.5">
                      <button
                        onClick={() => handleRemoveFromCart(item.menuItem.id)}
                        className="w-6 h-6 bg-white hover:bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 px-1.5 font-mono">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleAddToCart(item.menuItem)}
                        className="w-6 h-6 bg-white hover:bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checkout Forms & Total summaries */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-4">
          {/* Order Type Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setOrderType("Dine-In")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                orderType === "Dine-In"
                  ? "bg-white border-blue-500 text-blue-600 shadow-sm"
                  : "bg-transparent border-slate-200 text-slate-400 hover:text-slate-600"
              }`}
            >
              🍽️ Dine-In
            </button>
            <button
              onClick={() => setOrderType("Takeaway")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                orderType === "Takeaway"
                  ? "bg-white border-blue-500 text-blue-600 shadow-sm"
                  : "bg-transparent border-slate-200 text-slate-400 hover:text-slate-600"
              }`}
            >
              🛍️ Takeaway
            </button>
          </div>

          {/* Loyalty Guest Selection */}
          <div className="space-y-1 bg-slate-100 p-2.5 rounded-xl border border-slate-200/50">
            <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Registered Loyalty Guest (Optional)</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                const cid = e.target.value;
                setSelectedCustomerId(cid);
                if (cid) {
                  const cust = customers.find((c) => c.id === cid);
                  if (cust) {
                    setCustomerName(cust.name);
                  }
                } else {
                  setCustomerName("");
                }
                setRedeemPoints(false);
              }}
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 text-slate-800 shadow-sm font-semibold"
              id="pos-loyalty-customer-select"
            >
              <option value="">-- No Loyalty Profile (Walk-in) --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) - {c.loyaltyPoints} pts
                </option>
              ))}
            </select>

            {selectedCustomer && (
              <div className="mt-2 flex items-center justify-between text-xs bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 rounded-lg">
                <div className="flex items-center gap-1.5 text-amber-800">
                  <Coins className="w-3.5 h-3.5" />
                  <span className="font-bold">{selectedCustomer.loyaltyPoints} pts</span>
                </div>
                <label className="flex items-center gap-1.5 font-bold text-amber-900 cursor-pointer text-[10px] uppercase">
                  <input
                    type="checkbox"
                    checked={redeemPoints}
                    onChange={(e) => setRedeemPoints(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500 w-3 h-3"
                  />
                  <span>Redeem Points</span>
                </label>
              </div>
            )}
          </div>

          {/* Conditional inputs */}
          <div className="space-y-2">
            {orderType === "Dine-In" && (
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs text-slate-500 font-semibold">Table Number:</label>
                <select
                  value={tableNo}
                  onChange={(e) => setTableNo(e.target.value)}
                  className="bg-white border border-slate-200 text-xs font-bold rounded-lg px-3 py-1.5 text-blue-600 focus:outline-none focus:border-blue-500 shadow-sm"
                >
                  {["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07", "T-08"].map((t) => (
                    <option key={t} value={t}>
                      Table {t.split("-")[1]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!selectedCustomerId && (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Customer Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Enter customer name..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 shadow-sm"
                />
              </div>
            )}
          </div>

          {/* Detailed Long Order Summary Card */}
          <div className="bg-slate-100/60 p-3 rounded-xl border border-slate-200/40 text-xs space-y-2">
            <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5" />
              <span>Order Summary Breakdown</span>
            </h4>
            
            <div className="space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-slate-700">INR {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST ({(settings.gstPercentage !== undefined ? settings.gstPercentage : 5)}%):</span>
                <span className="font-mono font-semibold text-slate-700">INR {tax.toFixed(2)}</span>
              </div>
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-amber-600 font-bold">
                  <span>Loyalty Discount:</span>
                  <span className="font-mono">- INR {loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              {appliedDiscount > 0 && (
                <div className="flex justify-between text-purple-600 font-bold">
                  <span>Custom Discount:</span>
                  <span className="font-mono">- INR {appliedDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-800 text-sm">
                <span>Total Bill Value:</span>
                <span className="font-mono text-emerald-600">INR {total.toFixed(2)}</span>
              </div>
              <button
                onClick={() => {
                  setShowDiscountModal(true);
                  setDiscountError(null);
                }}
                className="w-full mt-1.5 py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1"
                id="pos-apply-discount-btn"
              >
                <span>🏷️ Apply Custom Discount (Manager PIN)</span>
              </button>
            </div>

            <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1.5 pt-1 border-t border-dashed border-slate-200">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Despatched to Kitchen terminal as:</span>
              <span className="bg-rose-50 text-rose-600 px-1.5 py-0.2 rounded font-mono font-bold uppercase">Pending</span>
            </div>
          </div>

          {/* Validation errors */}
          {checkoutError && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs flex items-start gap-2 max-h-24 overflow-y-auto">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="whitespace-pre-line leading-relaxed font-sans">{checkoutError}</p>
            </div>
          )}

        </div>
      </div>

      {/* Checkout Footer (Fixed at bottom) */}
      <div className="p-4 border-t border-slate-200 bg-white shrink-0">
        {/* Checkout Submit trigger button */}
        <button
          onClick={handleSubmitOrderToKitchen}
          disabled={cart.length === 0}
          className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md transition duration-150 ${
            cart.length === 0
              ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-[0.98]"
          }`}
          id="pos-submit-to-kitchen-btn"
        >
          <ChefHat className="w-4.5 h-4.5" />
          <span>Submit Order (Send to KDS)</span>
        </button>
      </div>
    </div>

      {/* PAYMENT SELECTION POPUP MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-xl text-slate-800">
            <h3 className="text-lg font-display font-bold text-slate-800 mb-1">Process Payment</h3>
            <p className="text-xs text-slate-500 mb-6 font-medium">Select payment method to complete order settlement.</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => {
                  setSelectedPayment("UPI");
                  setReceivedAmount(orderAmount.toFixed(2));
                }}
                className={`flex flex-col items-center p-4 rounded-xl border transition ${
                  selectedPayment === "UPI"
                    ? "bg-blue-50 border-blue-500 text-blue-600 font-bold shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span className="text-2xl mb-1">📱</span>
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Pay via UPI</span>
              </button>
              <button
                onClick={() => {
                  setSelectedPayment("Cash");
                  setReceivedAmount("");
                }}
                className={`flex flex-col items-center p-4 rounded-xl border transition ${
                  selectedPayment === "Cash"
                    ? "bg-blue-50 border-blue-500 text-blue-600 font-bold shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span className="text-2xl mb-1">💵</span>
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Pay Cash</span>
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs mb-6 space-y-3">
              <div className="flex justify-between text-slate-500 items-center">
                <span>Total Due:</span>
                <span className="font-bold text-slate-800 text-sm font-mono">INR {orderAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 items-center">
                <span>Payment Method:</span>
                <span className="text-blue-600 font-bold font-mono uppercase">{selectedPayment}</span>
              </div>

              {/* DYNAMIC UPI QR CODE DISPLAY */}
              {selectedPayment === "UPI" && (
                <div className="border-t border-slate-200/60 pt-3 flex flex-col items-center text-center space-y-2.5">
                  <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                    {upiQrDataUrl ? (
                      <img
                        src={upiQrDataUrl}
                        alt="Dynamic UPI QR Code"
                        className="w-44 h-44 rounded-xl object-contain"
                      />
                    ) : (
                      <div className="w-44 h-44 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl">
                        <QrCode className="w-8 h-8 animate-pulse mb-1 text-slate-300" />
                        <span className="text-[10px]">Generating UPI QR...</span>
                      </div>
                    )}
                    <span className="text-[10px] font-mono text-slate-500 font-bold mt-1">
                      {activeTenant?.vpa || "veggiepos@upi"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-700">
                      Scan with Any UPI App
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Google Pay, PhonePe, Paytm, BHIM, Cred • Auto-fills ₹{orderAmount.toFixed(2)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const vpa = activeTenant?.vpa || "veggiepos@upi";
                      const brandName = encodeURIComponent(activeTenant?.name || "Veggie POS");
                      const upiUri = `upi://pay?pa=${vpa}&pn=${brandName}&am=${orderAmount.toFixed(2)}&cu=INR&tn=Order${billingOrder?.orderNumber || "Bill"}`;
                      navigator.clipboard?.writeText(upiUri);
                      setUpiCopied(true);
                      setTimeout(() => setUpiCopied(false), 2000);
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 bg-blue-50 hover:bg-blue-100/80 px-2.5 py-1 rounded-lg transition"
                  >
                    {upiCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{upiCopied ? "UPI URI Copied!" : "Copy UPI Link"}</span>
                  </button>
                </div>
              )}

              {/* Amount Received Input (for Cash) */}
              {selectedPayment === "Cash" && (
                <div className="border-t border-slate-200/60 pt-3 space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-500">
                    Cash Tender Received:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">INR</span>
                    <input
                      type="number"
                      step="any"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Quick denomination buttons for cash */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setReceivedAmount(orderAmount.toFixed(2))}
                      className="px-2 py-0.5 bg-white border border-slate-200 hover:border-slate-300 rounded text-[10px] font-semibold text-slate-600 transition"
                    >
                      Exact
                    </button>
                    {[100, 200, 500, 1000, 2000]
                      .filter((val) => val >= orderAmount)
                      .slice(0, 4)
                      .map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setReceivedAmount(val.toString())}
                          className="px-2 py-0.5 bg-white border border-slate-200 hover:border-slate-300 rounded text-[10px] font-semibold text-slate-600 transition"
                        >
                          INR {val}
                        </button>
                      ))}
                  </div>

                  {/* Change due calculation */}
                  <div className="flex justify-between items-center border-t border-slate-200/60 pt-3 text-slate-500">
                    <span className="font-semibold text-slate-600">Change Due:</span>
                    <span className={`font-bold font-mono text-sm ${changeDue > 0 ? "text-emerald-600" : "text-slate-700"}`}>
                      INR {changeDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleSettleOrderPayment}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition duration-150 shadow-md shadow-blue-600/10 flex items-center justify-center gap-1.5"
                id="pos-confirm-payment-btn"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Settle & Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER CANCELLATION MODAL (Problem 1) */}
      {cancelModalOrder && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl text-slate-800 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-display font-bold">Authorize Order Cancellation</h3>
                <p className="text-xs text-slate-500 font-medium">Order #{cancelModalOrder.orderNumber} • Bill Total: INR {cancelModalOrder.total}</p>
              </div>
            </div>

            <div className="space-y-3 bg-rose-50/50 p-4 rounded-xl border border-rose-100 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-rose-900 mb-1">
                  Cancellation Reason (Mandatory)*:
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer walked out / Wrong item entered by staff..."
                  className="w-full p-2.5 bg-white border border-rose-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500 shadow-sm"
                  id="pos-cancel-reason-input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-rose-900 mb-1">
                  Manager / Owner PIN (4-6 Digits)*:
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={cancelManagerPin}
                  onChange={(e) => setCancelManagerPin(e.target.value)}
                  placeholder="PIN Code"
                  className="w-full p-2.5 bg-white border border-rose-200 rounded-lg text-sm font-bold font-mono tracking-widest text-slate-800 focus:outline-none focus:border-rose-500 text-center shadow-sm"
                  id="pos-cancel-pin-input"
                />
              </div>
            </div>

            {cancelError && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                ⚠️ {cancelError}
              </p>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => {
                  setCancelModalOrder(null);
                  setCancelReason("");
                  setCancelManagerPin("");
                  setCancelError(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition"
              >
                Back / Dismiss
              </button>
              <button
                onClick={handleConfirmCancelOrder}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-rose-600/20"
                id="pos-confirm-cancel-btn"
              >
                Confirm Cancellation & Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CASH DRAWER POP MODAL (Problem 3) */}
      {showDrawerPopModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl text-slate-800 space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <Coins className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-display font-bold">Manual Cash Drawer Pop</h3>
                <p className="text-xs text-slate-500 font-medium">Open cash drawer without a sale transaction.</p>
              </div>
            </div>

            <div className="space-y-3 bg-amber-50/50 p-4 rounded-xl border border-amber-100 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  Reason for Opening Cash Drawer*:
                </label>
                <select
                  value={drawerPopReason}
                  onChange={(e) => setDrawerPopReason(e.target.value)}
                  className="w-full p-2.5 bg-white border border-amber-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500 shadow-sm mb-2"
                  id="pos-drawer-reason-select"
                >
                  <option value="">-- Select or type custom reason --</option>
                  <option value="Giving change to customer">Giving change to customer</option>
                  <option value="Petty cash payout for ingredients">Petty cash payout for ingredients</option>
                  <option value="Drawer balance check & inspection">Drawer balance check & inspection</option>
                  <option value="Adding cash float">Adding cash float</option>
                </select>
                <input
                  type="text"
                  value={drawerPopReason}
                  onChange={(e) => setDrawerPopReason(e.target.value)}
                  placeholder="Or enter custom reason..."
                  className="w-full p-2 bg-white border border-amber-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 shadow-sm"
                  id="pos-drawer-reason-input"
                />
              </div>
            </div>

            {drawerPopError && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                ⚠️ {drawerPopError}
              </p>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => {
                  setShowDrawerPopModal(false);
                  setDrawerPopReason("");
                  setDrawerPopError(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCashDrawerPop}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-amber-600/20"
                id="pos-confirm-drawer-pop-btn"
              >
                Pop Drawer & Record Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DISCOUNT MODAL (Problem 2) */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl text-slate-800 space-y-4">
            <div className="flex items-center space-x-3 text-purple-600">
              <span className="text-2xl">🏷️</span>
              <div>
                <h3 className="text-base font-display font-bold">Apply Custom Discount</h3>
                <p className="text-xs text-slate-500 font-medium">Requires Owner/Manager PIN approval.</p>
              </div>
            </div>

            <div className="space-y-3 bg-purple-50/50 p-4 rounded-xl border border-purple-100 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-purple-900 mb-1">
                  Discount Amount (INR)*:
                </label>
                <input
                  type="number"
                  step="any"
                  value={customDiscountVal}
                  onChange={(e) => setCustomDiscountVal(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full p-2.5 bg-white border border-purple-200 rounded-lg text-sm font-bold font-mono text-slate-800 focus:outline-none focus:border-purple-500 shadow-sm"
                  id="pos-discount-amount-input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-purple-900 mb-1">
                  Discount Reason*:
                </label>
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="e.g. VIP Customer / Promotional Discount"
                  className="w-full p-2.5 bg-white border border-purple-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 shadow-sm"
                  id="pos-discount-reason-input"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-purple-900 mb-1">
                  Manager/Owner PIN (4-6 Digits)*:
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={discountManagerPin}
                  onChange={(e) => setDiscountManagerPin(e.target.value)}
                  placeholder="PIN Code"
                  className="w-full p-2.5 bg-white border border-purple-200 rounded-lg text-sm font-bold font-mono tracking-widest text-slate-800 focus:outline-none focus:border-purple-500 text-center shadow-sm"
                  id="pos-discount-pin-input"
                />
              </div>
            </div>

            {discountError && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                ⚠️ {discountError}
              </p>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => {
                  setShowDiscountModal(false);
                  setCustomDiscountVal("");
                  setDiscountReason("");
                  setDiscountManagerPin("");
                  setDiscountError(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyDiscountSubmit}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-purple-600/20"
                id="pos-confirm-discount-btn"
              >
                Authorize & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* THERMAL RECEIPT & TAX INVOICE PRINT MODAL */}
      {receiptModalOrder && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto text-slate-900">
            {/* Modal Header Actions (Excluded from print) */}
            <div className="no-print bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">Thermal Receipt Preview (80mm)</span>
              </div>
              <button
                onClick={() => setReceiptModalOrder(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Thermal Receipt Container */}
            <div className="p-6 overflow-y-auto max-h-[70vh] bg-white">
              <div className="printable-thermal-receipt bg-white text-black p-4 border border-dashed border-slate-300 rounded font-mono text-[11px] leading-relaxed mx-auto">
                <div className="text-center pb-2 border-b border-dashed border-slate-400">
                  <h2 className="text-sm font-black uppercase tracking-wider">
                    {activeTenant?.name || "VEGGIE RESTAURANT & POS"}
                  </h2>
                  <p className="text-[10px] text-slate-600">Pure Vegetarian Hospitality Suite</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">GSTIN: 27AAAAA0000A1Z5</p>
                  <p className="text-[10px] font-bold mt-1 uppercase">*** TAX INVOICE ***</p>
                </div>

                <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span>Invoice #: REC-{receiptModalOrder.orderNumber}</span>
                    <span>{receiptModalOrder.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date: {new Date(receiptModalOrder.date).toLocaleDateString()}</span>
                    <span>Time: {new Date(receiptModalOrder.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {receiptModalOrder.tableNo && (
                    <div className="flex justify-between font-bold">
                      <span>Table: {receiptModalOrder.tableNo}</span>
                      <span>Server: {receiptModalOrder.cashierName || currentStaff.name}</span>
                    </div>
                  )}
                  {receiptModalOrder.customerName && (
                    <div className="flex justify-between text-slate-700">
                      <span>Customer: {receiptModalOrder.customerName}</span>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div className="py-2 border-b border-dashed border-slate-400">
                  <div className="flex justify-between font-bold pb-1 text-[10px] border-b border-slate-200">
                    <span className="w-1/2">ITEM</span>
                    <span className="w-1/6 text-center">QTY</span>
                    <span className="w-1/6 text-right">RATE</span>
                    <span className="w-1/6 text-right">AMT</span>
                  </div>
                  <div className="pt-1.5 space-y-1">
                    {(receiptModalOrder.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[10px]">
                        <span className="w-1/2 truncate">{item.menuItem.name}</span>
                        <span className="w-1/6 text-center">{item.quantity}</span>
                        <span className="w-1/6 text-right font-mono">{item.menuItem.price}</span>
                        <span className="w-1/6 text-right font-mono">{(item.quantity * item.menuItem.price).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bill Calculation Summary */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">INR {receiptModalOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST + SGST (5%)</span>
                    <span className="font-mono">INR {receiptModalOrder.tax.toFixed(2)}</span>
                  </div>
                  {receiptModalOrder.discount && receiptModalOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Loyalty/Discount</span>
                      <span className="font-mono">-INR {receiptModalOrder.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-300">
                    <span>GRAND TOTAL</span>
                    <span className="font-mono text-sm">INR {receiptModalOrder.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Status Info */}
                <div className="py-2 border-b border-dashed border-slate-400 text-center text-[10px] space-y-0.5">
                  <p className="font-bold uppercase tracking-wider text-emerald-800">
                    PAID VIA {receiptModalOrder.paymentMethod || "CASH / UPI"}
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    Settled: {new Date(receiptModalOrder.paidAt || Date.now()).toLocaleTimeString()}
                  </p>
                </div>

                {/* Footer Message */}
                <div className="text-center pt-2 space-y-0.5 text-[9px] text-slate-600">
                  <p className="font-semibold">Thank you for dining with us!</p>
                  <p>Have a wonderful day ahead.</p>
                  <p className="font-mono text-[8px] text-slate-400 mt-1">*** POWERED BY VEGGIEPOS ENTERPRISE ***</p>
                </div>
              </div>
            </div>

            {/* Modal Bottom Buttons */}
            <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button
                onClick={() => setReceiptModalOrder(null)}
                className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Done
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                id="pos-print-receipt-confirm-btn"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KITCHEN ORDER TICKET (KOT) PRINT MODAL */}
      {kotModalOrder && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto text-slate-900">
            {/* Modal Header Actions */}
            <div className="no-print bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-800">Kitchen Slip (KOT)</span>
              </div>
              <button
                onClick={() => setKotModalOrder(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable KOT Slip */}
            <div className="p-6 overflow-y-auto max-h-[70vh] bg-white">
              <div className="printable-thermal-receipt bg-white text-black p-4 border border-dashed border-slate-400 rounded font-mono text-[11px] leading-relaxed mx-auto">
                <div className="text-center pb-2 border-b-2 border-dashed border-black">
                  <h2 className="text-base font-black tracking-wider">
                    *** KITCHEN ORDER TICKET ***
                  </h2>
                  <p className="text-xs font-bold uppercase mt-0.5">
                    {kotModalOrder.type} {kotModalOrder.tableNo ? `• TABLE ${kotModalOrder.tableNo}` : ""}
                  </p>
                </div>

                <div className="py-2 border-b border-dashed border-black space-y-0.5 text-[10px]">
                  <div className="flex justify-between font-bold">
                    <span>KOT #: {kotModalOrder.orderNumber}</span>
                    <span>TIME: {new Date(kotModalOrder.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Server: {kotModalOrder.cashierName || currentStaff.name}</span>
                    <span>Date: {new Date(kotModalOrder.date).toLocaleDateString()}</span>
                  </div>
                  {kotModalOrder.customerName && (
                    <div>
                      <span>Cust: {kotModalOrder.customerName}</span>
                    </div>
                  )}
                </div>

                {/* Items List for Chefs */}
                <div className="py-3 border-b-2 border-dashed border-black space-y-2">
                  {(kotModalOrder.items || []).map((item, idx) => (
                    <div key={idx} className="border-b border-dotted border-slate-300 pb-1.5 last:border-0">
                      <div className="flex justify-between items-baseline font-bold text-xs">
                        <span className="text-sm font-black">{item.quantity}x</span>
                        <span className="flex-1 ml-2 font-black uppercase">{item.menuItem.name}</span>
                      </div>
                      {item.note && (
                        <div className="bg-slate-100 p-1 rounded font-bold text-[10px] text-red-700 mt-0.5">
                          NOTE: {item.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 text-center text-[10px] font-bold">
                  <span>TOTAL ITEMS: {(kotModalOrder.items || []).reduce((s, i) => s + i.quantity, 0)}</span>
                  <p className="text-[9px] text-slate-500 font-normal mt-0.5">Dispatched to Kitchen Display System</p>
                </div>
              </div>
            </div>

            {/* Modal Bottom Buttons */}
            <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button
                onClick={() => setKotModalOrder(null)}
                className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Dismiss
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5"
                id="pos-print-kot-confirm-btn"
              >
                <Printer className="w-4 h-4" />
                <span>Print KOT Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
