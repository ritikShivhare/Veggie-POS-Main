import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './features/shared/components/ErrorBoundary.tsx';
import './index.css';

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
