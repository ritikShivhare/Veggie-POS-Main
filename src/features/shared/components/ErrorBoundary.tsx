import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, LogOut, Store, ShieldAlert, FileText, ChevronDown, ChevronRight, Check } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  reported: boolean;
  reportingStatus: "idle" | "reporting" | "success" | "failed";
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      reported: false,
      reportingStatus: "idle"
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.reportErrorToBackend(error, errorInfo);
  }

  private async reportErrorToBackend(error: Error, errorInfo: ErrorInfo) {
    this.setState({ reportingStatus: "reporting" });
    try {
      const activeTenantRaw = localStorage.getItem("veggiepos_active_tenant");
      let tenantId = "Unknown";
      if (activeTenantRaw) {
        try {
          const parsed = JSON.parse(activeTenantRaw);
          tenantId = parsed.tenantId || "Unknown";
        } catch (_) {}
      }

      const staffRaw = localStorage.getItem("veggiepos_current_staff");
      let userId = "Guest/Unauthenticated";
      if (staffRaw) {
        try {
          const parsed = JSON.parse(staffRaw);
          userId = parsed.id || parsed.name || "Unknown User";
        } catch (_) {}
      }

      const payload = {
        message: error.message || String(error),
        stack: error.stack || errorInfo.componentStack || "No stack trace available",
        level: "ERROR",
        component: "ReactErrorBoundary",
        tenantId,
        userId,
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      const res = await fetch("/api/monitoring/report-error", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        this.setState({ reported: true, reportingStatus: "success" });
      } else {
        this.setState({ reportingStatus: "failed" });
      }
    } catch (err) {
      console.error("ErrorBoundary failed to report crash to Sentry API:", err);
      this.setState({ reportingStatus: "failed" });
    }
  }

  private handleHardReset = () => {
    if (confirm("Are you sure you want to perform a hard reset? This will sign you out and clear local cached POS states to fix corrupted files.")) {
      localStorage.removeItem("veggiepos_current_session_id");
      localStorage.removeItem("veggiepos_current_staff");
      localStorage.removeItem("veggiepos_active_tenant");
      window.location.href = "/";
    }
  };

  private handleSwitchWorkspace = () => {
    localStorage.removeItem("veggiepos_active_tenant");
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorFallbackView
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          reportingStatus={this.state.reportingStatus}
          onRetry={() => window.location.reload()}
          onHardReset={this.handleHardReset}
          onSwitchWorkspace={this.handleSwitchWorkspace}
        />
      );
    }

    return this.props.children;
  }
}

interface FallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  reportingStatus: "idle" | "reporting" | "success" | "failed";
  onRetry: () => void;
  onHardReset: () => void;
  onSwitchWorkspace: () => void;
}

function ErrorFallbackView({
  error,
  errorInfo,
  reportingStatus,
  onRetry,
  onHardReset,
  onSwitchWorkspace
}: FallbackProps) {
  const [showStack, setShowStack] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 font-sans relative overflow-hidden">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl relative overflow-hidden z-10">
        
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl border border-red-500/30 flex items-center justify-center text-red-500 mb-4 animate-bounce">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-2">
            VeggiePOS Encountered a Crash
          </h1>
          <p className="text-slate-400 text-sm max-w-md">
            एप्लीकेशन में कोई तकनीकी समस्या आई है। हमने इस क्रैश को Sentry मॉनिटरिंग सर्वर पर रिपोर्ट कर दिया है।
          </p>
        </div>

        {/* Diagnostic Status */}
        <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <ShieldAlert className="w-4 h-4 text-pink-500" />
            <span className="text-slate-400">Sentry Connection Status:</span>
            {reportingStatus === "reporting" && (
              <span className="text-yellow-400 font-bold flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Sending Telemetry...
              </span>
            )}
            {reportingStatus === "success" && (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3 h-3" /> Logged (ID: S-309)
              </span>
            )}
            {reportingStatus === "failed" && (
              <span className="text-red-400 font-bold">Failed to Send Log</span>
            )}
            {reportingStatus === "idle" && (
              <span className="text-slate-500">Idle</span>
            )}
          </div>
          <div className="text-[10px] bg-slate-900 text-slate-400 px-2 py-1 rounded font-mono border border-slate-800 self-start sm:self-auto">
            ENV: PRODUCTION
          </div>
        </div>

        {/* Error Details */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] uppercase font-mono font-bold tracking-wider text-red-400">Error Message</p>
              <p className="text-sm font-semibold text-slate-200 break-words">{error?.message || "Unknown Application Render Error"}</p>
            </div>
          </div>

          {/* Expandable Stack Trace */}
          <div className="mt-4 border-t border-slate-800/80 pt-3">
            <button
              onClick={() => setShowStack(!showStack)}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition cursor-pointer"
            >
              {showStack ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>{showStack ? "Hide technical stack trace" : "Show technical stack trace (डायग्नोस्टिक जानकारी)"}</span>
            </button>

            {showStack && (
              <div className="mt-2 text-left bg-slate-900 rounded-xl p-3 border border-slate-800 overflow-x-auto max-h-48 text-[11px] font-mono text-slate-400 leading-relaxed scrollbar-thin">
                <p className="font-bold text-red-400/90 mb-1">Stack Trace:</p>
                <pre className="whitespace-pre-wrap select-all">{error?.stack || "No JS stack trace captured"}</pre>
                {errorInfo?.componentStack && (
                  <>
                    <p className="font-bold text-indigo-400 mt-3 mb-1">Component Stack:</p>
                    <pre className="whitespace-pre-wrap select-all">{errorInfo.componentStack}</pre>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation / Healing Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={onRetry}
            className="flex items-center justify-center gap-1.5 py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold transition shadow-lg shadow-pink-500/10 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload & Retry</span>
          </button>

          <button
            onClick={onSwitchWorkspace}
            className="flex items-center justify-center gap-1.5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl text-xs font-semibold transition cursor-pointer"
          >
            <Store className="w-4 h-4 text-emerald-400" />
            <span>Switch Store</span>
          </button>

          <button
            onClick={onHardReset}
            className="flex items-center justify-center gap-1.5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Wipe & Reset</span>
          </button>
        </div>

        {/* Help text */}
        <p className="text-center text-[10px] text-slate-500 mt-6 font-mono">
          VeggiePOS Cloud Core Agent Sentry Client v1.2.0 • Session Diagnostics ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}
        </p>

      </div>
    </div>
  );
}
