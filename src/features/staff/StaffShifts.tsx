import React, { useState } from "react";
import { Shift, StaffMember, StaffRole, RestaurantTenant } from "../shared/types";
import { Clock, Play, LogOut, CheckCircle2, UserCheck, Eye, UserPlus, AlertCircle, ShieldAlert, Trash2, UserMinus, Zap, QrCode, Smartphone, Share2 } from "lucide-react";
import { ApiClient } from "../shared/services/api";
import StaffQrModal from "./components/StaffQrModal";

interface StaffShiftsProps {
  shifts: Shift[];
  activeShift: Shift | null;
  onShiftAction: () => void;
  currentStaff: StaffMember;
  staffList: StaffMember[];
  onUpdateStaffList: (staff: StaffMember[]) => void;
  activeTenant?: RestaurantTenant;
  setActiveTab?: (tab: string) => void;
}

export default function StaffShifts({
  shifts,
  activeShift,
  onShiftAction,
  currentStaff,
  staffList,
  onUpdateStaffList,
  activeTenant,
  setActiveTab
}: StaffShiftsProps) {
  const isManagerOrOwner = currentStaff.role === "Owner" || currentStaff.role === "Manager";
  const planName = activeTenant?.plan || "free";
  const planCapacity = planName === "pro" ? 10 : planName === "enterprise" ? 100000 : 3;
  const hasReachedLimit = staffList.length >= planCapacity;
  const [activeSubTab, setActiveSubTab] = useState<"duty" | "logs">("duty");
  const [localDeleteId, setLocalDeleteId] = useState<string | null>(null);
  const [showStaffQrModal, setShowStaffQrModal] = useState<boolean>(false);

  // Blind Shift Close Modal State (Problem 6)
  const [showBlindModal, setShowBlindModal] = useState(false);
  const [physicalCashVal, setPhysicalCashVal] = useState("");
  const [blindStep, setBlindStep] = useState<"count" | "override">("count");
  const [varianceInfo, setVarianceInfo] = useState<{ expected: number; physical: number; variance: number } | null>(null);
  const [overridePin, setOverridePin] = useState("");
  const [blindError, setBlindError] = useState<string | null>(null);

  // Filter shift records: standard staff only see their own records, managers see all
  const displayedShifts = shifts.filter((s) => isManagerOrOwner || s.staffId === currentStaff.id);
  const isCashierRole = currentStaff.role.toLowerCase() === "cashier";

  // Blind shift submit handler
  const handleBlindCloseSubmit = async () => {
    if (!activeShift) return;
    setBlindError(null);

    const countNum = parseFloat(physicalCashVal);
    if (isNaN(countNum) || countNum < 0) {
      setBlindError("Please enter a valid non-negative physical cash count.");
      return;
    }

    try {
      const payload: any = { physicalCashCount: countNum };
      if (blindStep === "override") {
        if (!overridePin || overridePin.length < 4 || overridePin.length > 6) {
          setBlindError("Please enter a valid 4-6 digit Manager/Owner PIN for variance override.");
          return;
        }
        payload.managerPin = overridePin;
      }

      const sessId = ApiClient.getSessionId() || "";
      const currentTenantId = localStorage.getItem("veggiepos_active_tenant_id") || activeTenant?.tenantId || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessId) headers["x-session-id"] = sessId;
      if (currentTenantId) headers["x-tenant-id"] = currentTenantId;

      const res = await fetch(`/api/shifts/${activeShift.id}/close-blind`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setBlindError(data.message || data.error || "Shift closing failed.");
        return;
      }

      if (data.requireManagerOverride) {
        setBlindStep("override");
        setVarianceInfo({
          expected: data.expectedCash,
          physical: data.physicalCashCount,
          variance: data.variance
        });
        setBlindError(data.message);
        return;
      }

      alert(`Shift successfully closed! ${data.message || ""}`);
      setShowBlindModal(false);
      setPhysicalCashVal("");
      setBlindStep("count");
      setVarianceInfo(null);
      setOverridePin("");
      setBlindError(null);
      onShiftAction(); // Update app shift state
    } catch (err: any) {
      setBlindError(err.message || "Failed to communicate with server.");
    }
  };

  const getShiftDurationString = (startTime: string, endTime?: string): string => {
    const end = endTime ? new Date(endTime) : new Date();
    const start = new Date(startTime);
    const diffMs = end.getTime() - start.getTime();
    
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    
    if (diffHrs < 1) return `${diffMins} min${diffMins > 1 ? "s" : ""}`;
    return `${diffHrs}h ${diffMins}m`;
  };

  // State for new staff registration
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"Owner" | "Manager" | "Cashier" | "Waiter" | "Chef" | "Custom">("Cashier");
  const [customRoleTitle, setCustomRoleTitle] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>(["billing"]);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleRoleChange = (role: "Owner" | "Manager" | "Cashier" | "Waiter" | "Chef" | "Custom") => {
    setNewRole(role);
    if (role === "Owner") {
      setNewPerms(["billing", "inventory", "reports", "settings"]);
    } else if (role === "Manager") {
      setNewPerms(["billing", "inventory", "reports"]);
    } else if (role === "Chef") {
      setNewPerms(["billing"]);
    } else if (role === "Waiter" || role === "Cashier") {
      setNewPerms(["billing"]);
    } else {
      setNewPerms(["billing"]);
    }
  };

  const togglePermission = (perm: string) => {
    if (newPerms.includes(perm)) {
      setNewPerms(newPerms.filter((p) => p !== perm));
    } else {
      setNewPerms([...newPerms, perm]);
    }
  };

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const activePlan = activeTenant?.plan || "free";
    const capacity = activePlan === "pro" ? 10 : activePlan === "enterprise" ? 100000 : 3;
    if (staffList.length >= capacity) {
      setFormError(`Plan Limit Reached: Your current ${activePlan.toUpperCase()} Plan only supports up to ${capacity} staff members. Please upgrade your plan to add more team members.`);
      return;
    }

    if (!newName.trim()) {
      setFormError("Staff Name is required");
      return;
    }

    if (newRole === "Custom" && !customRoleTitle.trim()) {
      setFormError("Please type the custom staff position / designation (e.g. Captain, Bartender).");
      return;
    }

    if (newPin.length < 4 || newPin.length > 6 || !/^\d{4,6}$/.test(newPin)) {
      setFormError("PIN must be 4 to 6 digits (e.g. 1234 or 12345)");
      return;
    }

    // Ensure PIN code is unique
    const pinConflict = staffList.find((s) => s.pin === newPin);
    if (pinConflict) {
      setFormError(`PIN conflict: ${pinConflict.name} is already using this PIN.`);
      return;
    }

    const finalRoleTitle = newRole === "Custom" ? customRoleTitle.trim() : newRole;

    const newStaff: StaffMember = {
      id: `s-${Date.now()}`,
      name: newName.trim(),
      role: finalRoleTitle as StaffRole,
      pin: newPin,
      permissions: (newPerms.length > 0 ? newPerms : ["billing"]) as any
    };

    setIsSaving(true);
    const updatedList = [...staffList, newStaff];
    onUpdateStaffList(updatedList);

    // Instant Backend Sync
    try {
      const sessId = ApiClient.getSessionId() || "";
      const currentTenantId = localStorage.getItem("veggiepos_active_tenant_id") || activeTenant?.tenantId || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessId) headers["x-session-id"] = sessId;
      if (currentTenantId) headers["x-tenant-id"] = currentTenantId;

      await fetch("/api/pos/staff", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(newStaff)
      });
    } catch (syncErr) {
      console.warn("Backend direct staff sync error:", syncErr);
    } finally {
      setIsSaving(false);
    }

    setFormSuccess(`Successfully registered ${newName.trim()} (${finalRoleTitle})! Synced instantly to backend.`);
    setNewName("");
    setNewPin("");
    setCustomRoleTitle("");
    setNewRole("Cashier");
    setNewPerms(["billing"]);
  };

  const handleDeleteStaffMember = async (staffId: string) => {
    const updatedList = staffList.filter((s) => s.id !== staffId);
    onUpdateStaffList(updatedList);
    setLocalDeleteId(null);

    // Instant Backend Sync Delete
    try {
      const sessId = ApiClient.getSessionId() || "";
      const currentTenantId = localStorage.getItem("veggiepos_active_tenant_id") || activeTenant?.tenantId || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessId) headers["x-session-id"] = sessId;
      if (currentTenantId) headers["x-tenant-id"] = currentTenantId;

      await fetch(`/api/pos/staff/${staffId}`, {
        method: "DELETE",
        headers,
        credentials: "include"
      });
    } catch (syncErr) {
      console.warn("Backend direct staff delete error:", syncErr);
    }
  };

  return (
    <div className="h-full bg-slate-950 flex flex-col p-4 sm:p-6 font-sans text-slate-200 overflow-hidden">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-white leading-tight">
              Real-Time Shift Tracker
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Employee attendance logging panel. Track staff shifts, clock-in hours, and active floor duty status.
            </p>
          </div>
        </div>
      </div>

      {/* Subtab Navigation (Compatible with Android & Laptop) */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 text-xs mb-6 self-start max-w-full overflow-x-auto gap-1 shrink-0">
        <button
          onClick={() => setActiveSubTab("duty")}
          className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 select-none ${
            activeSubTab === "duty"
              ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
              : "text-slate-400 hover:text-white hover:bg-slate-800/40"
          }`}
          id="staff-subtab-duty"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Your Duty Control</span>
        </button>
        <button
          onClick={() => setActiveSubTab("logs")}
          className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 select-none ${
            activeSubTab === "logs"
              ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
              : "text-slate-400 hover:text-white hover:bg-slate-800/40"
          }`}
          id="staff-subtab-logs"
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>{isManagerOrOwner ? "All Team Duty Logs" : "Your Duty Logs"}</span>
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeSubTab === "duty" ? (
          <div className="flex-1 overflow-y-auto pr-1">
            <div className={`grid grid-cols-1 ${isManagerOrOwner ? "lg:grid-cols-2" : "max-w-md mx-auto"} gap-6`}>
              {/* Your Duty Control */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
                <h2 className="text-base font-display font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  Your Duty Control
                </h2>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 uppercase font-mono">Shift Status</span>
                    {activeShift ? (
                      <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold animate-pulse">
                        On Duty
                      </span>
                    ) : (
                      <span className="text-[10px] bg-rose-500/15 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-bold">
                        Off Duty
                      </span>
                    )}
                  </div>

                  {activeShift && (
                    <div className="space-y-1.5 pt-2 text-xs border-t border-slate-800/40">
                      <div className="flex justify-between text-slate-400">
                        <span>Duty Started:</span>
                        <span className="font-mono text-white">
                          {new Date(activeShift.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Active Hours:</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {getShiftDurationString(activeShift.startTime)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (activeShift) {
                      if (isCashierRole) {
                        setShowBlindModal(true);
                        setPhysicalCashVal("");
                        setBlindStep("count");
                        setVarianceInfo(null);
                        setOverridePin("");
                        setBlindError(null);
                      } else {
                        // Directly clock out for Waiter, Chef, Manager, Owner, and other roles
                        onShiftAction();
                      }
                    } else {
                      onShiftAction();
                    }
                  }}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 shadow-lg transition duration-150 ${
                    activeShift
                      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/10 hover:shadow-rose-500/20"
                      : "bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/10 hover:shadow-emerald-500/20"
                  }`}
                  id="shifts-duty-toggle-btn"
                >
                  {activeShift ? (
                    <>
                      <LogOut className="w-4.5 h-4.5" />
                      <span>
                        {isCashierRole ? "Clock Out & End Shift (Cash Count)" : "Clock Out & End Shift"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4.5 h-4.5" />
                      <span>Clock In & Start Shift</span>
                    </>
                  )}
                </button>
              </div>

              {/* Add Staff Member (Owner / Manager only) */}
              {isManagerOrOwner && (
                <div className="space-y-6">
                  {/* Staff Login QR Code Banner for Owner/Manager */}
                  {activeTenant && (
                    <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg">
                          <QrCode className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-white">Staff Login QR Code (कर्मचारी QR)</h3>
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                              PIN Ready
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            कर्मचारियों को अपने फोन से 4-अंकों के PIN द्वारा लॉगिन कराने के लिए QR कोड दिखाएं या स्टैंडी प्रिंट करें।
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowStaffQrModal(true)}
                        className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                        id="open-staff-qr-modal-btn"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>View / Change QR</span>
                      </button>
                    </div>
                  )}

                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                    <h2 className="text-base font-display font-bold text-white flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-emerald-400" />
                      Register Team Member
                    </h2>

                    <form onSubmit={handleRegisterStaff} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Staff Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Vikram Singh"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Staff Role / Position
                          </label>
                          <select
                            value={newRole}
                            onChange={(e) => handleRoleChange(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500 transition text-xs cursor-pointer"
                            id="staff-role-select"
                          >
                            <option value="Cashier">Cashier (कैशियर)</option>
                            <option value="Waiter">Waiter / Steward (वेटर)</option>
                            <option value="Chef">Chef / Cook (रसोइया)</option>
                            <option value="Manager">Manager (मैनेजर)</option>
                            <option value="Owner">Owner (मालिक)</option>
                            <option value="Custom">Custom / Other (हाथ से पद लिखें)...</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            PIN Passcode (4-6 Digits)
                          </label>
                          <input
                            type="password"
                            maxLength={6}
                            required
                            placeholder="e.g. 1234 or 12345"
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center font-mono font-bold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition text-xs tracking-widest"
                            id="staff-register-pin-input"
                          />
                        </div>
                      </div>

                      {newRole === "Custom" && (
                        <div className="animate-fadeIn">
                          <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                            Custom Position Title (हाथ से लिखें)*:
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Captain, Bartender, Supervisor, Kitchen Helper, Storekeeper"
                            value={customRoleTitle}
                            onChange={(e) => setCustomRoleTitle(e.target.value)}
                            className="w-full bg-slate-950 border border-amber-500/50 focus:border-amber-400 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none transition text-xs"
                            id="staff-custom-role-input"
                          />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Allowed Permissions & Screen Access
                          </label>
                          <span className="text-[9px] text-emerald-400 font-mono font-semibold">
                            {newPerms.length} Modules Selected
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "billing", label: "POS & Billing", desc: "Orders & Tables" },
                            { id: "inventory", label: "Inventory & Stock", desc: "Stock & Recipes" },
                            { id: "reports", label: "Reports & Insights", desc: "Sales & Analytics" },
                            { id: "settings", label: "Settings & Setup", desc: "Printer & Config" }
                          ].map((perm) => {
                            const active = newPerms.includes(perm.id);
                            return (
                              <button
                                type="button"
                                key={perm.id}
                                onClick={() => togglePermission(perm.id)}
                                className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition select-none cursor-pointer ${
                                  active
                                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm"
                                    : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  readOnly
                                  className="w-3.5 h-3.5 mt-0.5 accent-emerald-500 pointer-events-none"
                                />
                                <div className="min-w-0">
                                  <span className="font-bold text-[11px] block leading-tight">{perm.label}</span>
                                  <span className="text-[9px] text-slate-500 block mt-0.5 leading-tight">{perm.desc}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {formError && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[11px] flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                          <span>{formError}</span>
                        </div>
                      )}

                      {formSuccess && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[11px] flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span>{formSuccess}</span>
                        </div>
                      )}

                      {hasReachedLimit && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 space-y-3">
                          <div className="flex gap-2.5 items-start">
                            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-bold text-white">Upgrade Plan Suggestion</p>
                              <p className="text-[11px] leading-relaxed text-slate-300">
                                Your current <span className="uppercase text-amber-400 font-bold font-mono">{planName}</span> plan only supports up to <span className="font-bold text-white">{planCapacity} staff members</span>. 
                                You currently have <span className="font-bold text-white">{staffList.length} members</span>.
                              </p>
                            </div>
                          </div>
                          {setActiveTab && (
                            <button
                              type="button"
                              onClick={() => setActiveTab("settings")}
                              className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl transition duration-150 shadow-md flex items-center justify-center gap-1.5 select-none cursor-pointer"
                            >
                              <Zap className="w-3.5 h-3.5 fill-slate-950" />
                              <span>Upgrade Your Plan</span>
                            </button>
                          )}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={hasReachedLimit || isSaving}
                        className={`w-full py-2.5 font-bold text-xs rounded-xl transition duration-150 shadow-md cursor-pointer ${
                          hasReachedLimit 
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none"
                            : isSaving
                              ? "bg-emerald-600 text-slate-950 opacity-80 cursor-wait"
                              : "bg-emerald-500 hover:bg-emerald-600 text-slate-950 active:scale-[0.98] shadow-emerald-500/10"
                        }`}
                      >
                        {hasReachedLimit ? "Plan Limit Reached" : isSaving ? "Saving & Syncing to Cloud..." : "Register Team Member & Sync"}
                      </button>
                    </form>
                  </div>

                  {/* Active Team Roster */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                    <h2 className="text-base font-display font-bold text-white flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-emerald-400" />
                        <span>Manage Registered Staff</span>
                      </div>
                      <span className="text-xs font-mono font-medium text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-full">
                        {staffList.length} / {planCapacity} Limit
                      </span>
                    </h2>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      All registered staff, waiters, and custom positions are stored securely and synchronized instantly across your terminals.
                    </p>

                    <div className="space-y-3 pt-2 max-h-[350px] overflow-y-auto pr-1">
                      {staffList.map((staff) => (
                        <div key={staff.id} className="bg-slate-950 border border-slate-800/60 rounded-2xl p-3.5 flex items-center justify-between hover:border-slate-800 transition">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center font-bold text-emerald-400 text-xs shrink-0 border border-slate-800 uppercase">
                              {staff.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-bold text-white text-xs leading-tight truncate">{staff.name}</h4>
                                <span className="text-[8px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold uppercase shrink-0">
                                  {staff.role}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[10px] text-slate-500 font-mono">PIN: ••••</span>
                                <span className="text-slate-700">•</span>
                                <div className="flex items-center gap-1">
                                  {(staff.permissions || ["billing"]).map((perm: string) => (
                                    <span key={perm} className="text-[8px] bg-slate-900 border border-slate-800 text-slate-400 px-1 py-0.2 rounded font-mono capitalize">
                                      {perm === "billing" ? "POS" : perm}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {staff.role !== "Owner" && (
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {localDeleteId === staff.id ? (
                                <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 p-1 rounded-xl animate-fadeIn">
                                  <span className="text-[9px] text-rose-300 font-bold px-1 select-none">Sure?</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStaffMember(staff.id)}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-bold uppercase transition cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setLocalDeleteId(null)}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-semibold transition cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setLocalDeleteId(staff.id)}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/20 transition cursor-pointer"
                                  title="Delete Staff Member"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-slate-900/40 border border-slate-800/60 rounded-3xl p-5 flex flex-col overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800 shrink-0">
              <h2 className="text-sm font-display font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-slate-500" />
                {isManagerOrOwner ? "All Team Duty logs" : "Your Duty logs"}
              </h2>
              <span className="text-[10px] text-slate-500 font-mono">
                showing {displayedShifts.length} items
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {displayedShifts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                  <span className="text-3xl filter grayscale mb-2">⏱️</span>
                  <p className="text-sm font-semibold">No shift history found</p>
                  <p className="text-xs text-slate-600 mt-0.5">Click "Clock In" to begin recording shift records.</p>
                </div>
              ) : (
                displayedShifts
                  .slice()
                  .reverse()
                  .map((shift) => (
                    <div
                      key={shift.id}
                      className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between hover:border-slate-700/60 transition"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center font-bold text-slate-400 text-xs shrink-0">
                          {shift.staffName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h4 className="font-bold text-white text-sm leading-tight">{shift.staffName}</h4>
                            <span className="text-[9px] bg-slate-800 border border-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono font-medium">
                              {shift.role}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1 font-mono">
                            {new Date(shift.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })} •{" "}
                            {new Date(shift.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            {shift.endTime ? ` - ${new Date(shift.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : " (Active)"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono font-bold text-emerald-400">
                          {getShiftDurationString(shift.startTime, shift.endTime)}
                        </p>
                        <span
                          className={`text-[9px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-md mt-1 inline-block ${
                            shift.status === "Active"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-950 text-slate-500"
                          }`}
                        >
                          {shift.status}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* BLIND SHIFT CLOSE MODAL (Problem 6) */}
      {showBlindModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-display font-bold text-white">Blind Cash Drop Shift Close</h3>
                <p className="text-xs text-slate-400 font-medium">Prevent cash theft & shift tampering via blind drawer reconciliation.</p>
              </div>
            </div>

            {blindStep === "count" ? (
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                <p className="text-slate-400 leading-relaxed">
                  ⚠️ System expected sales revenue is hidden to enforce honest physical cash counting. Please count all cash notes/coins in the physical drawer.
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-amber-400 mb-1">
                    Physical Cash Counted in Drawer (INR)*:
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={physicalCashVal}
                    onChange={(e) => setPhysicalCashVal(e.target.value)}
                    placeholder="e.g. 5200"
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-base font-bold font-mono text-white focus:outline-none focus:border-amber-500 shadow-inner"
                    id="shifts-physical-cash-input"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-rose-500/30 text-xs">
                <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-rose-300 font-bold space-y-1">
                  <p className="text-sm">⚠️ Cash Discrepancy / Variance Detected!</p>
                  {varianceInfo && (
                    <div className="font-mono text-xs text-white space-y-0.5 pt-1">
                      <p>Counted: <span className="text-amber-400">INR {varianceInfo.physical}</span></p>
                      <p>Expected: <span className="text-blue-400">INR {varianceInfo.expected}</span></p>
                      <p>Variance: <span className="text-rose-400 font-extrabold">{varianceInfo.variance > 0 ? `+INR ${varianceInfo.variance}` : `-INR ${Math.abs(varianceInfo.variance)}`}</span></p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-rose-400 mb-1">
                    Manager / Owner Override 4-Digit PIN*:
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={overridePin}
                    onChange={(e) => setOverridePin(e.target.value)}
                    placeholder="****"
                    className="w-full p-3 bg-slate-900 border border-rose-500/50 rounded-xl text-base font-bold font-mono tracking-widest text-white text-center focus:outline-none focus:border-rose-400 shadow-inner"
                    id="shifts-override-pin-input"
                  />
                </div>
              </div>
            )}

            {blindError && (
              <p className="text-xs text-rose-400 font-bold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                ⚠️ {blindError}
              </p>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => {
                  setShowBlindModal(false);
                  setPhysicalCashVal("");
                  setBlindStep("count");
                  setVarianceInfo(null);
                  setOverridePin("");
                  setBlindError(null);
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBlindCloseSubmit}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-500/10"
                id="shifts-confirm-blind-close-btn"
              >
                {blindStep === "count" ? "Submit Cash Count" : "Authorize Variance & End Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Login QR Modal */}
      {activeTenant && (
        <StaffQrModal
          isOpen={showStaffQrModal}
          onClose={() => setShowStaffQrModal(false)}
          tenant={activeTenant}
        />
      )}
    </div>
  );
}
