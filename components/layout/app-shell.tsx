import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, LogOut, Plus, Sparkles } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { AccountMenu } from "@/components/layout/account-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PrimaryNav } from "@/components/layout/primary-nav";
import { ShellMenu } from "@/components/layout/shell-menu";
import { getInitials } from "@/lib/utils";

const SHELL_MENU_ITEMS = [
  {
    href: "/sales/trial",
    label: "Trials",
  },
  {
    href: "/sales/single",
    label: "Sell one-off",
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
] as const;

export function AppShell({
  userName,
  userEmail,
  onLogOut,
  children,
}: {
  userName: string;
  userEmail: string;
  onLogOut: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-transparent">
      <div className="page-shell">
        <div className="app-shell-grid">
          <aside className="surface-panel hidden rounded-[38px] p-6 lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:flex-col">
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-[22px] bg-accent-soft font-display text-lg text-accent-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    R:
                  </div>
                  <div className="space-y-1">
                    <h1 className="font-display text-[2.05rem] leading-none tracking-[-0.05em] text-ink">
                      Re:Form
                    </h1>
                  </div>
                </div>
              </div>

              <PrimaryNav mode="desktop" />

              <div className="surface-inset rounded-[30px] p-4">
                <Link
                  href="/sales/package"
                  className={buttonStyles({
                    variant: "primary",
                    size: "sm",
                    className: "mt-4 h-11 w-full justify-center rounded-[22px] shadow-[0_24px_40px_-28px_rgba(99,69,76,0.62)]",
                  })}
                >
                  <Sparkles className="size-4" />
                  Sell package
                </Link>
              </div>
            </div>

            <div className="surface-inset mt-auto rounded-[30px] p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-[18px] bg-white/75 text-sm font-semibold text-accent-strong shadow-[0_12px_24px_-18px_rgba(74,56,51,0.22)]">
                  {getInitials(userName)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{userName}</p>
                </div>
              </div>

              <form action={onLogOut}>
                <Button type="submit" variant="secondary" className="w-full justify-center">
                  <LogOut className="size-4" />
                  Log out
                </Button>
              </form>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <header className="top-app-bar">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-display text-[1.95rem] leading-none tracking-[-0.055em] text-ink md:text-[2.15rem]">
                      Re:Form
                    </h1>
                    <span className="top-app-bar-chip">{todayLabel}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Link
                    href="/sessions/new"
                    className={buttonStyles({ size: "sm" })}
                  >
                    <Plus className="size-4" />
                    New session
                  </Link>
                  <Link
                    href="/calendar"
                    className={buttonStyles({ variant: "secondary", size: "sm" })}
                  >
                    <CalendarDays className="size-4" />
                    Calendar
                  </Link>
                  <ShellMenu items={SHELL_MENU_ITEMS} onLogOut={onLogOut} />
                  <AccountMenu userName={userName} userEmail={userEmail} onLogOut={onLogOut} />
                </div>
              </div>
            </header>

            <main className="page-stack">{children}</main>
          </div>
        </div>
      </div>

      <MobileNav onLogOut={onLogOut} />
    </div>
  );
}
