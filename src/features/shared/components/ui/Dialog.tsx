import * as React from "react";
import { X } from "lucide-react";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Native modal dialog provides focus trapping and Escape behavior in supported browsers. */
export function Dialog({ open, onOpenChange, title, description, children, footer, className = "" }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    let previousFocus: HTMLElement | null = null;
    if (open && !dialog.open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      // An open dialog may be unmounted before the browser runs its close steps.
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  return <dialog
    ref={ref}
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined}
    onCancel={(event) => { event.preventDefault(); onOpenChange(false); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'))
        .filter((element) => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onOpenChange(false);
    }}
    className={[
      "m-auto w-[calc(100%_-_1.5rem)] max-w-lg max-h-[calc(100dvh_-_2rem)] overflow-y-auto",
      "rounded-app-card border border-app-border bg-white p-0 text-app-text shadow-2xl",
      "backdrop:bg-slate-950/50",
      className,
    ].join(" ")}
  >
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-app-border bg-white p-4">
      <div className="min-w-0">
        <h2 id={titleId} className="text-lg font-bold">{title}</h2>
        {description && <p id={descriptionId} className="mt-1 text-sm text-app-muted">{description}</p>}
      </div>
      <button type="button" onClick={() => onOpenChange(false)}
        aria-label="Close dialog"
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-app-control hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-app-primary">
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
    <div className="p-4">{children}</div>
    {footer && <div className="sticky bottom-0 border-t border-app-border bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
  </dialog>;
}
