import React, { useState, useEffect } from "react";
import {
  Cpu,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Trash2,
  Filter,
  ChevronDown,
  ChevronUp,
  Activity,
  ToggleLeft,
  ToggleRight,
  Info
} from "lucide-react";

interface BackgroundJob {
  id: string;
  type: string;
  name: string;
  description: string;
  schedule: string;
  intervalMs: number;
  lastRun: string | null;
  nextRun: string;
  status: "idle" | "running" | "success" | "failed";
  enabled: boolean;
}

interface JobLog {
  id: string;
  jobId: string;
  jobName: string;
  timestamp: string;
  status: "success" | "failed";
  message: string;
  details: any;
}

export default function BackgroundJobsDashboard() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [triggeringJobId, setTriggeringJobId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "success" | "failed">("all");
  const [selectedJobId, setSelectedJobId] = useState<string>("all");

  const fetchJobsAndLogs = async (showPulse = false) => {
    if (showPulse) setRefreshing(true);
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs || []);
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Error fetching background jobs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobsAndLogs();
    // Auto-refresh every 10 seconds for real-time live monitoring feel
    const interval = setInterval(() => fetchJobsAndLogs(), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerJob = async (jobId: string) => {
    setTriggeringJobId(jobId);
    try {
      const res = await fetch("/api/jobs/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh immediately after trigger completes
        await fetchJobsAndLogs();
      } else {
        alert(data.message || "Could not trigger job");
      }
    } catch (err) {
      console.error("Error triggering job:", err);
    } finally {
      setTriggeringJobId(null);
    }
  };

  const handleToggleJob = async (jobId: string, currentEnabled: boolean) => {
    try {
      const res = await fetch("/api/jobs/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, enabled: !currentEnabled }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh
        await fetchJobsAndLogs();
      }
    } catch (err) {
      console.error("Error toggling job state:", err);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear all background execution logs?")) return;
    try {
      const res = await fetch("/api/jobs/clear-logs", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setLogs([]);
      }
    } catch (err) {
      console.error("Error clearing logs:", err);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterType === "success" && log.status !== "success") return false;
    if (filterType === "failed" && log.status !== "failed") return false;
    if (selectedJobId !== "all" && log.jobId !== selectedJobId) return false;
    return true;
  });

  const activeJobsCount = jobs.filter((j) => j.enabled).length;
  const lastExecutedLog = logs[0] || null;

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
        <div className="w-10 h-10 border-4 border-pink-500/20 border-t-pink-600 rounded-full animate-spin mb-4" />
        <p className="font-semibold text-slate-700 text-sm">Background Jobs System loading...</p>
        <p className="text-xs text-slate-400 mt-1">Interrogating scheduler registry and retrieving execution logs...</p>
      </div>
    );
  }

  return (
    <div className="h-full p-4 sm:p-6 bg-[#f8fafc] overflow-y-auto space-y-6">
      
      {/* TITLE & METRICS ROW */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-pink-600" />
            Background Jobs Control Room
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time scheduler interface for micro-services, automated compliance, and background customer campaigns.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchJobsAndLogs(true)}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-sm flex items-center gap-2 text-xs font-semibold cursor-pointer"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-pink-600" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Force Sync"}</span>
          </button>
        </div>
      </div>

      {/* OVERVIEW METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-pink-50 text-pink-600 rounded-lg">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Scheduler Status</p>
            <h3 className="text-base font-extrabold text-slate-800 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              <span>Active</span>
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Enabled Routines</p>
            <h3 className="text-base font-extrabold text-slate-800 mt-1">
              {activeJobsCount} / {jobs.length} Jobs
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Success Rate</p>
            <h3 className="text-base font-extrabold text-slate-800 mt-1">
              {logs.length > 0
                ? `${Math.round((logs.filter((l) => l.status === "success").length / logs.length) * 100)}%`
                : "100% (Idle)"}
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-50 text-slate-500 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Last Action Tick</p>
            <h3 className="text-xs font-bold text-slate-800 mt-1.5 font-mono truncate max-w-[170px]">
              {lastExecutedLog ? new Date(lastExecutedLog.timestamp).toLocaleTimeString() : "No ticks yet"}
            </h3>
          </div>
        </div>
      </div>

      {/* DETAILED ACTIVE SCHEDULER MATRIX */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-2">
            <Activity className="w-4.5 h-4.5 text-slate-500" />
            Registered Schedulers & Action Loops
          </h2>
          <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-mono text-slate-500">
            Node-Thread Native Background System
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {jobs.map((job) => {
            const isTriggering = triggeringJobId === job.id || job.status === "running";
            return (
              <div key={job.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/40 transition">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-slate-800 text-sm">{job.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      job.status === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                      job.status === "failed" ? "bg-rose-50 text-rose-700 border border-rose-100" :
                      job.status === "running" ? "bg-amber-50 text-amber-700 border border-amber-100 animate-pulse" :
                      "bg-slate-150 text-slate-600"
                    }`}>
                      {job.status}
                    </span>
                    {!job.enabled && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-400 border border-slate-200 rounded text-[10px] font-bold uppercase">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{job.description}</p>
                  
                  <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 pt-1 text-[11px] font-semibold text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-300" />
                      Interval: <strong className="text-slate-600">{job.schedule}</strong>
                    </span>
                    {job.lastRun && (
                      <span className="flex items-center gap-1">
                        Last Run: <strong className="text-slate-600 font-mono">{new Date(job.lastRun).toLocaleTimeString()}</strong>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      Next Scheduled: <strong className="text-pink-600/90 font-mono">{new Date(job.nextRun).toLocaleTimeString()}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-start lg:self-center">
                  {/* Enabled Toggle Switch */}
                  <button
                    onClick={() => handleToggleJob(job.id, job.enabled)}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold text-xs transition cursor-pointer"
                    title={job.enabled ? "Disable Scheduler" : "Enable Scheduler"}
                  >
                    {job.enabled ? (
                      <ToggleRight className="w-8 h-8 text-pink-600 cursor-pointer" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-300 cursor-pointer" />
                    )}
                    <span className="sr-only">Toggle Job State</span>
                  </button>

                  {/* Manual Trigger Button */}
                  <button
                    onClick={() => handleTriggerJob(job.id)}
                    disabled={isTriggering}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold text-xs rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {isTriggering ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{isTriggering ? "Running..." : "Run Now"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AUDIT TRACE LOGS SECTION */}
      <div className="bg-white border border-slate-200/85 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        
        {/* Header with Log Controls */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-slate-500" />
              Scheduler Execution Audit Log
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Deep system diagnosis records of the last 100 executions.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter buttons */}
            <div className="flex bg-slate-100 border border-slate-200/70 rounded-lg p-0.5">
              <button
                onClick={() => setFilterType("all")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                  filterType === "all" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType("success")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                  filterType === "success" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Success
              </button>
              <button
                onClick={() => setFilterType("failed")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                  filterType === "failed" ? "bg-white text-rose-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Failed
              </button>
            </div>

            {/* Job specific selection */}
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 focus:ring-1 focus:ring-pink-500 outline-none"
            >
              <option value="all">All Jobs</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>{job.name}</option>
              ))}
            </select>

            <button
              onClick={handleClearLogs}
              disabled={logs.length === 0}
              className="p-1.5 bg-rose-50 border border-rose-100/50 hover:bg-rose-100 text-rose-600 rounded-lg transition text-xs font-semibold cursor-pointer disabled:opacity-50"
              title="Clear Logs History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Logs table list */}
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Info className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-500 text-xs">No matching execution records found.</p>
            <p className="text-[10px] text-slate-400 max-w-xs mx-auto">Enable or trigger a job above to populate real execution audit logs.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/30 transition">
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="flex items-start justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${log.status === "success" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className="font-bold text-slate-800 text-xs">{log.jobName}</span>
                        <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 pl-3.5 leading-relaxed font-medium">
                        {log.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-600 shrink-0">
                      <span className="text-[9px] font-mono">{isExpanded ? "Collapse" : "Inspect"}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {isExpanded && log.details && (
                    <div className="mt-3 ml-3.5 p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto shadow-inner border border-slate-800">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                        <span>Payload & Exec Output Parameters</span>
                        <span className="text-pink-400">status: {log.status}</span>
                      </div>
                      <pre className="text-emerald-400 whitespace-pre-wrap">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
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
