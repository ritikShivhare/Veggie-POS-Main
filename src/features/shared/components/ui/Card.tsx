import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  tone?: "default" | "alert";
}

/** Presentational surface only. Do not use interactive=true as a substitute for a button. */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = "", interactive = false, tone = "default", children, ...props }, ref,
) {
  return <div {...props} ref={ref}
    className={[
      "rounded-app-card border bg-white p-4 sm:p-5 shadow-sm text-app-text",
      tone === "alert" ? "border-amber-200" : "border-app-border",
      interactive ? "transition-shadow duration-150 hover:shadow-md" : "",
      className,
    ].join(" ")}>{children}</div>;
});
