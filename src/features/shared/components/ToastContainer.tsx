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
      className="fixed top-3 left-3 right-3 sm:top-6 sm:left-auto sm:right-6 z-[999999] flex flex-col gap-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:w-full sm:max-w-sm pointer-events-none"
    >
      {toasts.map((item) => {
        let bgColor = "bg-white border-slate-200 text-slate-800 shadow-xl";
        let iconColor = "text-blue-500";
        let IconComponent = Info;

        switch (item.type) {
          case "success":
            bgColor = "bg-white border-emerald-200 text-slate-900 shadow-lg";
            iconColor = "text-emerald-700";
            IconComponent = CheckCircle;
            break;
          case "error":
            bgColor = "bg-white border-rose-200 text-slate-900 shadow-lg";
            iconColor = "text-rose-700";
            IconComponent = AlertCircle;
            break;
          case "warning":
            bgColor = "bg-white border-amber-200 text-slate-900 shadow-lg";
            iconColor = "text-amber-700";
            IconComponent = AlertTriangle;
            break;
          case "info":
          default:
            bgColor = "bg-white border-blue-200 text-slate-900 shadow-lg";
            iconColor = "text-blue-700";
            IconComponent = Info;
            break;
        }

        return (
          <div
            key={item.id}
            id={`toast-${item.id}`}
            className={`pointer-events-auto flex gap-3 p-4 rounded-xl border transition-shadow duration-150 min-w-0 ${bgColor}`}
          >
            <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
              <IconComponent className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              {item.title && (
                <h4 className="text-xs font-bold tracking-wide uppercase opacity-90 leading-tight">
                  {item.title}
                </h4>
              )}
              <p className="text-sm font-medium leading-relaxed break-words">
                {item.message}
              </p>
            </div>

            <button
              onClick={() => toast.dismiss(item.id)}
              className="flex-shrink-0 h-11 w-11 rounded-lg flex items-center justify-center hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 text-slate-600"
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
