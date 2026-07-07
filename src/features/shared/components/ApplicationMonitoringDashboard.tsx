import React, { useState, useEffect } from "react";
import {
  Activity,
  Server,
  Database,
  Cpu,
  AlertOctagon,
  AlertTriangle,
  Info,
  Terminal,
  RefreshCw,
  Search,
  Trash2,
  Sliders,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  PlayCircle,
  StopCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  Network
} from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" | "METRIC";
  service: string;
  message: string;
  context?: any;
  durationMs?: number;
}

interface MetricSummary {
  apiLatencyAverageMs: number;
  errorRatePercentage: number;
  totalRequestsCount: number;
  memoryUsageMb: number;
  cpuUsagePercentage: number;
  activeThreads: number;
  databaseQueriesMs: number;
}

export default function ApplicationMonitoringDashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<MetricSummary>({
    apiLatencyAverageMs: 0,
    errorRatePercentage: 0,
    totalRequestsCount: 0,
    memoryUsageMb: 0,
    cpuUsagePercentage: 0,
    activeThreads: 0,
    databaseQueriesMs: 0
  });

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [serviceFilter, setServiceFilter] = useState<string>("ALL");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);
  const [shouldCrash, setShouldCrash] = useState(false);

  const [redisActive, setRedisActive] = useState<boolean | null>(null);
  const [redisConfig, setRedisConfig] = useState<any>(null);
  const [redisFlushing, setRedisFlushing] = useState<boolean>(false);

  const [backups, setBackups] = useState<any[]>([]);
  const [pitrEnabled, setPitrEnabled] = useState<boolean>(true);
  const [loadingBackups, setLoadingBackups] = useState<boolean>(false);
  const [triggeringBackup, setTriggeringBackup] = useState<boolean>(false);
  const [togglingPitr, setTogglingPitr] = useState<boolean>(false);
  const [showRunbookModal, setShowRunbookModal] = useState<boolean>(false);

  if (shouldCrash) {
    throw new Error("Simulated React Boundary Crash: Master billing render tree loop overflowed. (सिम्युलेटेड रिएक्ट रेंडर क्रैश)");
  }

  const fetchBackups = async (silent = false) => {
    if (!silent) setLoadingBackups(true);
    try {
      const res = await fetch("/api/monitoring/backups");
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups || []);
        setPitrEnabled(data.pitrEnabled);
      }
    } catch (err) {
      console.error("Failed to fetch backups:", err);
    } finally {
      if (!silent) setLoadingBackups(false);
    }
  };

  const handleTriggerBackup = async () => {
    setTriggeringBackup(true);
    try {
      const res = await fetch("/api/monitoring/backups/trigger", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Database snapshot compiled and verified successfully!");
        fetchBackups(true);
        fetchTelemetryData(true);
      } else {
        alert("Failed to trigger backup: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error triggering database backup: " + err.message);
    } finally {
      setTriggeringBackup(false);
    }
  };

  const handleTogglePitr = async (enabled: boolean) => {
    setTogglingPitr(true);
    try {
      const res = await fetch("/api/monitoring/backups/toggle-pitr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (data.success) {
        setPitrEnabled(enabled);
        alert(`Supabase Point-in-Time Recovery (PITR) configuration successfully ${enabled ? "enabled" : "disabled"}!`);
        fetchBackups(true);
        fetchTelemetryData(true);
      } else {
        alert("Failed to configure PITR: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error updating PITR settings: " + err.message);
    } finally {
      setTogglingPitr(false);
    }
  };

  const fetchRedisStatus = async () => {
    try {
      const res = await fetch("/api/monitoring/redis-status");
      const data = await res.json();
      if (data.success) {
        setRedisActive(data.active);
        setRedisConfig(data.config);
      }
    } catch (err) {
      console.error("Failed to fetch Redis status:", err);
    }
  };

  const handleRedisFlush = async () => {
    if (!window.confirm("Are you sure you want to completely flush the Redis cache? This will evict all currently cached settings, menu items, and table rows across all tenants, forcing fresh Supabase fetches on the next requests.")) return;
    setRedisFlushing(true);
    try {
      const res = await fetch("/api/monitoring/redis-flush", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("Redis cache flushed successfully!");
        fetchRedisStatus();
      } else {
        alert("Failed to flush Redis: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error flushing Redis cache: " + err.message);
    } finally {
      setRedisFlushing(false);
    }
  };

  const fetchTelemetryData = async (silent = false) => {
    if (!isLiveStreaming && silent) return;
    if (!silent) setSyncing(true);
    try {
      const res = await fetch("/api/monitoring/telemetry");
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Failed to sync system telemetry:", err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchTelemetryData();
    fetchRedisStatus();
    fetchBackups();
    const interval = setInterval(() => {
      fetchTelemetryData(true);
      fetchRedisStatus();
      fetchBackups(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to completely purge the system telemetry logs? This will wipe the monitoring history.")) return;
    try {
      setSyncing(true);
      const res = await fetch("/api/monitoring/clear", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setLogs([]);
        fetchTelemetryData(true);
      }
    } catch (err) {
      console.error("Wiping logs failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleSimulateEvent = async (type: string) => {
    setSimulationStatus(`Triggering simulated ${type}...`);
    try {
      const res = await fetch("/api/monitoring/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type })
      });
      const data = await res.json();
      if (data.success) {
        setSimulationStatus(`Success: Simulated event of type '${type}' logged.`);
        setTimeout(() => setSimulationStatus(null), 3000);
        fetchTelemetryData(true);
      }
    } catch (err) {
      console.error("Simulating log failed:", err);
      setSimulationStatus("Error triggering simulation.");
    }
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  // Extract distinct services for filtering dropdown
  const services = ["ALL", ...Array.from(new Set(logs.map(l => l.service)))];

  // Filtering logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.context && JSON.stringify(log.context).toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesLevel = levelFilter === "ALL" || log.level === levelFilter;
    const matchesService = serviceFilter === "ALL" || log.service === serviceFilter;

    return matchesSearch && matchesLevel && matchesService;
  });

  const getLevelStyles = (level: string) => {
    switch (level) {
      case "ERROR":
        return {
          bg: "bg-rose-50 border-rose-200 text-rose-700",
          badge: "bg-rose-100 text-rose-800 border-rose-200",
          icon: <AlertOctagon className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
        };
      case "WARN":
        return {
          bg: "bg-amber-50 border-amber-200 text-amber-700",
          badge: "bg-amber-100 text-amber-800 border-amber-200",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        };
      case "METRIC":
        return {
          bg: "bg-purple-50 border-purple-200 text-purple-700",
          badge: "bg-purple-100 text-purple-800 border-purple-200",
          icon: <Activity className="w-3.5 h-3.5 text-purple-600" />
        };
      case "DEBUG":
        return {
          bg: "bg-slate-50 border-slate-200 text-slate-700",
          badge: "bg-slate-200 text-slate-800 border-slate-300",
          icon: <Terminal className="w-3.5 h-3.5 text-slate-500" />
        };
      default: // INFO
        return {
          bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
          badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
          icon: <Info className="w-3.5 h-3.5 text-emerald-600" />
        };
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="font-semibold text-slate-700 text-sm">Initializing Telemetry Engine...</p>
        <p className="text-xs text-slate-400 mt-1">Establishing high-contrast monitoring probes...</p>
      </div>
    );
  }

  return (
    <div className="h-full p-4 sm:p-6 bg-[#f8fafc] overflow-y-auto space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-500 animate-pulse" />
            Centralized Application Telemetry & Logging
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time server logging pipelines, live response profiling, system resource health telemetry, and diagnostic logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Pause / Resume stream toggle */}
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
              isLiveStreaming
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {isLiveStreaming ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Live Streaming</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Stream Paused</span>
              </>
            )}
          </button>

          <button
            onClick={() => fetchTelemetryData(false)}
            disabled={syncing}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-sm flex items-center gap-1.5 text-xs font-bold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-indigo-600" : ""}`} />
            <span>Force Refresh</span>
          </button>

          <button
            onClick={handleClearLogs}
            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* METRICS & APM ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Latency Average */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Avg API Latency</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5 font-mono">
              {metrics.apiLatencyAverageMs}ms
            </h3>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  metrics.apiLatencyAverageMs > 200 ? "bg-rose-500" : metrics.apiLatencyAverageMs > 100 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, (metrics.apiLatencyAverageMs / 400) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-medium">Underlying DB queries: <strong className="font-mono">{metrics.databaseQueriesMs}ms</strong></p>
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Error rate (Last 100)</p>
            <h3 className={`text-xl font-bold mt-0.5 font-mono ${metrics.errorRatePercentage > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {metrics.errorRatePercentage}%
            </h3>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  metrics.errorRatePercentage > 15 ? "bg-rose-500" : metrics.errorRatePercentage > 5 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, metrics.errorRatePercentage * 5)}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-medium">Total registered requests: <strong className="font-mono">{metrics.totalRequestsCount}</strong></p>
          </div>
        </div>

        {/* Host Memory RSS footprint */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Server className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Node Host Memory RSS</p>
            <h3 className="text-xl font-bold text-indigo-700 mt-0.5 font-mono">
              {metrics.memoryUsageMb} MB
            </h3>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (metrics.memoryUsageMb / 512) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-medium">Process execution boundaries</p>
          </div>
        </div>

        {/* CPU Workload */}
        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Cpu className="w-6 h-6 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Simulated CPU Load</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5 font-mono">
              {metrics.cpuUsagePercentage}%
            </h3>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${metrics.cpuUsagePercentage}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-medium">Active Worker threads: <strong className="font-mono">{metrics.activeThreads}</strong></p>
          </div>
        </div>

      </div>

      {/* COMPACT INTERACTIVE TESTBED & LOG SIMULATOR */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-500" />
              Developer Diagnostic Simulation Testbed
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Instantly fire mock server events, DB delays, and low inventory locks to verify central alerting pathways in real-time.
            </p>
          </div>

          {simulationStatus && (
            <span className="text-[11px] bg-slate-100 text-slate-700 px-3 py-1 rounded-lg border border-slate-200 font-mono font-bold animate-pulse">
              {simulationStatus}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          
          <button
            onClick={() => handleSimulateEvent("error_exception")}
            className="p-3 bg-rose-50/50 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded-xl text-left transition space-y-1 group cursor-pointer"
          >
            <span className="p-1 bg-rose-100 text-rose-700 rounded-lg inline-block text-xs font-bold mb-1">
              ERROR
            </span>
            <p className="text-xs font-bold text-slate-700">Billing Fault</p>
            <p className="text-[10px] text-slate-400 leading-tight font-medium">Fires checkout timeout exceptions.</p>
          </button>

          <button
            onClick={() => handleSimulateEvent("warn_inventory")}
            className="p-3 bg-amber-50/50 hover:bg-amber-50 border border-amber-200 hover:border-amber-300 rounded-xl text-left transition space-y-1 group cursor-pointer"
          >
            <span className="p-1 bg-amber-100 text-amber-700 rounded-lg inline-block text-xs font-bold mb-1">
              WARN
            </span>
            <p className="text-xs font-bold text-slate-700">Stock Threshold</p>
            <p className="text-[10px] text-slate-400 leading-tight font-medium">Fires low inventory level warnings.</p>
          </button>

          <button
            onClick={() => handleSimulateEvent("db_slow_query")}
            className="p-3 bg-purple-50/50 hover:bg-purple-50 border border-purple-200 hover:border-purple-300 rounded-xl text-left transition space-y-1 group cursor-pointer"
          >
            <span className="p-1 bg-purple-100 text-purple-700 rounded-lg inline-block text-xs font-bold mb-1">
              SLOW QUERY
            </span>
            <p className="text-xs font-bold text-slate-700">SQL Profiler</p>
            <p className="text-[10px] text-slate-400 leading-tight font-medium">Triggers mock 850ms database locks.</p>
          </button>

          <button
            onClick={() => handleSimulateEvent("info_event")}
            className="p-3 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200 hover:border-emerald-300 rounded-xl text-left transition space-y-1 group cursor-pointer"
          >
            <span className="p-1 bg-emerald-100 text-emerald-700 rounded-lg inline-block text-xs font-bold mb-1">
              INFO
            </span>
            <p className="text-xs font-bold text-slate-700">Sync Pipeline</p>
            <p className="text-[10px] text-slate-400 leading-tight font-medium">Performs batch synchronization runs.</p>
          </button>

          <button
            onClick={() => handleSimulateEvent("metric_report")}
            className="p-3 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-300 rounded-xl text-left transition space-y-1 group cursor-pointer"
          >
            <span className="p-1 bg-indigo-100 text-indigo-700 rounded-lg inline-block text-xs font-bold mb-1">
              METRIC
            </span>
            <p className="text-xs font-bold text-slate-700">LLM Reports</p>
            <p className="text-[10px] text-slate-400 leading-tight font-medium">Logs token metrics & compute cost limits.</p>
          </button>

          <button
            onClick={() => {
              if (confirm("This will intentionally trigger an unhandled JS render crash. The React Error Boundary should catch it and show the recovery dashboard. Continue?")) {
                setShouldCrash(true);
              }
            }}
            className="p-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 rounded-xl text-left transition space-y-1 group cursor-pointer"
          >
            <span className="p-1 bg-red-600 text-white rounded-lg inline-block text-[9px] font-extrabold mb-1 px-1.5 uppercase tracking-wide">
              REACT BOUNDARY
            </span>
            <p className="text-xs font-black text-slate-800">Trigger React Crash</p>
            <p className="text-[10px] text-slate-500 leading-tight">Force-crashes React render to test ErrorBoundary.</p>
          </button>

          <button
            onClick={() => {
              setSimulationStatus("Dispatching unhandled async rejection...");
              Promise.reject(new Error("Simulated Sentry Unhandled Promise Rejection: API Request for /api/v1/billing-status timed out (असिंक्रोनस रिजेक्शन)"));
              setTimeout(() => {
                setSimulationStatus("Async exception dispatched to window event listener.");
                setTimeout(() => setSimulationStatus(null), 3000);
                fetchTelemetryData(true);
              }, 500);
            }}
            className="p-3 bg-pink-500/5 hover:bg-pink-500/10 border border-pink-500/20 hover:border-pink-500/40 rounded-xl text-left transition space-y-1 group cursor-pointer"
          >
            <span className="p-1 bg-pink-600 text-white rounded-lg inline-block text-[9px] font-extrabold mb-1 px-1.5 uppercase tracking-wide">
              ASYNC ERROR
            </span>
            <p className="text-xs font-black text-slate-800">Trigger Async Error</p>
            <p className="text-[10px] text-slate-500 leading-tight">Fires unhandled window rejection caught by Sentry.</p>
          </button>

        </div>
      </div>

      {/* REDIS CACHING LAYER CONTROLLER */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500 animate-pulse" />
            Distributed Redis Caching Layer
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time status of the high-speed cache layer designed to scale reads, safeguard Supabase limits, and minimize POS response latencies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cache Status Badge Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Redis Status</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2.5 h-2.5 rounded-full ${redisActive ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
                <span className={`text-xs font-bold ${redisActive ? "text-emerald-700" : "text-slate-600"}`}>
                  {redisActive === null ? "Detecting..." : redisActive ? "ACTIVE & CONNECTED" : "DISABLED / BYPASS"}
                </span>
              </div>
            </div>
            {redisActive ? (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">Online</span>
            ) : (
              <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded border border-slate-200">Fallback Mode</span>
            )}
          </div>

          {/* Configuration Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Configured Host</p>
            <p className="text-xs font-mono mt-1 text-slate-700 font-semibold">
              {redisConfig ? `${redisConfig.host}:${redisConfig.port}` : "localhost:6379"}
            </p>
            <div className="flex gap-2 mt-1.5">
              <span className="text-[9px] bg-slate-200 text-slate-600 px-1 rounded">
                URL: {redisConfig?.hasUrl ? "Yes" : "No"}
              </span>
              <span className="text-[9px] bg-slate-200 text-slate-600 px-1 rounded">
                AUTH: {redisConfig?.hasPassword ? "Yes" : "No"}
              </span>
            </div>
          </div>

          {/* Action Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Cache Control</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Force eviction of all cached database reads and configs.
              </p>
            </div>
            <button
              onClick={handleRedisFlush}
              disabled={redisFlushing || !redisActive}
              className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-400 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${redisFlushing ? "animate-spin" : ""}`} />
              Flush Cache
            </button>
          </div>
        </div>

        {/* Informative Cache Target Indicators */}
        <div className="bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100/50 text-xs text-indigo-950 space-y-2">
          <p className="font-bold text-[11px] flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            🎯 Active Cache Targets in VeggiePOS Routing:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
            <div className="bg-white p-2 rounded-lg border border-indigo-100/60 flex items-center justify-between">
              <span className="font-semibold text-slate-700">🍔 Menu Items Slice</span>
              <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold text-[9px] border border-emerald-100">3600s TTL</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-indigo-100/60 flex items-center justify-between">
              <span className="font-semibold text-slate-700">⚙️ Restaurant Settings</span>
              <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold text-[9px] border border-emerald-100">3600s TTL</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-indigo-100/60 flex items-center justify-between">
              <span className="font-semibold text-slate-700">🥗 Recipes & Ingredients</span>
              <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold text-[9px] border border-emerald-100">3600s TTL</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-indigo-100/60 flex items-center justify-between">
              <span className="font-semibold text-slate-700">📋 Shifts & Staff Rosters</span>
              <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-bold text-[9px] border border-emerald-100">3600s TTL</span>
            </div>
          </div>
        </div>
      </div>

      {/* DATABASE BACKUPS & DISASTER RECOVERY PANEL */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500 animate-pulse" />
              Database Backups & Point-in-Time Recovery (PITR)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated database snapshots, continuous WAL backup coverage, and disaster recovery validation tools.
            </p>
          </div>
          <button
            onClick={() => setShowRunbookModal(true)}
            className="self-start sm:self-auto py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg shadow-sm border border-rose-100 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            DR Recovery Runbook (डिजास्टर रिकवरी)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* PITR Status Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-2">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Supabase PITR Status</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2.5 h-2.5 rounded-full ${pitrEnabled ? "bg-emerald-500 animate-ping" : "bg-rose-400 animate-pulse"}`} />
                <span className={`text-xs font-bold ${pitrEnabled ? "text-emerald-700" : "text-rose-700"}`}>
                  {pitrEnabled ? "ACTIVE & CONTINUOUS" : "WARNING: DISABLED"}
                </span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">
                {pitrEnabled 
                  ? "WAL continuous streams are backup-secured to S3. RPO is < 1 minute."
                  : "Continuous WAL archiving paused. Please enable to secure < 1m RPO."}
              </p>
            </div>
            <button
              onClick={() => handleTogglePitr(!pitrEnabled)}
              disabled={togglingPitr}
              className={`w-full py-1.5 px-3 text-xs font-bold rounded-lg border transition cursor-pointer text-center ${
                pitrEnabled 
                  ? "bg-white hover:bg-slate-100 text-slate-700 border-slate-200" 
                  : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
              }`}
            >
              {togglingPitr ? "Updating PITR..." : pitrEnabled ? "Disable PITR Coverage" : "Enable PITR Coverage"}
            </button>
          </div>

          {/* Backup Frequency Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-2">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Automated Frequency</p>
              <p className="text-xs font-semibold text-slate-700 mt-1">Daily Core Snapshots</p>
              <p className="text-[9px] text-slate-400 mt-1">
                Automatic daily snapshot job runs every 4 minutes (simulated interval for audit and inspection verification).
              </p>
            </div>
            <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] text-slate-500 flex justify-between items-center font-mono">
              <span>Next Sync Job:</span>
              <span className="font-bold text-indigo-600">In 4 mins</span>
            </div>
          </div>

          {/* Manual Snapshot Control */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-2">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Manual Snapshots</p>
              <p className="text-xs font-semibold text-slate-700 mt-1">On-Demand Snapshot</p>
              <p className="text-[9px] text-slate-400 mt-1">
                Instantly capture and pack restaurant table states (settings, ingredients, orders, customer records).
              </p>
            </div>
            <button
              onClick={handleTriggerBackup}
              disabled={triggeringBackup}
              className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-400 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${triggeringBackup ? "animate-spin" : ""}`} />
              {triggeringBackup ? "Compiling Snapshot..." : "Trigger Manual Snapshot"}
            </button>
          </div>
        </div>

        {/* Snapshot History Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Historical Snapshot Database Archive</span>
            <span className="text-[10px] text-slate-400">Showing last {backups.length} snapshots • Retention: 30 days</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[190px] overflow-y-auto">
            {loadingBackups ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading snapshot registry...</div>
            ) : backups.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No snapshots found. Run manual backup to initialize.</div>
            ) : (
              backups.map((b) => (
                <div key={b.id} className="p-3 text-xs hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700">{b.id}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                        b.status === "success" 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                          : "bg-rose-50 text-rose-700 border border-rose-100"
                      }`}>
                        {b.status === "success" ? "Verified" : "Failed"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{(b.sizeBytes / 1024).toFixed(2)} KB</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium flex flex-wrap gap-x-2.5 gap-y-1 items-center">
                      <span className="text-slate-400">Slices:</span>
                      <span className="bg-slate-100 text-slate-700 px-1 rounded">🍔 {b.recordCounts?.menuItems || 0} Menu Items</span>
                      <span className="bg-slate-100 text-slate-700 px-1 rounded">🥗 {b.recordCounts?.ingredients || 0} Ingredients</span>
                      <span className="bg-slate-100 text-slate-700 px-1 rounded">📋 {b.recordCounts?.orders || 0} Orders</span>
                      <span className="bg-slate-100 text-slate-700 px-1 rounded">👥 {b.recordCounts?.customers || 0} Customers</span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-start sm:items-end gap-1 font-mono text-[9px] text-slate-400">
                    <div className="text-slate-500 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {new Date(b.timestamp).toLocaleString()}
                    </div>
                    <div className="bg-slate-50 border border-slate-100 text-[8px] text-slate-500 px-1 rounded max-w-[200px] truncate">
                      {b.checksum}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* DISASTER RECOVERY RUNBOOK DIALOG MODAL */}
      {showRunbookModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-500 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight">VeggiePOS Disaster Recovery Runbook</h3>
                  <p className="text-[10px] text-slate-400 font-mono">SUPABASE PITR & RECOVERY OPERATIONS</p>
                </div>
              </div>
              <button
                onClick={() => setShowRunbookModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed">
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-rose-950 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
                  🚨 CRITICAL DISASTER RESPONSE MATRIX: 'Agar DB Corrupt Ho Jaye'
                </p>
                <p>
                  Database damage, accidental execution of catastrophic scripts, or server blackout requires immediate active intervention. Follow this runbook step-by-step.
                </p>
              </div>

              {/* Recovery Objective Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="font-bold text-slate-800">🎯 Recovery Point Objective (RPO)</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    <strong>&lt; 1 Minute</strong>. With PITR active, continuous Write-Ahead Logs (WAL) are streamed to secure S3 storage. Virtually zero data loss.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="font-bold text-slate-800">⚡ Recovery Time Objective (RTO)</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    <strong>&lt; 15 Minutes</strong>. Expected duration to provision parallel DB snapshot instance, replay transaction logs, and live-swap.
                  </p>
                </div>
              </div>

              {/* Restoration Protocols */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  Step 1: Put Application in Traffic Pause / Maintenance
                </h4>
                <p>
                  To prevent corrupted database writes or inconsistent client transactions during rollback, change Cloud Run environment variable <code>MAINTENANCE_MODE=true</code> immediately.
                </p>

                <h4 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  Step 2: Execute Point-in-Time Restoration
                </h4>
                
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="font-semibold text-slate-800">Option A: Via Supabase Dashboard (Recommended)</p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                    <li>Log in to <strong>Supabase Dashboard</strong> &rarr; Select <strong>VeggiePOS</strong> project.</li>
                    <li>Go to <strong>Settings ⚙️</strong> &rarr; <strong>Database</strong> &rarr; scroll to <strong>Backups</strong>.</li>
                    <li>Click <strong>Point in Time Restore</strong>.</li>
                    <li>Enter target safe timestamp immediately before corruption (e.g. <code>2026-07-04 10:14:55</code>).</li>
                    <li>Click <strong>Initiate Restore</strong> and wait 8-12 minutes for sync.</li>
                  </ol>
                </div>

                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="font-semibold text-slate-800">Option B: Via Supabase CLI Terminal</p>
                  <pre className="bg-slate-900 text-slate-200 p-2.5 rounded-lg text-[10px] font-mono whitespace-pre-wrap overflow-x-auto leading-normal">
                    {`# 1. Login & link project ID\nsupabase login\nsupabase link --project-ref "bpswhanfafmz2n4uhirm2r"\n\n# 2. Run db restore directly to target timestamp\nsupabase db restore --project-ref "bpswhanfafmz2n4uhirm2r" --timestamp "2026-07-04T10:14:55Z"`}
                  </pre>
                </div>

                <h4 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  Step 3: Post-Restoration verification & Cache Purging
                </h4>
                <p>
                  Once database reports "Online", click <strong>"Flush Cache"</strong> inside the monitoring panel or run <code>redis-cli FLUSHDB</code>. This clears the high-speed Redis layer, evicting any cached corrupted records and fetching fresh restored PostgreSQL snapshots.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowRunbookModal(false)}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close Runbook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CENTRAL LOG VIEWER & SEARCH */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        
        {/* LOG VIEWER CONTROLS */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-emerald-500" />
              Unified Structured Logs Stream
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Showing <strong className="text-slate-600">{filteredLogs.length}</strong> of {logs.length} telemetry records matching filter rules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial min-w-[200px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search error messages, logs, payloads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold text-slate-700"
              />
            </div>

            {/* Level Filter */}
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:border-indigo-500 outline-none"
            >
              <option value="ALL">All Levels</option>
              <option value="INFO">INFO Only</option>
              <option value="WARN">WARN Only</option>
              <option value="ERROR">ERROR Only</option>
              <option value="METRIC">METRIC Only</option>
            </select>

            {/* Service Filter */}
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:border-indigo-500 outline-none"
            >
              {services.map(srv => (
                <option key={srv} value={srv}>
                  {srv === "ALL" ? "All Services" : srv}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* LOG GRID */}
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <Terminal className="w-8 h-8 text-slate-300 animate-pulse" />
            <p className="font-bold text-slate-600 text-xs">No Matching Telemetry Records Found</p>
            <p className="text-[11px] text-slate-400 max-w-sm">
              Try removing filter constraints, typing another search term, or trigger simulated failures from the diagnostic testbed panel!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 font-mono text-[11px]">
            
            {/* Table Headers */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-3 p-3 bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase text-[9px] tracking-wider">
              <div className="col-span-2">Timestamp</div>
              <div className="col-span-1.5">Level</div>
              <div className="col-span-2">Source Service</div>
              <div className="col-span-5.5">Log Statement Message</div>
              <div className="col-span-1 text-right">Performance</div>
            </div>

            {filteredLogs.map((log) => {
              const styles = getLevelStyles(log.level);
              const isExpanded = expandedLogId === log.id;

              return (
                <div key={log.id} className="transition hover:bg-slate-50/50">
                  <div
                    onClick={() => toggleExpandLog(log.id)}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 items-center cursor-pointer select-none"
                  >
                    {/* Timestamp */}
                    <div className="col-span-2 text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-300" />
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className="text-[9px] text-slate-300 font-light truncate">
                        .{new Date(log.timestamp).getMilliseconds().toString().padStart(3, "0")}
                      </span>
                    </div>

                    {/* Level */}
                    <div className="col-span-1.5 flex items-center">
                      <span className={`px-2 py-0.5 border rounded-full text-[9px] font-extrabold flex items-center gap-1 ${styles.badge}`}>
                        {styles.icon}
                        {log.level}
                      </span>
                    </div>

                    {/* Service */}
                    <div className="col-span-2 text-slate-600 font-bold text-[10.5px]">
                      {log.service}
                    </div>

                    {/* Message */}
                    <div className="col-span-5.5 text-slate-800 break-words flex items-center gap-2">
                      <span className="font-semibold">{log.message}</span>
                      {log.context && Object.keys(log.context).length > 0 && (
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-400 text-[9px] font-bold rounded hover:bg-slate-200">
                          {isExpanded ? "Hide Payloads" : "Inspect Payload"}
                        </span>
                      )}
                    </div>

                    {/* Performance MS indicator */}
                    <div className="col-span-1 text-right flex items-center justify-end gap-1 font-bold">
                      {log.durationMs !== undefined ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          log.durationMs > 500
                            ? "bg-rose-50 text-rose-700 font-extrabold"
                            : log.durationMs > 100
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {log.durationMs}ms
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}

                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </div>

                  </div>

                  {/* Expanded Payload Inspector Drawer */}
                  {isExpanded && (
                    <div className="px-5 py-4 bg-slate-900 text-slate-300 border-t border-b border-slate-950 font-mono text-[10.5px] space-y-3 shadow-inner">
                      
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                          <Layers className="w-3 h-3 text-indigo-400" />
                          Payload Structured Metadata Context (Log ID: {log.id})
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold italic">
                          Type: JSON Object Mapping
                        </span>
                      </div>

                      {log.context && Object.keys(log.context).length > 0 ? (
                        <pre className="overflow-x-auto p-3 bg-slate-950 text-emerald-400 rounded-lg border border-slate-800/80 leading-relaxed font-semibold">
                          {JSON.stringify(log.context, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-slate-500 italic">No additional metadata parameters recorded with this telemetry block.</p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1.5 text-[10px] text-slate-500">
                        <div>
                          <strong>Logging Facility:</strong> <span className="text-slate-400 font-mono">{log.service}</span>
                        </div>
                        <div>
                          <strong>UTC Timestamp:</strong> <span className="text-slate-400 font-mono">{log.timestamp}</span>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              );
            })}

          </div>
        )}

      </div>

    </div>
  );
}
