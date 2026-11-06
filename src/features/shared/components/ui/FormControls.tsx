import * as React from "react";

type FieldBase = { label: string; error?: string; hint?: string; wrapperClassName?: string };
const controlClasses = "w-full min-h-11 rounded-app-control border border-app-border bg-white px-3 py-2.5 text-base text-app-text placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-app-primary disabled:bg-slate-100 disabled:cursor-not-allowed";
function FieldFrame({ id, label, hint, error, children, className = "" }: FieldBase & { id: string; children: React.ReactNode; className?: string }) {
  return <div className={["space-y-1.5",className].join(" ")}>
    <label htmlFor={id} className="block text-sm font-semibold text-app-text">{label}</label>
    {children}
    {hint && !error && <p id={id + "-hint"} className="text-sm text-app-muted">{hint}</p>}
    {error && <p id={id + "-error"} role="alert" className="text-sm text-app-danger">{error}</p>}
  </div>;
}

export interface InputFieldProps extends FieldBase, Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {}
export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { label, error, hint, wrapperClassName, className = "", id, "aria-describedby": describedBy, ...props }, ref,
) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const descriptionId = error ? fieldId + "-error" : hint ? fieldId + "-hint" : undefined;
  return <FieldFrame id={fieldId} label={label} error={error} hint={hint} className={wrapperClassName}>
    <input {...props} ref={ref} id={fieldId} aria-invalid={Boolean(error) || undefined}
      aria-describedby={[describedBy, descriptionId].filter(Boolean).join(" ") || undefined}
      className={[controlClasses, className].join(" ")} />
  </FieldFrame>;
});

export interface SelectFieldProps extends FieldBase, React.SelectHTMLAttributes<HTMLSelectElement> {}
export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, wrapperClassName, className = "", id, "aria-describedby": describedBy, children, ...props }, ref,
) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const descriptionId = error ? fieldId + "-error" : hint ? fieldId + "-hint" : undefined;
  return <FieldFrame id={fieldId} label={label} error={error} hint={hint} className={wrapperClassName}>
    <select {...props} ref={ref} id={fieldId} aria-invalid={Boolean(error) || undefined}
      aria-describedby={[describedBy, descriptionId].filter(Boolean).join(" ") || undefined}
      className={[controlClasses, className].join(" ")}>{children}</select>
  </FieldFrame>;
});

export interface TextareaFieldProps extends FieldBase, React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
export const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { label, error, hint, wrapperClassName, className = "", id, "aria-describedby": describedBy, ...props }, ref,
) {
  const generated = React.useId();
  const fieldId = id ?? generated;
  const descriptionId = error ? fieldId + "-error" : hint ? fieldId + "-hint" : undefined;
  return <FieldFrame id={fieldId} label={label} error={error} hint={hint} className={wrapperClassName}>
    <textarea {...props} ref={ref} id={fieldId} aria-invalid={Boolean(error) || undefined}
      aria-describedby={[describedBy, descriptionId].filter(Boolean).join(" ") || undefined}
      className={[controlClasses, "min-h-24 resize-y", className].join(" ")} />
  </FieldFrame>;
});
