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
    const interval = setInterval(() => fetchTelemetryData(true), 3000);
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

        </div>
      </div>

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
