import React, { useState, useEffect } from "react";
import {
  Shield,
  Clock,
  Smartphone,
  Laptop,
  Tablet,
  LogOut,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Monitor,
  User,
  Key,
  Sliders,
  Settings,
  HelpCircle,
  MapPin,
  Lock,
  ChevronRight,
  ShieldAlert,
  Info
} from "lucide-react";

interface UserSession {
  sessionId: string;
  userId: string;
  userName: string;
  role: string;
  tenantId: string;
  ipAddress: string;
  device: {
    os: string;
    browser: string;
    deviceType: string;
    userAgent: string;
  };
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

interface LoginHistoryEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: string;
  tenantId: string;
  ipAddress: string;
  device: {
    os: string;
    browser: string;
    deviceType: string;
  };
  status: "success" | "failed";
  failureReason?: string;
}

interface SecuritySettings {
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationSeconds: number;
  enableBruteForceProtection: boolean;
}

interface SessionManagementDashboardProps {
  currentSessionId: string | null;
  onSessionTerminated: () => void;
}

export default function SessionManagementDashboard({
  currentSessionId,
  onSessionTerminated
}: SessionManagementDashboardProps) {
  const [activeSessions, setActiveSessions] = useState<UserSession[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [settings, setSettings] = useState<SecuritySettings>({
    sessionTimeoutMinutes: 15,
    maxFailedAttempts: 3,
    lockoutDurationSeconds: 60,
    enableBruteForceProtection: true
  });

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "history" | "security">("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  
  // Settings Form state
  const [formTimeout, setFormTimeout] = useState(15);
  const [formMaxAttempts, setFormMaxAttempts] = useState(3);
  const [formLockoutDuration, setFormLockoutDuration] = useState(60);
  const [formBruteForce, setFormBruteForce] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchSessionData = async (silent = false) => {
    if (!silent) setSyncing(true);
    try {
      const res = await fetch("/api/auth/sessions-data");
      const data = await res.json();
      if (data.success) {
        setActiveSessions(data.activeSessions || []);
        setLoginHistory(data.loginHistory || []);
        setSettings(data.securitySettings);
        
        // Update form states on first load/sync
        setFormTimeout(data.securitySettings.sessionTimeoutMinutes);
        setFormMaxAttempts(data.securitySettings.maxFailedAttempts);
        setFormLockoutDuration(data.securitySettings.lockoutDurationSeconds);
        setFormBruteForce(data.securitySettings.enableBruteForceProtection);
      }
    } catch (err) {
      console.error("Failed to fetch session metadata:", err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
    const interval = setInterval(() => fetchSessionData(true), 12000);
    return () => clearInterval(interval);
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    const isCurrent = sessionId === currentSessionId;
    const confirmMsg = isCurrent 
      ? "Are you sure you want to terminate your current session? You will be logged out."
      : "Are you sure you want to remotely terminate this active device session?";
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/auth/sessions/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      const data = await res.json();
      if (data.success) {
        if (isCurrent) {
          onSessionTerminated();
        } else {
          setActiveSessions(prev => prev.filter(s => s.sessionId !== sessionId));
          fetchSessionData(true);
        }
      }
    } catch (err) {
      console.error("Revoke error:", err);
    }
  };

  const handleRevokeAllOthers = async () => {
    if (!window.confirm("Terminate all other active sessions and force-logout all other connected devices?")) return;
    try {
      const res = await fetch("/api/auth/sessions/revoke-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exceptSessionId: currentSessionId || "" })
      });
      const data = await res.json();
      if (data.success) {
        if (currentSessionId) {
          setActiveSessions(prev => prev.filter(s => s.sessionId === currentSessionId));
        } else {
          setActiveSessions([]);
        }
        fetchSessionData(true);
      }
    } catch (err) {
      console.error("Bulk revoke error:", err);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to completely purge the audit logs of authentication attempts?")) return;
    try {
      const res = await fetch("/api/auth/history/clear", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setLoginHistory([]);
      }
    } catch (err) {
      console.error("Clear logs error:", err);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/auth/settings/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionTimeoutMinutes: formTimeout,
          maxFailedAttempts: formMaxAttempts,
          lockoutDurationSeconds: formLockoutDuration,
          enableBruteForceProtection: formBruteForce
        })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Update security config error:", err);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="w-5 h-5 text-indigo-600" />;
      case "tablet":
        return <Tablet className="w-5 h-5 text-purple-600" />;
      default:
        return <Laptop className="w-5 h-5 text-blue-600" />;
    }
  };

  // Filter login histories
  const filteredHistory = loginHistory.filter(h => {
    const matchesSearch = 
      h.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.ipAddress.includes(searchTerm);
    
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && h.status === statusFilter;
  });

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="font-semibold text-slate-700 text-sm">Synchronizing Sessions & Lockout States...</p>
        <p className="text-xs text-slate-400 mt-1">Establishing high-contrast secure channels...</p>
      </div>
    );
  }

  // Calculate stats
  const activeCount = activeSessions.length;
  const failedCount = loginHistory.filter(h => h.status === "failed").length;
  const successCount = loginHistory.filter(h => h.status === "success").length;

  return (
    <div className="h-full p-4 sm:p-6 bg-[#f8fafc] overflow-y-auto space-y-6">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Security Session Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time tracking of active logins, client idle timeouts, brute-force protective lockouts, and active session revoking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSessionData(false)}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-sm flex items-center gap-2 text-xs font-semibold cursor-pointer"
            disabled={syncing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-indigo-600" : ""}`} />
            <span>Sync Live</span>
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Active Sessions</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5 font-mono">{activeCount} Device{activeCount > 1 ? "s" : ""}</h3>
            <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
              <span>●</span> Real-time active tracking
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Successful Logins</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5 font-mono">{successCount}</h3>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">Approved access requests</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Failed Access Blocks</p>
            <h3 className="text-xl font-bold text-rose-600 mt-0.5 font-mono">{failedCount}</h3>
            <p className="text-[9px] text-rose-500 font-bold flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3 animate-pulse" />
              Protection system is Active
            </p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Session Timeout</p>
            <h3 className="text-xl font-bold text-amber-600 mt-0.5 font-mono">{settings.sessionTimeoutMinutes} Mins</h3>
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">Configured idle duration</p>
          </div>
        </div>

      </div>

      {/* SEGMENT TAB HEADERS */}
      <div className="flex border-b border-slate-200 gap-1 bg-slate-100 p-1 rounded-xl max-w-md">
        <button
          onClick={() => setActiveTab("active")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "active" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Monitor className="w-4 h-4 text-indigo-600" />
          Device Sessions ({activeCount})
        </button>
        
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "history" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          Login History ({loginHistory.length})
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "security" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Settings className="w-4 h-4 text-amber-600" />
          Security Policy
        </button>
      </div>

      {/* BOTTOM SEGMENTED CONTENT PANEL */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* VIEW 1: ACTIVE DEVICES & SESSIONS */}
        {activeTab === "active" && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Currently Authenticated Devices</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Active login keys on all terminals and hand-held tablets. Terminate any unknown or suspicious device immediately.
                </p>
              </div>

              {activeSessions.length > 1 && (
                <button
                  onClick={handleRevokeAllOthers}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Revoke All Other Devices</span>
                </button>
              )}
            </div>

            {activeSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 space-y-2">
                <Shield className="w-8 h-8 text-slate-200 animate-pulse" />
                <p className="font-bold text-slate-600 text-xs">No Active Sessions Found</p>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  How are you seeing this panel? This is unexpected. Please log in again.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSessions.map((session) => {
                  const isCurrent = session.sessionId === currentSessionId;
                  
                  return (
                    <div
                      key={session.sessionId}
                      className={`p-4 rounded-xl border transition flex flex-col justify-between gap-4 ${
                        isCurrent 
                          ? "bg-indigo-50/40 border-indigo-200 ring-1 ring-indigo-200" 
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="p-2.5 bg-slate-100 rounded-lg">
                          {getDeviceIcon(session.device?.deviceType)}
                        </div>

                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-700 text-xs truncate">
                              {session.device?.browser || "Browser"} on {session.device?.os || "OS"}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 bg-indigo-100 border border-indigo-200 text-indigo-700 rounded text-[9px] font-extrabold uppercase">
                                Current
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col space-y-0.5 text-[10.5px] text-slate-400 font-semibold">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>User: <strong className="text-slate-600">{session.userName}</strong> ({session.role})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>IP Address: <strong className="text-slate-600 font-mono">{session.ipAddress}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Started: <strong className="text-slate-500 font-mono">{new Date(session.createdAt).toLocaleTimeString()}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-400 animate-pulse text-amber-500" />
                              <span>Expires: <strong className="text-slate-500 font-mono">{new Date(session.expiresAt).toLocaleTimeString()}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
                        <span className="text-[9.5px] font-mono text-slate-400 truncate">
                          ID: {session.sessionId}
                        </span>

                        <button
                          onClick={() => handleRevokeSession(session.sessionId)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                            isCurrent
                              ? "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                              : "bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 border border-slate-200"
                          }`}
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>{isCurrent ? "Log Out" : "Revoke Access"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: LOGIN HISTORY TRAIL */}
        {activeTab === "history" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Login Audits & Authentication Events</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Compliance and security tracking audit trail. This records every authentication action taken on VeggiePOS servers.
                </p>
              </div>

              {loginHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Login Audits</span>
                </button>
              )}
            </div>

            {/* SEARCH AND FILTERS */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user, role, or IP address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold text-slate-700"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    statusFilter === "all"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  All Statuses
                </button>
                <button
                  onClick={() => setStatusFilter("success")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    statusFilter === "success"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Success
                </button>
                <button
                  onClick={() => setStatusFilter("failed")}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    statusFilter === "failed"
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Failures
                </button>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400 space-y-2">
                <Search className="w-8 h-8 text-slate-200" />
                <p className="font-bold text-slate-600 text-xs">No Matching History Found</p>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  Change your filter parameters or search query, or log out and back in to see logs.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold font-mono uppercase tracking-wider text-[10px]">
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">User & Role</th>
                        <th className="p-3">Device / OS</th>
                        <th className="p-3">IP Location</th>
                        <th className="p-3">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHistory.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-700">{log.userName}</div>
                            <div className="text-[10px] text-slate-400 font-semibold">{log.role}</div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(log.device?.deviceType)}
                              <span className="font-semibold text-slate-600 text-[11px]">
                                {log.device?.browser} ({log.device?.os})
                              </span>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-[10.5px] text-slate-600 whitespace-nowrap">
                            {log.ipAddress}
                          </td>
                          <td className="p-3">
                            {log.status === "success" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-bold">
                                <CheckCircle className="w-3 h-3" />
                                Success
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-full text-[9px] font-bold">
                                  <XCircle className="w-3 h-3" />
                                  Blocked
                                </span>
                                {log.failureReason && (
                                  <div className="text-[10px] text-rose-500 font-semibold italic max-w-xs truncate">
                                    {log.failureReason}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: SECURITY POLICY & TIMEOUT CONFIG */}
        {activeTab === "security" && (
          <form onSubmit={handleUpdateSettings} className="p-6 space-y-6 max-w-2xl">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Advanced Security Configuration</h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure global terminal locking, PIN passcode rate limiting rules, and dynamic browser idle timeout parameters.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Option 1 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Client Idle Timeout (Minutes)
                </label>
                <select
                  value={formTimeout}
                  onChange={(e) => setFormTimeout(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value={1}>1 Minute (Demo Quick Test)</option>
                  <option value={5}>5 Minutes</option>
                  <option value={15}>15 Minutes (Default)</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>1 Hour</option>
                  <option value={1440}>24 Hours</option>
                </select>
                <span className="text-[10px] text-slate-400 block font-semibold">
                  Logs out staff automatically if no activity (clicks, keys) is registered.
                </span>
              </div>

              {/* Option 2 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-rose-500" />
                  Max Failed PIN Attempts
                </label>
                <select
                  value={formMaxAttempts}
                  onChange={(e) => setFormMaxAttempts(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value={3}>3 Attempts (Strict)</option>
                  <option value={5}>5 Attempts</option>
                  <option value={10}>10 Attempts</option>
                </select>
                <span className="text-[10px] text-slate-400 block font-semibold">
                  Allowed failed login PIN submissions before a lockout is enforced.
                </span>
              </div>

              {/* Option 3 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-indigo-500" />
                  Temporary Lockout Duration
                </label>
                <select
                  value={formLockoutDuration}
                  onChange={(e) => setFormLockoutDuration(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value={10}>10 Seconds (Fast Release)</option>
                  <option value={30}>30 Seconds</option>
                  <option value={60}>1 Minute (Default)</option>
                  <option value={300}>5 Minutes</option>
                </select>
                <span className="text-[10px] text-slate-400 block font-semibold">
                  Period of time the specific user/IP is fully blocked from logging in after lockout.
                </span>
              </div>

              {/* Option 4 */}
              <div className="space-y-1.5 flex flex-col justify-end pb-1.5">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="enable-brute"
                    checked={formBruteForce}
                    onChange={(e) => setFormBruteForce(e.target.checked)}
                    className="w-4.5 h-4.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="enable-brute" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                    Enable Brute Force Protection
                  </label>
                </div>
                <span className="text-[10px] text-slate-400 block font-semibold pl-7">
                  Defends billing register from malicious automated brute force passcode scanning.
                </span>
              </div>

            </div>

            {/* BUTTON BAR */}
            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/10 transition cursor-pointer"
              >
                Save Settings
              </button>

              {saveSuccess && (
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-fade-in">
                  <CheckCircle className="w-4 h-4" />
                  Settings applied successfully!
                </span>
              )}
            </div>

          </form>
        )}

      </div>

    </div>
  );
}
