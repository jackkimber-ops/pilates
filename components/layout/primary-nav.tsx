"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Layers3,
  Package2,
  Repeat2,
  TicketPlus,
  Users2,
  Ellipsis,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ShellMenu } from "@/components/layout/shell-menu";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", shortLabel: "Home", icon: Layers3 },
  { href: "/customers", label: "Customers", shortLabel: "Customers", icon: Users2 },
  { href: "/calendar", label: "Calendar", shortLabel: "Calendar", icon: CalendarDays },
  { href: "/sales/package", label: "Packages", shortLabel: "Packages", icon: CircleDollarSign },
  { href: "/sales/single", label: "One-offs", shortLabel: "One-offs", icon: TicketPlus },
  { href: "/recurring", label: "Recurring", shortLabel: "Recurring", icon: Repeat2 },
  { href: "/reports", label: "Reports", shortLabel: "Reports", icon: BarChart3 },
  { href: "/catalog", label: "Catalog", shortLabel: "Catalog", icon: Package2 },
] as const;

const MOBILE_ITEMS = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  NAV_ITEMS[2],
  NAV_ITEMS[3],
] as const;

const MOBILE_MENU_ITEMS = [
  {
    href: "/sales/trial",
    label: "Trials",
  },
  {
    href: "/sales/single",
    label: "One-offs",
  },
  {
    href: "/recurring",
    label: "Recurring",
  },
  {
    href: "/reports",
    label: "Reports",
  },
  {
    href: "/catalog",
    label: "Catalog",
  },
  {
    href: "/sessions/new",
    label: "New session",
  },
] as const;

export function PrimaryNav({
  mode,
  onLogOut,
}: {
  mode: "desktop" | "mobile";
  onLogOut?: (formData: FormData) => void | Promise<void>;
}) {
  const pathname = usePathname();
  const items = mode === "mobile" ? MOBILE_ITEMS : NAV_ITEMS;

  if (mode === "mobile") {
    return (
      <nav className="mobile-primary-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mobile-nav-link",
                active ? "mobile-nav-link-active" : undefined,
              )}
            >
              <Icon className="mobile-nav-icon size-4" />
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
        {onLogOut ? (
          <div className="flex min-w-[58px] flex-1 justify-center">
            <ShellMenu items={MOBILE_MENU_ITEMS} onLogOut={onLogOut} placement="top" />
          </div>
        ) : (
          <span className="flex min-w-[58px] flex-1 flex-col items-center gap-1 rounded-[24px] px-2 py-2.5 text-[11px] font-semibold text-muted">
            <Ellipsis className="size-4" />
            <span>More</span>
          </span>
        )}
      </nav>
    );
  }

  return (
    <nav className="sidebar-nav">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "sidebar-nav-link",
              active ? "sidebar-nav-link-active" : undefined,
            )}
            aria-current={active ? "page" : undefined}
          >
            <span className="sidebar-nav-icon">
              <Icon className="size-4" />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
