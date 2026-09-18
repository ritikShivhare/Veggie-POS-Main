import React, { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Mail,
  Smartphone,
  Trash2,
  RefreshCw,
  Send,
  Sparkles,
  Check,
  Eye,
  Settings,
  Clock,
  ExternalLink
} from "lucide-react";

interface InAppNotification {
  id: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  timestamp: string;
  read: boolean;
  metadata?: any;
}

interface DispatchLog {
  id: string;
  timestamp: string;
  channel: "in-app" | "email" | "sms";
  status: "dispatched" | "failed";
  recipient: string;
  subjectOrTitle: string;
  messageBody: string;
  providerUsed: string;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"inbox" | "history" | "compose">("inbox");

  // Dispatch composer form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"info" | "success" | "warning" | "error">("info");
  const [channels, setChannels] = useState<string[]>(["in-app"]);
  const [targetEmail, setTargetEmail] = useState("retail.client@gmail.com");
  const [targetPhone, setTargetPhone] = useState("+91 98765 43210");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any[] | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const sessId = localStorage.getItem("veggiepos_current_session_id") || "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (sessId) {
      headers["Authorization"] = `Bearer ${sessId}`;
      headers["x-session-id"] = sessId;
    }
    return headers;
  };

  const fetchNotificationData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/notifications", {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setDispatchLogs(data.dispatchLogs || []);
      }
    } catch (err) {
      console.error("Error retrieving notifications:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotificationData();
    const interval = setInterval(() => fetchNotificationData(true), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        // Optimistic local state update
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
      }
    } catch (err) {
      console.error("Error marking read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error("Error reading all:", err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm("Confirm clearing the multi-channel dispatch log history?")) return;
    try {
      const res = await fetch("/api/notifications/clear-logs", {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setDispatchLogs([]);
      }
    } catch (err) {
      console.error("Error clearing logs:", err);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert("Please fill out both the notification title and message body.");
      return;
    }
    if (channels.length === 0) {
      alert("Please check at least one delivery channel.");
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title,
          message,
          severity,
          channels,
          recipientEmail: channels.includes("email") ? targetEmail : undefined,
          recipientPhone: channels.includes("sms") ? targetPhone : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSendResult(data.details || []);
        // Reset composer
        setTitle("");
        setMessage("");
        // Pull update
        fetchNotificationData(true);
      } else {
        alert("Notification dispatch failed.");
      }
    } catch (err) {
      console.error("Error sending notification:", err);
    } finally {
      setSending(false);
    }
  };

  const handleChannelToggle = (channel: string) => {
    setChannels(prev =>
      prev.includes(channel)
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
        <div className="w-10 h-10 border-4 border-pink-500/20 border-t-pink-600 rounded-full animate-spin mb-4" />
        <p className="font-semibold text-slate-700 text-sm">Initializing Central Notification System...</p>
        <p className="text-xs text-slate-400 mt-1">Connecting client message channels and auditing gateways...</p>
      </div>
    );
  }

  return (
    <div className="h-full p-4 sm:p-6 bg-[#f8fafc] overflow-y-auto space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-5 h-5 text-pink-600 animate-swing" />
            Central Notification Orchestrator
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise multi-channel dispatch hub linking In-App inbox queues, transactional Email templates, and high-priority SMS gateway protocols.
          </p>
        </div>
        
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchNotificationData(false)}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-sm flex items-center gap-2 text-xs font-semibold cursor-pointer"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-pink-600" : ""}`} />
            <span>Sync Live</span>
          </button>
        </div>
      </div>

      {/* METRIC ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-pink-50 text-pink-600 rounded-lg">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Unread Alerts</p>
            <h3 className="text-lg font-extrabold text-slate-800 mt-1">
              {unreadCount} Messages
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Transmitted Emails</p>
            <h3 className="text-lg font-extrabold text-slate-800 mt-1">
              {dispatchLogs.filter(l => l.channel === "email").length} Sent
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Dispatched SMS</p>
            <h3 className="text-lg font-extrabold text-slate-800 mt-1">
              {dispatchLogs.filter(l => l.channel === "sms").length} Sent
            </h3>
          </div>
        </div>
      </div>

      {/* TABS CONTROLLER */}
      <div className="flex border-b border-slate-200 gap-1 bg-slate-100/60 p-1 rounded-xl max-w-md">
        <button
          onClick={() => { setActiveTab("inbox"); setSendResult(null); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "inbox" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          }`}
        >
          <Bell className="w-4 h-4 text-pink-600" />
          Inbox
          {unreadCount > 0 && (
            <span className="bg-pink-100 text-pink-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {unreadCount}
            </span>
          )}
        </button>
        
        <button
          onClick={() => { setActiveTab("compose"); setSendResult(null); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "compose" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          }`}
        >
          <Send className="w-4 h-4 text-indigo-600" />
          Dispatch Lab
        </button>

        <button
          onClick={() => { setActiveTab("history"); setSendResult(null); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "history" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-600" />
          Gateway Logs
        </button>
      </div>

      {/* MAIN VIEWPORT BODY */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        
        {/* TAB 1: INBOX */}
        {activeTab === "inbox" && (
          <div className="flex-1 flex flex-col">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">In-App Live Stream</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-[11px] font-bold text-pink-600 hover:text-pink-700 cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark all as read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-slate-400 space-y-2">
                <Bell className="w-10 h-10 text-slate-200" />
                <p className="font-bold text-slate-600 text-sm">Your inbox is crystal clear</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Background jobs and automated events will broadcast messages here in real-time. Use the **Dispatch Lab** to test immediately.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-150">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 flex gap-4 transition ${
                      !item.read ? "bg-slate-50/50 border-l-4 border-pink-500" : "hover:bg-slate-50/30"
                    }`}
                  >
                    {/* Severity Indicator */}
                    <div className="shrink-0 mt-0.5">
                      {item.severity === "success" && (
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                      {item.severity === "warning" && (
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      )}
                      {item.severity === "error" && (
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
                          <XCircle className="w-4 h-4" />
                        </div>
                      )}
                      {item.severity === "info" && (
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                          <Info className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className={`text-sm font-bold text-slate-800 ${!item.read ? "font-extrabold" : ""}`}>
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!item.read && (
                            <button
                              onClick={() => handleMarkAsRead(item.id)}
                              className="p-1 text-slate-400 hover:text-emerald-600 transition hover:bg-slate-100 rounded-md cursor-pointer"
                              title="Mark as Read"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteNotification(item.id)}
                            className="p-1 text-slate-300 hover:text-rose-600 transition hover:bg-slate-100 rounded-md cursor-pointer"
                            title="Delete Alert"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                        {item.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DISPATCH LAB */}
        {activeTab === "compose" && (
          <div className="p-6 max-w-3xl mx-auto w-full space-y-6">
            
            <div className="border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-600 animate-pulse" />
                Multi-Channel Notification Dispatcher
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Trigger transactional events immediately. The central engine handles distribution logic for all active targets.
              </p>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Alert Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. UPI Settlement Complete"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-pink-500 focus:bg-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Severity Protocol</label>
                  <select
                    value={severity}
                    onChange={(e: any) => setSeverity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:ring-1 focus:ring-pink-500 focus:bg-white outline-none"
                  >
                    <option value="info">💡 Information (Info)</option>
                    <option value="success">✅ Completed Process (Success)</option>
                    <option value="warning">⚠️ High Warning (Warning)</option>
                    <option value="error">🚨 Severe System Fail (Error)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Message Body</label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type the message detail here. The system automatically processes structural formatting per channel..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-pink-500 focus:bg-white outline-none resize-none"
                />
              </div>

              {/* Delivery Channels */}
              <div className="space-y-2 bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
                <label className="text-xs font-bold text-slate-600 block">Select Active Channels</label>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => handleChannelToggle("in-app")}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      channels.includes("in-app")
                        ? "bg-pink-50 text-pink-700 border-pink-200"
                        : "bg-white text-slate-500 border-slate-200"
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>In-App Inbox</span>
                    {channels.includes("in-app") && <Check className="w-3 h-3 text-pink-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChannelToggle("email")}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      channels.includes("email")
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-white text-slate-500 border-slate-200"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Delivery</span>
                    {channels.includes("email") && <Check className="w-3 h-3 text-blue-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChannelToggle("sms")}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      channels.includes("sms")
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-white text-slate-500 border-slate-200"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>SMS Broadcast</span>
                    {channels.includes("sms") && <Check className="w-3 h-3 text-emerald-600" />}
                  </button>
                </div>

                {/* Conditional Destination Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200">
                  {channels.includes("email") && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-blue-500" /> Destination Email
                      </label>
                      <input
                        type="email"
                        value={targetEmail}
                        onChange={(e) => setTargetEmail(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  )}

                  {channels.includes("sms") && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <Smartphone className="w-3 h-3 text-emerald-500" /> Destination Mobile No
                      </label>
                      <input
                        type="text"
                        value={targetPhone}
                        onChange={(e) => setTargetPhone(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Submit */}
              <button
                type="submit"
                disabled={sending}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-pink-500" />
                    <span>Dispersing Packets via Multi-Gateways...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Unified Notification</span>
                  </>
                )}
              </button>
            </form>

            {/* Response Console */}
            {sendResult && (
              <div className="mt-4 p-4 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-slate-300">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-[10px] font-bold text-pink-400">
                  <span>CENTRAL ENGINE DISPATCH SUMMARY</span>
                  <span className="text-emerald-400">OK 200</span>
                </div>
                <div className="space-y-1.5 text-slate-300">
                  {sendResult.map((ch: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-slate-400">
                        channel: <strong className="text-white uppercase">{ch.channel}</strong>
                      </span>
                      <span className={ch.status === "success" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                        {ch.detail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GATEWAY AUDIT HISTORY */}
        {activeTab === "history" && (
          <div className="flex-1 flex flex-col">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                SMS & Email Transmit Audit Records
              </span>
              {dispatchLogs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear History Logs
                </button>
              )}
            </div>

            {dispatchLogs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-slate-400 space-y-2">
                <Clock className="w-10 h-10 text-slate-200" />
                <p className="font-bold text-slate-600 text-sm">No transaction audit trace found</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  SMS and Email dispatches through integration APIs will be logged here for legal, technical, and regulatory compliance.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {dispatchLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {log.channel === "email" ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[9px] font-bold uppercase flex items-center gap-1">
                            <Mail className="w-3 h-3" /> Email
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-bold uppercase flex items-center gap-1">
                            <Smartphone className="w-3 h-3" /> SMS
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-800">{log.recipient}</span>
                        <span className="text-[9px] font-mono text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-slate-700 pl-1">
                        Subject/Content: <span className="font-semibold">{log.subjectOrTitle}</span>
                      </p>
                      <p className="text-xs text-slate-500 pl-1 leading-relaxed">
                        {log.messageBody}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[9.5px] font-mono font-bold bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Settings className="w-3 h-3 text-slate-400 animate-spin" />
                        {log.providerUsed}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EXTENSION / COMPLIANCE DETAILS CARD */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 rounded-2xl border border-slate-800 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-10">
          <Settings className="w-52 h-52 animate-spin-slow" />
        </div>
        
        <div className="relative space-y-4 max-w-2xl">
          <h3 className="text-sm font-bold text-pink-400 flex items-center gap-2 font-mono">
            <Settings className="w-4.5 h-4.5" />
            Extensible Production Gateway Blueprint
          </h3>
          <p className="text-xs text-indigo-100 leading-relaxed font-medium">
            This module has been architecturalized strictly around a single service hub design pattern.
            In production configurations, swapping standard mock handlers with genuine SaaS providers requires zero change to components or business domains.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="bg-white/5 border border-white/10 p-3 rounded-xl space-y-1">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-400" /> SendGrid integration
              </h4>
              <p className="text-[11px] text-indigo-200">
                Configured with dynamic templates, automatic transactional unsubscribes, and DKIM/SPF domain verification.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 p-3 rounded-xl space-y-1">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> Twilio SMS Gateway
              </h4>
              <p className="text-[11px] text-indigo-200">
                Engineered with delivery callbacks, automated carrier route aggregation, and regional DLT registrations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
