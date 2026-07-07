import React, { useEffect, useState } from "react";
import { toast, ToastItem } from "../services/toast";
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    // Subscribe to toast updates
    const unsubscribe = toast.subscribe((updatedToasts) => {
      setToasts(updatedToasts);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div 
      id="global-toast-container" 
      className="fixed top-6 right-6 z-[999999] flex flex-col gap-3.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((item) => {
        let bgColor = "bg-white border-slate-200 text-slate-800 shadow-xl";
        let iconColor = "text-blue-500";
        let IconComponent = Info;

        switch (item.type) {
          case "success":
            bgColor = "bg-slate-900/95 border-emerald-500/30 text-slate-100 shadow-emerald-950/20 shadow-2xl backdrop-blur-md";
            iconColor = "text-emerald-400";
            IconComponent = CheckCircle;
            break;
          case "error":
            bgColor = "bg-rose-950/95 border-rose-800/60 text-rose-50 shadow-rose-950/20 shadow-2xl backdrop-blur-md";
            iconColor = "text-rose-400";
            IconComponent = AlertCircle;
            break;
          case "warning":
            bgColor = "bg-amber-950/95 border-amber-800/60 text-amber-50 shadow-amber-950/20 shadow-2xl backdrop-blur-md";
            iconColor = "text-amber-400";
            IconComponent = AlertTriangle;
            break;
          case "info":
          default:
            bgColor = "bg-slate-900/95 border-sky-500/30 text-slate-100 shadow-slate-950/25 shadow-2xl backdrop-blur-md";
            iconColor = "text-sky-400";
            IconComponent = Info;
            break;
        }

        return (
          <div
            key={item.id}
            id={`toast-${item.id}`}
            className={`pointer-events-auto flex gap-3.5 p-4 rounded-xl border transition-all duration-300 transform translate-x-0 animate-slide-in-right ${bgColor}`}
          >
            <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
              <IconComponent className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-1">
              {item.title && (
                <h4 className="text-xs font-bold tracking-wide uppercase opacity-90 leading-tight">
                  {item.title}
                </h4>
              )}
              <p className="text-xs font-medium leading-relaxed opacity-95">
                {item.message}
              </p>
            </div>

            <button
              onClick={() => toast.dismiss(item.id)}
              className="flex-shrink-0 h-5 w-5 rounded-lg flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-white/10 transition-all text-current"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
