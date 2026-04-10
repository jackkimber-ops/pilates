import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "plum" | "sage" | "warm" | "neutral" | "danger" | "outline";

const TONE_STYLES: Record<BadgeTone, string> = {
  plum: "bg-accent-soft/88 text-accent-strong",
  sage: "bg-sage-soft/92 text-sage",
  warm: "bg-warm-soft/92 text-warm",
  neutral: "bg-panel-muted/88 text-muted",
  danger: "bg-danger-soft/92 text-danger",
  outline: "bg-white/72 text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em]",
        TONE_STYLES[tone],
        className,
      )}
      {...props}
    />
  );
}
