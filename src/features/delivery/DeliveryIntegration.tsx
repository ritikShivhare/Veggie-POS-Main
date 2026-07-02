import React, { useState } from "react";
import { MenuItem, Order } from "../shared/types";
import {
  Smartphone,
  ToggleLeft,
  ToggleRight,
  UtensilsCrossed,
  Check,
  X,
  Clock,
  ArrowRight,
  TrendingUp,
  Sliders,
  AlertCircle,
  PlayCircle,
  Sparkles
} from "lucide-react";

interface DeliveryIntegrationProps {
  menuItems: MenuItem[];
  onUpdateMenuItems: (updated: MenuItem[]) => void;
  orders: Order[];
  onOrderCreated: (order: Order) => void;
}

interface SimulatedOnlineOrder {
  id: string;
  channel: "Swiggy" | "Zomato";
  orderNo: string;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  customerMobile: string;
  status: "New" | "Preparing" | "Ready" | "Dispatched" | "Completed" | "Declined";
  createdAt: string;
}

export default function DeliveryIntegration({
  menuItems,
  onUpdateMenuItems,
  orders,
  onOrderCreated
}: DeliveryIntegrationProps) {
  // Swiggy & Zomato general connection switches
  const [swiggyActive, setSwiggyActive] = useState(true);
  const [zomatoActive, setZomatoActive] = useState(true);
  
  // Simulated incoming online orders
  const [onlineOrders, setOnlineOrders] = useState<SimulatedOnlineOrder[]>([
    {
      id: "online-1",
      channel: "Swiggy",
      orderNo: "#150886986",
      items: [
        { name: "Adraki Paneer", quantity: 1, price: 320 },
        { name: "Ajwaini Fish Curry", quantity: 1, price: 625 }
      ],
      totalAmount: 945,
      customerMobile: "98123 45678",
      status: "Preparing",
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() // 15 mins ago
    },
    {
      id: "online-2",
      channel: "Zomato",
      orderNo: "#445897615",
      items: [
        { name: "Veg Pizza Large", quantity: 2, price: 350 },
        { name: "Dal Tadka", quantity: 1, price: 325 }
      ],
      totalAmount: 1025,
      customerMobile: "99001 12233",
      status: "New",
      createdAt: new Date().toISOString()
    }
  ]);

  // Selected order details for side screen view (similar to Slide 8 mockup)
  const [selectedOrderId, setSelectedOrderId] = useState<string>("online-2");

  const activeOrder = onlineOrders.find((o) => o.id === selectedOrderId) || onlineOrders[0];

  // Simulated Order Creator (Interactive Playground for testing without official api)
  const handleSimulateIncomingOrder = (channel: "Swiggy" | "Zomato") => {
    if (channel === "Swiggy" && !swiggyActive) {
      alert("Swiggy channel is disabled! Please activate the Swiggy outlet channel switch first.");
      return;
    }
    if (channel === "Zomato" && !zomatoActive) {
      alert("Zomato channel is disabled! Please activate the Zomato outlet channel switch first.");
      return;
    }

    const randomItems = [...menuItems].sort(() => 0.5 - Math.random()).slice(0, 2);
    if (randomItems.length === 0) {
      alert("No menu items available to simulate an order.");
      return;
    }

    const items = randomItems.map((item) => ({
      name: item.name,
      quantity: Math.floor(Math.random() * 2) + 1,
      price: item.price
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderNo = `#${Math.floor(100000000 + Math.random() * 900000000)}`;

    const newSimOrder: SimulatedOnlineOrder = {
      id: `online-${Date.now()}`,
      channel,
      orderNo,
      items,
      totalAmount,
      customerMobile: `9${Math.floor(10000000 + Math.random() * 90000000)}`,
      status: "New",
      createdAt: new Date().toISOString()
    };

    setOnlineOrders((prev) => [newSimOrder, ...prev]);
    setSelectedOrderId(newSimOrder.id);
  };

  // Toggle Item Availability globally & online (Slide 8 feature)
  const handleToggleItemStatus = (itemId: string) => {
    const updated = menuItems.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          isAvailable: !item.isAvailable
        };
      }
      return item;
    });
    onUpdateMenuItems(updated);
  };

  // Accept Online Order
  const handleAcceptOrder = (id: string) => {
    setOnlineOrders((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          return { ...o, status: "Preparing" };
        }
        return o;
      })
    );
  };

  // Mark Ready & dispatch to main KDS/Billing log
  const handleMarkReady = (id: string) => {
    const onlineOrd = onlineOrders.find((o) => o.id === id);
    if (!onlineOrd) return;

    // Transition online list status
    setOnlineOrders((prev) =>
      prev.map((o) => {
        if (o.id === id) return { ...o, status: "Ready" };
        return o;
      })
    );

    // Push into Posease Main Billing Order History automatically so financials align
    const generatedOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: onlineOrd.orderNo,
      type: "Takeaway",
      tableNo: "Online Delivery",
      date: new Date().toISOString(),
      items: onlineOrd.items.map((item) => {
        const foundMenu = menuItems.find((m) => m.name === item.name) || {
          id: `m-temp-${Date.now()}`,
          name: item.name,
          price: item.price,
          category: "Main Course",
          isVegetarian: true,
          isAvailable: true
        };
        return {
          menuItem: foundMenu,
          quantity: item.quantity
        };
      }),
      subtotal: onlineOrd.totalAmount,
      tax: Number((onlineOrd.totalAmount * 0.05).toFixed(2)),
      total: Number((onlineOrd.totalAmount * 1.05).toFixed(2)),
      status: "Preparing",
      paymentMethod: "UPI",
      paidAt: new Date().toISOString(),
      cashierId: "delivery-bot",
      cashierName: `${onlineOrd.channel} Delivery Bot`
    };

    onOrderCreated(generatedOrder);
  };

  // Complete Order Status
  const handleCompleteOrder = (id: string) => {
    setOnlineOrders((prev) =>
      prev.map((o) => {
        if (o.id === id) return { ...o, status: "Completed" };
        return o;
      })
    );
  };

  return (
    <div className="h-full flex flex-col xl:flex-row overflow-hidden bg-slate-50" id="delivery-tab-root">
      
      {/* LEFT COLUMN: ACTIVE CHANNELS & ON/OFF Stock SWITCHES (Slide 8 Feature) */}
      <div className="w-full xl:w-[450px] border-r border-slate-200 flex flex-col bg-white shrink-0">
        
        {/* Outlet Switches */}
        <div className="p-4 border-b border-slate-100 space-y-3.5 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs font-sans uppercase tracking-wider">
              Channel Manager
            </h3>
            <span className="text-[10px] text-slate-500 font-bold bg-slate-200/60 px-2 py-0.5 rounded">
              Posease Link
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Swiggy Switch */}
            <div className={`p-3 rounded-xl border transition ${swiggyActive ? "bg-orange-50/40 border-orange-200" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-orange-600">SWIGGY</span>
                <button onClick={() => setSwiggyActive(!swiggyActive)}>
                  {swiggyActive ? (
                    <ToggleRight className="w-8 h-8 text-orange-500" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-400" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-1.5">
                Status: <span className={swiggyActive ? "text-emerald-600 font-bold" : "text-rose-500 font-bold"}>{swiggyActive ? "Active" : "Closed"}</span>
              </p>
            </div>

            {/* Zomato Switch */}
            <div className={`p-3 rounded-xl border transition ${zomatoActive ? "bg-rose-50/40 border-rose-200" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-rose-600">ZOMATO</span>
                <button onClick={() => setZomatoActive(!zomatoActive)}>
                  {zomatoActive ? (
                    <ToggleRight className="w-8 h-8 text-rose-500" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-400" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-1.5">
                Status: <span className={zomatoActive ? "text-emerald-600 font-bold" : "text-rose-500 font-bold"}>{zomatoActive ? "Active" : "Closed"}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Live Simulation Testing Tool (Interactivity Playground) */}
        <div className="p-4 border-b border-slate-100 bg-blue-50/30 space-y-2">
          <div className="flex items-center gap-1.5 text-blue-800 text-[10px] uppercase font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Interactive Simulator Console</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Since restaurant aggregator APIs are restricted, use this simulator tool to verify automatic syncing to the POS!
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleSimulateIncomingOrder("Swiggy")}
              className="py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-black tracking-wide uppercase shadow-sm transition"
              id="simulate-swiggy-btn"
            >
              Simulate Swiggy
            </button>
            <button
              onClick={() => handleSimulateIncomingOrder("Zomato")}
              className="py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black tracking-wide uppercase shadow-sm transition"
              id="simulate-zomato-btn"
            >
              Simulate Zomato
            </button>
          </div>
        </div>

        {/* Outlet Item Toggles (Slide 8 Feature) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-slate-500" />
              Toggle Items & Outlet On/Off
            </span>
            <span className="text-[10px] text-slate-400 font-bold">Slide 8 Control</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-4">
            {menuItems.map((item) => {
              const isAvailable = item.isAvailable;
              return (
                <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-700 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">INR {item.price} • {item.category}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isAvailable ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                    }`}>
                      {isAvailable ? "Online" : "Paused"}
                    </span>
                    <button
                      onClick={() => handleToggleItemStatus(item.id)}
                      className="focus:outline-none"
                    >
                      {isAvailable ? (
                        <ToggleRight className="w-8 h-8 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-slate-300" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* CENTER WORKSPACE: ONLINE ORDERS INCOMING TERMINAL LIST */}
      <div className="flex-1 border-r border-slate-200 flex flex-col bg-slate-50 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Incoming Delivery Queue</h2>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Real-time orders parsing from Swiggy & Zomato</p>
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-700 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
              {onlineOrders.filter((o) => o.status === "New").length} New Order Alerts
            </span>
          </div>
        </div>

        {/* ORDER QUEUE LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {onlineOrders.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-12">
              <Smartphone className="w-12 h-12 text-slate-300 mb-2" />
              <p>No delivery orders found. Click "Simulate" to trigger live alerts!</p>
            </div>
          ) : (
            onlineOrders.map((o) => {
              const isSelected = selectedOrderId === o.id;
              const isSwiggy = o.channel === "Swiggy";
              
              // Status Badge Styles
              let statusClass = "bg-slate-100 text-slate-700";
              if (o.status === "New") statusClass = "bg-amber-100 text-amber-800 border border-amber-200 font-black animate-pulse";
              if (o.status === "Preparing") statusClass = "bg-blue-100 text-blue-800 border border-blue-200";
              if (o.status === "Ready") statusClass = "bg-emerald-100 text-emerald-800 border border-emerald-200";
              if (o.status === "Completed") statusClass = "bg-slate-200 text-slate-500";

              return (
                <div
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected ? "bg-white border-blue-500 shadow-md ring-2 ring-blue-500/10" : "bg-white hover:bg-slate-100/50 border-slate-200 shadow-sm"
                  }`}
                  id={`online-order-${o.id}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Brand indicator */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xs text-white shrink-0 ${
                      isSwiggy ? "bg-orange-500" : "bg-rose-600"
                    }`}>
                      {o.channel.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-800 text-sm">{o.orderNo}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusClass}`}>
                          {o.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold mt-1">
                        {o.items.length} items • Total: <span className="font-mono text-slate-700 font-bold">INR {o.totalAmount}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Mobile: {o.customerMobile}</p>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 border-t border-slate-100 md:border-0 pt-3 md:pt-0">
                    {o.status === "New" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptOrder(o.id);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-lg shadow-sm transition uppercase"
                      >
                        Accept
                      </button>
                    )}
                    {o.status === "Preparing" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkReady(o.id);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] rounded-lg shadow-sm transition uppercase"
                      >
                        Ready & Print KOT
                      </button>
                    )}
                    {o.status === "Ready" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompleteOrder(o.id);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-[10px] rounded-lg shadow-sm transition uppercase"
                      >
                        Dispatch Complete
                      </button>
                    )}
                    <span className="text-xs text-slate-400 font-semibold font-mono">
                      {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: ORDER TERMINAL MOCKUP (Slide 8 Premium Swiggy/Zomato Widget style) */}
      <div className="w-full xl:w-[400px] bg-white border-l border-slate-200 p-5 flex flex-col shrink-0 overflow-y-auto">
        {activeOrder ? (
          <div className="space-y-5">
            {/* Header info card */}
            <div className={`p-4 rounded-2xl text-white shadow ${
              activeOrder.channel === "Swiggy" ? "bg-gradient-to-br from-orange-500 to-amber-500" : "bg-gradient-to-br from-rose-600 to-pink-600"
            }`}>
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-white/80">
                <span>{activeOrder.channel} Online Feed</span>
                <span>Active</span>
              </div>
              <h3 className="text-lg font-black mt-1">{activeOrder.orderNo}</h3>
              <p className="text-[10px] font-mono text-white/90 mt-0.5">Ingested via API Webhooks</p>
            </div>

            {/* Customer metadata block */}
            <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Delivery Service:</span>
                <span className="font-bold text-slate-700">{activeOrder.channel} Fleet</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Customer Contact:</span>
                <span className="font-bold text-slate-700 font-mono">{activeOrder.customerMobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Payment Status:</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px]">Prepaid Online</span>
              </div>
            </div>

            {/* Ordered items breakdown list */}
            <div>
              <h4 className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest mb-3">Order Items Ledger</h4>
              <div className="space-y-3 divide-y divide-slate-100">
                {activeOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs pt-3 first:pt-0">
                    <div>
                      <p className="font-extrabold text-slate-700">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Quantity: {item.quantity} • Unit Price: INR {item.price}</p>
                    </div>
                    <span className="font-bold text-slate-800 font-mono">INR {item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total summary */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono">INR {activeOrder.totalAmount}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>GST (5% Included):</span>
                <span className="font-mono">INR {(activeOrder.totalAmount * 0.05).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-800">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-600">INR {(activeOrder.totalAmount * 1.05).toFixed(2)}</span>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-3">
              <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Live Status Flow</h5>
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${activeOrder.status === "New" ? "bg-amber-500 animate-ping" : "bg-slate-300"}`} />
                <span className={activeOrder.status === "New" ? "font-bold text-slate-800" : "text-slate-400"}>Accepted</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                <span className={`w-2.5 h-2.5 rounded-full ${activeOrder.status === "Preparing" ? "bg-blue-500" : "bg-slate-300"}`} />
                <span className={activeOrder.status === "Preparing" ? "font-bold text-slate-800" : "text-slate-400"}>Preparing</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                <span className={`w-2.5 h-2.5 rounded-full ${activeOrder.status === "Ready" || activeOrder.status === "Completed" ? "bg-emerald-500" : "bg-slate-300"}`} />
                <span className={activeOrder.status === "Ready" ? "font-bold text-slate-800" : "text-slate-400"}>Ready</span>
              </div>
            </div>

          </div>
        ) : (
          <div className="text-center text-slate-400 text-xs py-12">
            Select an incoming order to view details.
          </div>
        )}
      </div>

    </div>
  );
}
