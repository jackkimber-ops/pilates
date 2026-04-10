import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="page-intro">
        <div className="max-w-3xl space-y-2">
          {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
          <div className="space-y-2">
            <h1 className="editorial-title">{title}</h1>
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="page-actions md:max-w-md md:justify-end">{actions}</div> : null}
      </div>
      <div className="soft-divider" />
    </div>
  );
}
