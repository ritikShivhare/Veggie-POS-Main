import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './features/shared/components/ErrorBoundary.tsx';
import { ApiClient } from './features/shared/services/api.ts';
import './index.css';

// Global Fetch Interceptor for Anti-CSRF Protection:
// Automatically attaches client-controlled 'x-session-id' header to all internal API requests.
// External websites in other browser tabs cannot access this in-memory session or header.
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = "";
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input && typeof (input as Request).url === "string") {
    url = (input as Request).url;
  }

  const sessionId = ApiClient.getSessionId();
  if (sessionId && url && (url.startsWith("/api/") || url.startsWith("/api?") || url === "/api")) {
    if (input instanceof Request) {
      if (!input.headers.has("x-session-id")) {
        input.headers.set("x-session-id", sessionId);
      }
    } else {
      init = init ? { ...init } : {};
      const headers = new Headers(init.headers || {});
      if (!headers.has("x-session-id")) {
        headers.set("x-session-id", sessionId);
      }
      init.headers = headers;
    }
  }
  return originalFetch(input, init);
};

// Client-Side Centralized Sentry-like Telemetry listeners
window.addEventListener("error", (event) => {
  if (event.filename && (event.filename.includes("report-error") || event.filename.includes("telemetry"))) return;
  
  const message = event.message || "";
  const stack = event.error?.stack || "";
  if (
    message.toLowerCase().includes("websocket") ||
    message.toLowerCase().includes("vite") ||
    message.toLowerCase().includes("hmr") ||
    stack.toLowerCase().includes("websocket") ||
    stack.toLowerCase().includes("vite") ||
    stack.toLowerCase().includes("hmr")
  ) {
    return; // Ignore benign development-only environment and HMR websocket errors
  }

  let tenantId = "Unknown";
  try {
    const activeTenantRaw = localStorage.getItem("veggiepos_active_tenant");
    if (activeTenantRaw) {
      tenantId = JSON.parse(activeTenantRaw).tenantId || "Unknown";
    }
  } catch (_) {}

  let userId = "Guest/Unauthenticated";
  try {
    const staffRaw = localStorage.getItem("veggiepos_current_staff");
    if (staffRaw) {
      const parsed = JSON.parse(staffRaw);
      userId = parsed.id || parsed.name || "Unknown User";
    }
  } catch (_) {}

  const payload = {
    message: event.message || "Global Uncaught Client-Side Exception",
    stack: event.error?.stack || `Error at ${event.filename}:${event.lineno}:${event.colno}`,
    level: "ERROR",
    component: "ClientGlobalWindowListener",
    tenantId,
    userId,
    url: window.location.href,
    userAgent: navigator.userAgent
  };

  fetch("/api/monitoring/report-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(err => console.error("Failed to report global client error:", err));
});

window.addEventListener("unhandledrejection", (event) => {
  const reasonMessage = event.reason?.message || String(event.reason || "");
  const reasonStack = event.reason?.stack || "";
  if (
    reasonMessage.toLowerCase().includes("websocket") ||
    reasonMessage.toLowerCase().includes("vite") ||
    reasonMessage.toLowerCase().includes("hmr") ||
    reasonStack.toLowerCase().includes("websocket") ||
    reasonStack.toLowerCase().includes("vite") ||
    reasonStack.toLowerCase().includes("hmr")
  ) {
    return; // Ignore benign promise rejections from development websocket/HMR
  }

  let tenantId = "Unknown";
  try {
    const activeTenantRaw = localStorage.getItem("veggiepos_active_tenant");
    if (activeTenantRaw) {
      tenantId = JSON.parse(activeTenantRaw).tenantId || "Unknown";
    }
  } catch (_) {}

  let userId = "Guest/Unauthenticated";
  try {
    const staffRaw = localStorage.getItem("veggiepos_current_staff");
    if (staffRaw) {
      const parsed = JSON.parse(staffRaw);
      userId = parsed.id || parsed.name || "Unknown User";
    }
  } catch (_) {}

  const payload = {
    message: event.reason?.message || String(event.reason || "Unhandled Promise Rejection"),
    stack: event.reason?.stack || "No promise rejection stack trace available",
    level: "ERROR",
    component: "ClientPromiseRejectionListener",
    tenantId,
    userId,
    url: window.location.href,
    userAgent: navigator.userAgent
  };

  fetch("/api/monitoring/report-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(err => console.error("Failed to report global promise rejection:", err));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
