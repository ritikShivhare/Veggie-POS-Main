import React, { useState, useMemo } from "react";
import { MenuItem, Ingredient, Recipe, CartItem, Order, StaffMember, InventorySettings, OrderStatus, Customer } from "../shared/types";
import { Search, ShoppingCart, Plus, Minus, Trash2, CheckCircle, AlertTriangle, MessageSquare, ChefHat, Receipt, CreditCard, Clock, Utensils, ChevronRight, Coins, Flame } from "lucide-react";

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
  setCustomers
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

  const tax = useMemo(() => {
    return Number((subtotal * 0.05).toFixed(2)); // 5% GST
  }, [subtotal]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const loyaltyDiscount = useMemo(() => {
    if (!selectedCustomer || !redeemPoints) return 0;
    return Math.min(selectedCustomer.loyaltyPoints, Number((subtotal + tax).toFixed(2)));
  }, [selectedCustomer, redeemPoints, subtotal, tax]);

  const total = useMemo(() => {
    return Number((subtotal + tax - loyaltyDiscount).toFixed(2));
  }, [subtotal, tax, loyaltyDiscount]);

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
    alert(`Order #${randomNum} placed successfully and dispatched to Kitchen Display System (KDS)!`);
  };

  // Settle billing & payment for a kitchen order
  const handleSettleOrderPayment = () => {
    if (!billingOrder) return;

    // Update existing order status to Completed and record payment details
    onUpdateOrderStatus(
      billingOrder.id,
      "Completed",
      selectedPayment,
      new Date().toISOString()
    );

    alert(`Order #${billingOrder.orderNumber} successfully paid & settled via ${selectedPayment}!`);
    setBillingOrder(null);
    setShowPaymentModal(false);
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
              
              {/* Active User Indicator */}
              <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-500 shadow-sm">
                Cashier: <span className="text-blue-600 font-bold">{currentStaff.name}</span>
              </div>
            </div>

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
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3 shrink-0">
              <div>
                <h2 className="font-display font-bold text-slate-800 text-base">Active Orders Settlement</h2>
                <p className="text-slate-500 text-xs mt-0.5">Select ready/served orders from kitchen to collect payments and settle bills.</p>
              </div>
              <span className="bg-slate-100 px-3 py-1 rounded-full font-mono text-xs text-slate-600 font-bold border border-slate-200/60">
                {orders.filter(o => !o.paidAt || !o.paymentMethod).length} Pending Bills
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {orders.filter(o => !o.paidAt || !o.paymentMethod).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <span className="text-5xl filter grayscale mb-3">🛎️</span>
                  <h3 className="text-sm font-bold text-slate-700">All Bills Settled!</h3>
                  <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-relaxed">
                    There are no unpaid orders right now. New orders taken by waiters will appear here for checkout once they are sent to the KDS.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {orders
                    .filter(o => !o.paidAt || !o.paymentMethod)
                    .map((order) => {
                      // Color schemes based on order status (Pending/Preparing vs Ready/Served)
                      const isReady = order.status === "Ready" || order.status === "Completed";
                      return (
                        <div
                          key={order.id}
                          className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between ${
                            isReady
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
                                  isReady
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                    : "text-slate-500 bg-slate-100 border-slate-200"
                                }`}>
                                  {order.type} {order.tableNo ? `• ${order.tableNo}` : ""}
                                </span>
                                <h4 className="font-bold text-slate-800 text-sm mt-1.5">Order #{order.orderNumber}</h4>
                              </div>
                              <div className="flex flex-col items-end">
                                {isReady ? (
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
                              {order.items.map((item, index) => (
                                <div key={index} className="flex justify-between text-xs text-slate-600 font-medium">
                                  <span>
                                    {item.quantity}x {item.menuItem.name}
                                  </span>
                                  <span className="font-mono text-slate-700">
                                    INR {item.quantity * item.menuItem.price}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Order Totals & Settle Action */}
                          <div className="border-t border-slate-100 pt-4 mt-4">
                            <div className="flex justify-between items-center text-xs mb-3">
                              <span className="text-slate-500 font-semibold">Total Amount Due:</span>
                              <span className="font-bold font-mono text-slate-800 text-sm">
                                INR {order.total.toFixed(2)}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setBillingOrder(order);
                                setShowPaymentModal(true);
                              }}
                              className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 select-none ${
                                isReady
                                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.98]"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-[0.98]"
                              }`}
                              id={`pos-settle-btn-${order.id}`}
                            >
                              <Coins className="w-3.5 h-3.5" />
                              <span>{isReady ? "Collect & Settle Bill" : "Pre-Settle Payment"}</span>
                            </button>
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

        {/* Cart Item list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafc]/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
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
        <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0 space-y-4">
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
                <span>GST (5%):</span>
                <span className="font-mono font-semibold text-slate-700">INR {tax.toFixed(2)}</span>
              </div>
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-amber-600 font-bold">
                  <span>Loyalty Discount:</span>
                  <span className="font-mono">- INR {loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-800 text-sm">
                <span>Total Bill Value:</span>
                <span className="font-mono text-emerald-600">INR {total.toFixed(2)}</span>
              </div>
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
                onClick={() => setSelectedPayment("UPI")}
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
                onClick={() => setSelectedPayment("Cash")}
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

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs mb-6 space-y-2">
              <div className="flex justify-between text-slate-500">
                <span>Total Due:</span>
                <span className="font-bold text-slate-800">INR {total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Payment Method:</span>
                <span className="text-blue-600 font-bold font-mono uppercase">{selectedPayment}</span>
              </div>
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
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition duration-150 shadow-md shadow-blue-600/10"
                id="pos-confirm-payment-btn"
              >
                Settle & Complete Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
