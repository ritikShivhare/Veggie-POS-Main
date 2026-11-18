import { ApiClient } from "../shared/services/api";
import { offlineRepository,OutboxProcessor } from "../shared/services/offline";
import React, { useState, useEffect } from "react";
import { Customer, Order } from "../shared/types";
import { useAppContext } from "../shared/context/AppContext";
import { displayOrderNumber } from "../../../shared/orderNumber";
import {
  Search,
  Plus,
  User,
  Phone,
  Mail,
  Calendar,
  Gift,
  Coins,
  History,
  TrendingUp,
  Percent,
  Check,
  X,
  FileSpreadsheet
} from "lucide-react";

interface CRMLoyaltyProps {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

export default function CRMLoyalty({ customers, setCustomers }: CRMLoyaltyProps) {
  const { currentStaff, activeTenant } = useAppContext();
  const canAdjustPoints = ["Owner", "Manager"].includes(currentStaff?.role || "");
  const [savingGuest, setSavingGuest] = useState(false);
  const [guestMessage, setGuestMessage] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAddGuestModal, setShowAddGuestModal] = useState<boolean>(false);

  // New guest form state
  const [newGuest, setNewGuest] = useState({
    name: "",
    phone: "",
    email: "",
    dob: "",
    anniversary: "",
    gstin: "",
    loyaltyPoints: 0
  });

  // Manual points adjustment state
  const [pointsAdjustment, setPointsAdjustment] = useState<string>("");
  const [adjustmentType, setAdjustmentType] = useState<"add" | "deduct">("add");

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  useEffect(() => {
    const synced = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.tenantId === activeTenant.tenantId && detail.entityType === 'customer') {
        setGuestMessage('Guest synced to cloud.');
      }
    };
    const needsAttention = (event: Event) => {
      const item = (event as CustomEvent).detail?.item;
      if (item?.tenantId === activeTenant.tenantId && item.entityType === 'customer') {
        setGuestMessage('Guest is saved on this device. Cloud sync needs attention; check the sync status.');
      }
    };
    window.addEventListener('veggiepos_realtime_event', synced);
    const failures = ['veggiepos_reconcile_conflict', 'veggiepos_validation_failed', 'veggiepos_forbidden_error'];
    failures.forEach(event => window.addEventListener(event, needsAttention));
    return () => {
      window.removeEventListener('veggiepos_realtime_event', synced);
      failures.forEach(event => window.removeEventListener(event, needsAttention));
    };
  }, [activeTenant.tenantId]);

  useEffect(() => {
    if (!historyOpen || !selectedCustomer) return;
    let active = true;
    setHistoryLoading(true); setHistoryError(""); setHistory([]);
    ApiClient.authenticatedFetch(`/api/customers/${encodeURIComponent(selectedCustomer.id)}/history`)
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data)) throw new Error("Guest history could not be loaded. Please retry.");
        if (active) setHistory(result.data);
      }).catch(error => { if (active) setHistoryError(error.message); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [historyOpen, selectedCustomer?.id, activeTenant.tenantId]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  const handleAddGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingGuest) return;
    if (!newGuest.name || !newGuest.phone) {
      alert("Name and Phone Number are required!");
      return;
    }

    const createdGuest: Customer = {
      id: `c-${Date.now()}`,
      name: newGuest.name,
      phone: newGuest.phone,
      email: newGuest.email || undefined,
      dob: newGuest.dob || undefined,
      anniversary: newGuest.anniversary || undefined,
      gstin: newGuest.gstin || undefined,
      loyaltyPoints: 0,
      comingSince: new Date().toISOString().split("T")[0],
      lastVisited: "",
      totalVisits: 0,
      totalSpend: 0,
      maxBillAmount: 0,
      minBillAmount: 0
    };

    setSavingGuest(true);
    try {
      await offlineRepository.recordCustomerOffline(activeTenant.tenantId, createdGuest);
    } catch(error:any) {
      setGuestMessage(`Guest was not saved: ${error.message}`);
      setSavingGuest(false); return;
    }
    setCustomers(previous => [...previous.filter(customer => customer.id !== createdGuest.id), createdGuest]);
    setGuestMessage("Guest saved on this device. Cloud sync is pending; you can continue working.");
    void OutboxProcessor.triggerDrain(activeTenant.tenantId).catch(() => {
      setGuestMessage("Guest is saved on this device. Cloud sync needs attention; check the sync status.");
    });
    setSelectedCustomerId(createdGuest.id);
    setShowAddGuestModal(false);
    setSavingGuest(false);
    setNewGuest({
      name: "",
      phone: "",
      email: "",
      dob: "",
      anniversary: "",
      gstin: "",
      loyaltyPoints: 0
    });
  };

  const handlePointsAdjustmentSubmit=async()=>{
    if (!canAdjustPoints) return;
    const amount=Number(pointsAdjustment);if(!Number.isInteger(amount) || amount<=0 || !selectedCustomer) return;
    const reason=window.prompt("Reason for points adjustment:");if(!reason?.trim()) return;
    try {
      const response=await ApiClient.authenticatedFetch(`/api/customers/${encodeURIComponent(selectedCustomer.id)}/points`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":ApiClient.generateIdempotencyKey("points")},body:JSON.stringify({delta:adjustmentType==="add"?amount:-amount,reason,version:selectedCustomer.version})});const data=await response.json();
      if(!response.ok || !data.success) throw new Error(data.message || data.error || "Adjustment failed.");setCustomers(previous=>previous.map(c=>c.id===data.data.id?data.data:c));setPointsAdjustment("");
    }catch(error:any){alert(error.message);}
  };

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden bg-slate-50" id="crm-loyalty-tab-view">

      {/* LEFT COLUMN: GUEST LIST */}
      <div className="w-full lg:w-96 border-r border-slate-200 flex flex-col bg-white shrink-0">
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm font-sans uppercase tracking-wider">
              Guest Database
            </h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {customers.length} Guests
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              id="crm-search-input"
            />
          </div>

          <button
            onClick={() => setShowAddGuestModal(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-sm"
            id="crm-add-guest-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Guest</span>
          </button>
        </div>

        {/* CUSTOMER DIRECTORY LIST */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No guests found matching search query.
            </div>
          ) : (
            filteredCustomers.map((c) => {
              const isSelected = selectedCustomer?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCustomerId(c.id)}
                  className={`w-full text-left p-4 transition flex items-center justify-between ${
                    isSelected ? "bg-blue-50/50 border-l-4 border-blue-600" : "hover:bg-slate-50"
                  }`}
                  id={`crm-guest-card-${c.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-xs truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{c.phone}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 border border-yellow-100 px-2 py-1 rounded-lg text-[10px] font-bold">
                    <Coins className="w-3 h-3" />
                    <span>{c.loyaltyPoints} pts</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: DETAILED VIEW (Posease Slide 5 Premium Interface) */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-slate-50">
        {guestMessage && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">{guestMessage}</p>}
        {selectedCustomer ? (
          <div className="max-w-4xl w-full mx-auto space-y-6">

            {/* TOP HEADER: GUEST BRAND BANNER */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-display font-extrabold text-xl shadow-inner shrink-0">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{selectedCustomer.name}</h2>
                  <p className="text-xs text-slate-500 font-medium">Unique Customer Ledger ID: <span className="font-mono text-slate-600 font-bold">{selectedCustomer.id}</span></p>
                </div>
              </div>

              {/* LOYALTY CARD HIGHLIGHT */}
              <div className="bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-950 p-4 rounded-xl shadow-md min-w-[180px] text-right flex flex-col justify-between">
                <div className="flex items-center justify-between text-[9px] uppercase tracking-wider font-extrabold text-amber-900/80">
                  <span>Loyalty Account</span>
                  <Coins className="w-3.5 h-3.5 text-amber-900" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black">{selectedCustomer.loyaltyPoints}</span>
                  <span className="text-xs font-bold ml-1">Points</span>
                </div>
                <div className="text-[9px] font-medium text-amber-900 font-sans mt-1">
                  1 Point = 1.00 INR on Billing
                </div>
              </div>
            </div>

            {/* BENTO GRID SECTIONS: GUEST PROFILE & METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* SECTION A: GUEST INFORMATION */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5 text-blue-600">
                  <User className="w-4 h-4" />
                  <span>Guest Information</span>
                </h3>

                <div className="grid grid-cols-1 gap-3.5 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Guest Mobile Number</p>
                      <p className="font-bold text-slate-700 font-mono">{selectedCustomer.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium">Email Address</p>
                      <p className="font-bold text-slate-700">{selectedCustomer.email || "No Email Registered"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium">Date of Birth</p>
                        <p className="font-bold text-slate-700">{selectedCustomer.dob ? formatDate(selectedCustomer.dob) : "N/A"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <Gift className="w-4 h-4 text-rose-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium">Anniversary Date</p>
                        <p className="font-bold text-slate-700">{selectedCustomer.anniversary ? formatDate(selectedCustomer.anniversary) : "N/A"}</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION B: LOYALTY REWARDS ADJUSTMENT PANEL */}
              {canAdjustPoints && <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5 text-amber-600">
                    <Coins className="w-4 h-4" />
                    <span>Loyalty Ledger Actions</span>
                  </h3>

                  <div className="mt-4 space-y-3.5 text-xs text-slate-600">
                    <p className="leading-relaxed text-[11px]">
                      Guests automatically earn points on every terminal transaction (1 point per 100 INR). You can also manually credit or debit points here.
                    </p>

                    <div className="bg-slate-50 p-3.5 border border-slate-100 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">Manual Points Adjustment</span>
                        <div className="flex bg-slate-200 p-0.5 rounded-lg text-[10px] font-bold">
                          <button
                            onClick={() => setAdjustmentType("add")}
                            className={`px-2.5 py-1 rounded-md transition ${
                              adjustmentType === "add" ? "bg-emerald-500 text-white" : "text-slate-600"
                            }`}
                          >
                            Credit (+)
                          </button>
                          <button
                            onClick={() => setAdjustmentType("deduct")}
                            className={`px-2.5 py-1 rounded-md transition ${
                              adjustmentType === "deduct" ? "bg-rose-500 text-white" : "text-slate-600"
                            }`}
                          >
                            Debit (-)
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Amount of points"
                          value={pointsAdjustment}
                          onChange={(e) => setPointsAdjustment(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                          id="crm-points-adjustment-input"
                        />
                        <button
                          onClick={handlePointsAdjustmentSubmit}
                          className={`px-4 font-bold rounded-lg text-xs text-white transition ${
                            adjustmentType === "add" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600"
                          }`}
                          id="crm-points-adjust-submit"
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100/60 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  <span>Loyalty Rank</span>
                  <span className={selectedCustomer.loyaltyPoints > 200 ? "text-amber-500" : "text-slate-500"}>
                    {selectedCustomer.loyaltyPoints > 200 ? "👑 Elite Gold Guest" : "🌿 Silver Club Member"}
                  </span>
                </div>
              </div>}
            </div>

            {/* SECTION C: GUEST TRANSACTION HISTORY (MATCHING SLIDE 5 SPECIFICATION) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5 text-blue-600">
                <History className="w-4 h-4" />
                <span>Guest History Ledger</span>
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Coming Since */}
                <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-bold text-amber-700/80 uppercase tracking-wider">Coming Since</p>
                  <p className="text-xs font-black text-slate-800 mt-1">{formatDate(selectedCustomer.comingSince)}</p>
                </div>

                {/* 2. Last Visited */}
                <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-bold text-blue-700/80 uppercase tracking-wider">Last Visited</p>
                  <p className="text-xs font-black text-slate-800 mt-1">{formatDate(selectedCustomer.lastVisited)}</p>
                </div>

                {/* 3. Total Visits */}
                <button type="button" id="crm-total-visits" onClick={() => setHistoryOpen(true)} className="bg-emerald-50/50 hover:bg-emerald-100 border border-emerald-100 p-3 rounded-xl text-center cursor-pointer" aria-label="View guest visit history">
                  <p className="text-[9px] font-bold text-emerald-700/80 uppercase tracking-wider">Total Visits</p>
                  <p className="text-base font-black text-slate-800 mt-0.5">{selectedCustomer.totalVisits} visits</p>
                </button>

                {/* 4. Total Spend */}
                <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-bold text-rose-700/80 uppercase tracking-wider">Total Spend</p>
                  <p className="text-xs font-black text-slate-800 mt-1">INR {selectedCustomer.totalSpend.toLocaleString()}</p>
                </div>

                {/* 5. Max Bill Amount */}
                <div className="bg-purple-50/50 border border-purple-100 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-bold text-purple-700/80 uppercase tracking-wider">Max Bill Amt</p>
                  <p className="text-xs font-black text-slate-800 mt-1">INR {selectedCustomer.maxBillAmount.toLocaleString()}</p>
                </div>

                {/* 6. Min Bill Amount */}
                <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Min Bill Amt</p>
                  <p className="text-xs font-black text-slate-800 mt-1 font-sans">INR {selectedCustomer.minBillAmount.toLocaleString()}</p>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
            No customer selected. Register a new guest to populate the database.
          </div>
        )}
      </div>

      {/* ADD GUEST FORM MODAL */}
      {showAddGuestModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-sm font-sans uppercase tracking-wider">
                Register New Guest
              </h3>
              <button
                onClick={() => setShowAddGuestModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddGuestSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Guest Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Ramesh Kumar"
                  value={newGuest.name}
                  onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  id="crm-modal-name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g., 9876543210"
                  value={newGuest.phone}
                  onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  id="crm-modal-phone"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g., guest@gmail.com"
                  value={newGuest.email}
                  onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  id="crm-modal-email"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Date of Birth</label>
                  <input
                    type="date"
                    value={newGuest.dob}
                    onChange={(e) => setNewGuest({ ...newGuest, dob: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                    id="crm-modal-dob"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Anniversary</label>
                  <input
                    type="date"
                    value={newGuest.anniversary}
                    onChange={(e) => setNewGuest({ ...newGuest, anniversary: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                    id="crm-modal-anniversary"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddGuestModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGuest}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow"
                  id="crm-submit-new-guest"
                >
                  {savingGuest ? "Saving…" : "Save Guest"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyOpen && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="guest-history-title" className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          <header className="p-4 border-b flex items-center justify-between gap-3">
            <h2 id="guest-history-title" className="font-bold text-slate-900">Guest History · {selectedCustomer?.name}</h2>
            <button type="button" onClick={() => setHistoryOpen(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold">Done</button>
          </header>
          <div className="p-4 overflow-y-auto space-y-3">
            {historyLoading ? <p role="status">Loading visits…</p> : historyError ? <div role="alert"><p>{historyError}</p><button type="button" onClick={() => { setHistoryOpen(false); }} className="underline">Close and retry</button></div> : history.length === 0 ? <p className="text-sm text-slate-500">No paid visits recorded for this guest.</p> : history.map(order => <article key={order.id} className="rounded-xl border border-slate-200 p-4 space-y-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2 font-semibold"><span>Bill #{displayOrderNumber(order.orderNumber)}</span><time>{new Date(order.paidAt || order.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</time></div>
              <ul className="divide-y divide-slate-100">{order.items.map((item, index) => <li key={index} className="py-2"><div className="flex justify-between gap-3"><span>{item.quantity} × {item.menuItem?.name || "Menu item"}</span><span>₹{((item.menuItem?.price || 0) * item.quantity).toFixed(2)}</span></div>{(item.note || item.notes) && <p className="text-xs text-slate-500">{item.note || item.notes}</p>}</li>)}</ul>
              <div className="flex flex-wrap justify-between gap-3 text-xs text-slate-600"><span>Subtotal ₹{order.subtotal.toFixed(2)}</span><span>Tax ₹{order.tax.toFixed(2)}</span><span>Discount ₹{(order.discount || 0).toFixed(2)}</span></div>
              <p className="font-bold">Total ₹{order.total.toFixed(2)} · {order.paymentMethod}</p>
              <p className="text-xs text-slate-600">Points earned: {order.earnedPoints ?? "Not recorded"} · Points used: {order.redeemedPoints ?? "Not recorded"}</p>
            </article>)}
          </div>
        </section>
      </div>}
    </div>
  );
}
