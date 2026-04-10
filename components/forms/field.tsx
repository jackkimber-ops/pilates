import type { ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-ink/78">
          {label}
        </label>
        {hint ? <span className="text-xs text-muted-soft">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
