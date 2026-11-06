import * as React from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
export type ButtonSize = "default" | "compact";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-app-primary text-white hover:bg-app-primary-hover",
  secondary: "bg-slate-100 text-app-text hover:bg-slate-200",
  outline: "bg-white text-app-text border border-app-border hover:bg-slate-50",
  danger: "bg-app-danger text-white hover:bg-rose-700",
  ghost: "bg-transparent text-app-text hover:bg-slate-100",
};

/** Additive shared control; existing payment, KDS and security buttons remain untouched. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "default", loading = false, disabled, className = "", children, type = "button", ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-app-control px-4 font-semibold text-sm",
        "transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-primary",
        "disabled:opacity-50 disabled:cursor-not-allowed min-w-0",
        size === "compact" ? "min-h-11" : "min-h-12",
        variants[variant],
        className,
      ].join(" ")}
    >
      {loading && <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />}
      {children}
    </button>
  );
});
