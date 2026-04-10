import Link from "next/link";

export function MobileSectionNav({
  items,
}: {
  items: Array<{ href: string; label: string }>;
}) {
  return (
    <nav className="mobile-section-nav" aria-label="Section shortcuts">
      <div className="mobile-section-nav-track">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="mobile-section-link">
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
