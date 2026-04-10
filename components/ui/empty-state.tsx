import type { ReactNode } from "react";

export function EmptyState({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="space-y-3">
        <div className="flex size-11 items-center justify-center rounded-[18px] bg-white/68 text-accent-strong shadow-[0_16px_26px_-22px_rgba(74,56,51,0.16)]">
          <span className="font-display text-lg leading-none">R:</span>
        </div>
        {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
        <div className="space-y-1.5">
          <p className="font-display text-[1.7rem] leading-[0.95] tracking-[-0.045em] text-ink">
            {title}
          </p>
          {description ? <p className="max-w-xl">{description}</p> : null}
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
