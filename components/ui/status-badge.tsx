import type { ReactNode } from "react";
import { STATUS_BADGE_STYLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  children,
  className,
}: {
  status: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em]",
        STATUS_BADGE_STYLES[status] ?? "bg-panel-muted text-muted",
        className,
      )}
    >
      {children ?? status.replaceAll("_", " ")}
    </span>
  );
}
