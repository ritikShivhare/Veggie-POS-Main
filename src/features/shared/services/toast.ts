export interface ToastItem {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title?: string;
  message: string;
  duration?: number;
}

type ToastCallback = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastCallback> = new Set();

  public subscribe(callback: ToastCallback): () => void {
    this.listeners.add(callback);
    callback([...this.toasts]);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach((callback) => callback([...this.toasts]));
  }

  public show(toast: Omit<ToastItem, "id"> & { id?: string }): string {
    const id = toast.id || Math.random().toString(36).substring(2, 9);
    const duration = toast.duration ?? (toast.type === "error" ? 6000 : 4000);
    const newToast: ToastItem = { ...toast, id, duration };

    // Prevent duplicate error toasts within 2 seconds to avoid error spam
    if (toast.type === "error") {
      const isDuplicate = this.toasts.some(
        (t) => t.type === "error" && t.message === toast.message
      );
      if (isDuplicate) return id;
    }

    // Limit to maximum 5 visible toasts at a time to prevent UI overcrowding
    if (this.toasts.length >= 5) {
      this.toasts = this.toasts.slice(1);
    }

    this.toasts = [...this.toasts, newToast];
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  public success(message: string, title?: string, duration?: number): string {
    return this.show({ type: "success", message, title, duration });
  }

  public error(message: string, title?: string, duration?: number): string {
    return this.show({ type: "error", message, title, duration });
  }

  public info(message: string, title?: string, duration?: number): string {
    return this.show({ type: "info", message, title, duration });
  }

  public warning(message: string, title?: string, duration?: number): string {
    return this.show({ type: "warning", message, title, duration });
  }

  public dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  public clearAll() {
    this.toasts = [];
    this.notify();
  }
}

export const toast = new ToastManager();

// Setup a global window event listener to catch backend and API failures automatically
if (typeof window !== "undefined") {
  (window as any).toast = toast;

  window.addEventListener("veggiepos_api_error", (event: any) => {
    const { context, message } = event.detail || {};
    // Extract a user-friendly message
    const formattedMsg = message || "Unknown communication failure";
    toast.error(formattedMsg, context || "Network Connection Error");
  });
}
