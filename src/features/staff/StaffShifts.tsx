import React, { useState } from "react";
import { Shift, StaffMember, StaffRole } from "../shared/types";
import { Clock, Play, LogOut, CheckCircle2, UserCheck, Eye, UserPlus, AlertCircle, ShieldAlert } from "lucide-react";

interface StaffShiftsProps {
  shifts: Shift[];
  activeShift: Shift | null;
  onShiftAction: () => void;
  currentStaff: StaffMember;
  staffList: StaffMember[];
  onUpdateStaffList: (staff: StaffMember[]) => void;
}

export default function StaffShifts({
  shifts,
  activeShift,
  onShiftAction,
  currentStaff,
  staffList,
  onUpdateStaffList
}: StaffShiftsProps) {
  const isManagerOrOwner = currentStaff.role === "Owner" || currentStaff.role === "Manager";
  const [activeSubTab, setActiveSubTab] = useState<"duty" | "logs">("duty");

  // Filter shift records: standard staff only see their own records, managers see all
  const displayedShifts = shifts.filter((s) => isManagerOrOwner || s.staffId === currentStaff.id);

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
  const [newRole, setNewRole] = useState<"Owner" | "Manager" | "Cashier" | "Chef">("Cashier");
  const [newPin, setNewPin] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>(["billing"]);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const handleRoleChange = (role: "Owner" | "Manager" | "Cashier" | "Chef") => {
    setNewRole(role);
    if (role === "Owner") {
      setNewPerms(["billing", "inventory", "reports", "settings"]);
    } else if (role === "Manager") {
      setNewPerms(["billing", "inventory", "reports"]);
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

  const handleRegisterStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!newName.trim()) {
      setFormError("Staff Name is required");
      return;
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setFormError("PIN must be exactly 4 digits (e.g. 1234)");
      return;
    }

    // Ensure PIN code is unique
    const pinConflict = staffList.find((s) => s.pin === newPin);
    if (pinConflict) {
      setFormError(`PIN conflict: ${pinConflict.name} is already using this PIN.`);
      return;
    }

    const newStaff: StaffMember = {
      id: `s-${Date.now()}`,
      name: newName.trim(),
      role: (newRole === "Cashier" || newRole === "Chef" ? "Staff" : newRole) as StaffRole,
      pin: newPin,
      permissions: newPerms as any
    };

    onUpdateStaffList([...staffList, newStaff]);
    setFormSuccess(`Successfully registered ${newName.trim()}!`);
    setNewName("");
    setNewPin("");
    setNewRole("Cashier");
    setNewPerms(["billing"]);
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
                  onClick={onShiftAction}
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
                      <span>Clock Out & End Shift</span>
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

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Role
                        </label>
                        <select
                          value={newRole}
                          onChange={(e) => handleRoleChange(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500 transition text-xs"
                        >
                          <option value="Cashier">Cashier</option>
                          <option value="Chef">Chef</option>
                          <option value="Manager">Manager</option>
                          <option value="Owner">Owner</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          4-Digit PIN
                        </label>
                        <input
                          type="text"
                          maxLength={4}
                          required
                          placeholder="e.g. 4321"
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center font-mono font-bold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        View Permissions
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["billing", "inventory", "reports", "settings"] as const).map((perm) => {
                          const active = newPerms.includes(perm);
                          return (
                            <button
                              type="button"
                              key={perm}
                              onClick={() => togglePermission(perm)}
                              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-semibold text-left transition select-none ${
                                active
                                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                  : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                readOnly
                                className="w-3 h-3 accent-emerald-500 pointer-events-none"
                              />
                              <span className="capitalize">{perm}</span>
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

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition duration-150 active:scale-[0.98] shadow-md shadow-emerald-500/10"
                    >
                      Register Team Member
                    </button>
                  </form>
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
    </div>
  );
}
