import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Sheet({
  eyebrow,
  title,
  description,
  children,
  footer,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("sheet-shell", className)}>
      <div className="sheet-handle md:hidden" />
      <div className="space-y-1.5">
        <h2 className="section-title">{title}</h2>
        {description ? <p className="max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      <div className="mt-5 space-y-5">{children}</div>
      {footer ? <div className="sheet-footer">{footer}</div> : null}
    </section>
  );
}
