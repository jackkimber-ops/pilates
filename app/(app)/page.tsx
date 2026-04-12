import Link from "next/link";
import { addDays } from "date-fns";
import { ArrowRight, CalendarDays, CircleDollarSign, Clock3, Plus, Settings2, Sparkles, Users2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCustomerBalanceLabel, getCustomerBalanceSourceLabel } from "@/lib/balances";
import { LOW_CREDIT_THRESHOLD } from "@/lib/constants";
import { getToday, toDateTimeLabel, toRelativeDayLabel } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { compactList, formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const today = getToday();
  const tomorrow = addDays(today, 1);

  const [todaysSessions, upcomingSessions, lowBalancePackages, expiredPackages, unusedSingles] =
    await Promise.all([
      prisma.session.findMany({
        where: {
          status: "SCHEDULED",
          startsAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          startTime: true,
          capacity: true,
          instructor: {
            select: {
              fullName: true,
            },
          },
          classType: {
            select: {
              name: true,
              category: true,
            },
          },
          _count: {
            select: {
              bookings: {
                where: {
                  status: {
                    not: "CANCELLED",
                  },
                },
              },
            },
          },
        },
        orderBy: {
          startsAt: "asc",
        },
      }),
      prisma.session.findMany({
        where: {
          status: "SCHEDULED",
          startsAt: {
            gte: today,
          },
        },
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          capacity: true,
          instructor: {
            select: {
              fullName: true,
            },
          },
          classType: {
            select: {
              category: true,
            },
          },
          _count: {
            select: {
              bookings: {
                where: {
                  status: {
                    not: "CANCELLED",
                  },
                },
              },
            },
          },
        },
        orderBy: {
          startsAt: "asc",
        },
        take: 6,
      }),
      prisma.customerPackage.findMany({
        where: {
          active: true,
          remainingCredits: {
            lte: LOW_CREDIT_THRESHOLD,
            gt: 0,
          },
          OR: [{ expiryDate: null }, { expiryDate: { gte: today } }],
        },
        select: {
          id: true,
          customerId: true,
          sourceType: true,
          remainingCredits: true,
          expiryDate: true,
          classType: {
            select: {
              name: true,
              category: true,
            },
          },
          customer: {
            select: {
              fullName: true,
            },
          },
          packageTemplate: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ remainingCredits: "asc" }, { purchaseDate: "asc" }],
        take: 6,
      }),
      prisma.customerPackage.findMany({
        where: {
          expiryDate: {
            lt: today,
          },
          remainingCredits: {
            gt: 0,
          },
        },
        select: {
          id: true,
          customerId: true,
          sourceType: true,
          remainingCredits: true,
          expiryDate: true,
          classType: {
            select: {
              name: true,
              category: true,
            },
          },
          customer: {
            select: {
              fullName: true,
            },
          },
          packageTemplate: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          expiryDate: "desc",
        },
        take: 6,
      }),
      prisma.singleClassPurchase.findMany({
        where: {
          status: "UNUSED",
        },
        select: {
          id: true,
          customerId: true,
          category: true,
          amountPaid: true,
          status: true,
          customer: {
            select: {
              fullName: true,
            },
          },
          classType: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ expiryDate: "asc" }, { purchaseDate: "asc" }],
        take: 6,
      }),
    ]);

  const quickActions = [
    {
      href: "/customers/new",
      label: "Add customer",
      icon: Users2,
    },
    {
      href: "/sales/package",
      label: "Sell package",
      icon: CircleDollarSign,
    },
    {
      href: "/sales/trial",
      label: "Trials",
      icon: Sparkles,
    },
    {
      href: "/calendar",
      label: "Calendar",
      icon: CalendarDays,
    },
    {
      href: "/recurring",
      label: "Recurring",
      icon: Clock3,
    },
  ];

  const totalTodayBookings = todaysSessions.reduce((sum, session) => sum + session._count.bookings, 0);
  const nextSession = upcomingSessions[0] ?? null;
  const followUpCount = lowBalancePackages.length + expiredPackages.length;

  return (
    <div className="page-stack">
      <PageHeader
        title="Dashboard"
        actions={
          <Link href="/sessions/new" className={buttonStyles({ size: "lg" })}>
            <Plus className="size-4" />
            New session
          </Link>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
        <Card variant="tint" className="space-y-7 overflow-hidden">
          <div className="space-y-3">
            <h2 className="section-title max-w-xl">Overview</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="stat-shell">
              <p className="stat-label">Sessions today</p>
              <p className="metric-number mt-3">{todaysSessions.length}</p>
            </div>
            <div className="stat-shell">
              <p className="stat-label">Bookings today</p>
              <p className="metric-number mt-3">{totalTodayBookings}</p>
            </div>
            <div className="stat-shell">
              <p className="stat-label">Follow-up items</p>
              <p className="metric-number mt-3">{followUpCount}</p>
            </div>
          </div>

          <div className="soft-divider" />

          <div className="editorial-grid md:grid-cols-2">
            {quickActions.map((item) => {
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href} className="list-row group block h-full">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex size-10 items-center justify-center rounded-[18px] bg-white/72 text-accent-strong shadow-[0_14px_24px_-22px_rgba(74,56,51,0.14)]">
                        <Icon className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-ink">{item.label}</p>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 size-4 text-muted transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/catalog" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              <Settings2 className="size-4" />
              Studio catalog
            </Link>
          </div>
        </Card>

        <div className="space-y-5">
          <Card variant="soft" className="space-y-5">
              <div className="section-header">
                <h2 className="section-title">Next session</h2>
              <Badge tone="outline">Live</Badge>
            </div>

            {nextSession ? (
              <Link href={`/sessions/${nextSession.id}`} className="list-row block">
                <div className="space-y-3">
                  <div className="chip-row">
                    <Badge tone={nextSession.classType.category === "GROUP" ? "plum" : "warm"}>
                      {nextSession.classType.category}
                    </Badge>
                    <Badge tone="outline">{nextSession.status}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="font-display text-[1.7rem] leading-none tracking-[-0.04em] text-ink">
                      {nextSession.title}
                    </p>
                    <p className="text-sm leading-6 text-muted">
                      {compactList([
                          toDateTimeLabel(nextSession.startsAt),
                          nextSession.instructor.fullName,
                          `${nextSession._count.bookings}/${nextSession.capacity} booked`,
                        ])}
                      </p>
                  </div>
                </div>
              </Link>
            ) : (
              <EmptyState
                title="No upcoming sessions"
                description="Create a session."
              />
            )}

            <div className="space-y-3">
              {upcomingSessions.slice(1, 4).map((session) => (
                <Link key={session.id} href={`/sessions/${session.id}`} className="list-row-quiet block">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{session.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {compactList([
                          toDateTimeLabel(session.startsAt),
                          session.instructor.fullName,
                          `${session._count.bookings}/${session.capacity} booked`,
                        ])}
                      </p>
                    </div>
                    <Badge tone={session.classType.category === "GROUP" ? "plum" : "warm"}>
                      {session.classType.category}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>

            <Link href="/calendar" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Calendar
            </Link>
          </Card>

          <Card variant="soft" className="space-y-4">
            <div className="section-header">
              <h2 className="section-title">Follow-up</h2>
              <Badge tone="warm">Actionable</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="list-row-quiet">
                <p className="stat-label">Low balances</p>
                <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">
                  {lowBalancePackages.length}
                </p>
              </div>
              <div className="list-row-quiet">
                <p className="stat-label">Expired packages</p>
                <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">
                  {expiredPackages.length}
                </p>
              </div>
              <div className="list-row-quiet">
                <p className="stat-label">Unused one-offs</p>
                <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">
                  {unusedSingles.length}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <Card className="space-y-6">
        <div className="section-header">
          <h2 className="section-title">Today</h2>
        </div>

        <div className="space-y-3">
          {todaysSessions.length ? (
            todaysSessions.map((session) => (
              <Link key={session.id} href={`/sessions/${session.id}`} className="list-row block">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="chip-row">
                      <Badge tone={session.classType.category === "GROUP" ? "plum" : "warm"}>
                        {session.classType.category}
                      </Badge>
                      <Badge tone="outline">{session.status}</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="font-display text-[1.8rem] leading-none tracking-[-0.04em] text-ink">
                        {session.title}
                      </p>
                      <p className="text-sm leading-6 text-muted">
                        {compactList([
                          session.classType.name,
                          session.instructor.fullName,
                          `${session._count.bookings}/${session.capacity} booked`,
                        ])}
                      </p>
                    </div>
                  </div>

                  <div className="md:text-right">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
                      {toRelativeDayLabel(session.startsAt)}
                    </p>
                    <p className="mt-2 font-display text-[1.55rem] leading-none tracking-[-0.04em] text-ink">
                      {session.startTime}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <EmptyState
              title="No sessions today"
              description="Create a session."
              action={
                <Link href="/sessions/new" className={buttonStyles({ variant: "tonal", size: "sm" })}>
                  Create session
                </Link>
              }
            />
          )}
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-3">
        <Card className="space-y-4">
          <h2 className="section-title">Low balances</h2>

          <div className="space-y-3">
            {lowBalancePackages.length ? (
              lowBalancePackages.map((customerPackage) => (
                <Link
                  key={customerPackage.id}
                  href={`/customers/${customerPackage.customerId}`}
                  className="list-row-quiet block"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{customerPackage.customer.fullName}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {compactList([
                          getCustomerBalanceLabel(customerPackage),
                          getCustomerBalanceSourceLabel(customerPackage),
                        ])}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-[1.6rem] leading-none tracking-[-0.04em] text-warm">
                        {customerPackage.remainingCredits}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                        {customerPackage.expiryDate
                          ? `Expires ${toRelativeDayLabel(customerPackage.expiryDate)}`
                          : "No expiry"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                title="No low balances"
              />
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="section-title">Expired packages</h2>

          <div className="space-y-3">
            {expiredPackages.length ? (
              expiredPackages.map((customerPackage) => (
                <Link
                  key={customerPackage.id}
                  href={`/customers/${customerPackage.customerId}`}
                  className="list-row-quiet block"
                >
                  <p className="font-semibold text-ink">{customerPackage.customer.fullName}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {getCustomerBalanceLabel(customerPackage)} / {customerPackage.remainingCredits} unused sessions
                  </p>
                </Link>
              ))
            ) : (
              <EmptyState
                title="No expired packages"
              />
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="section-title">One-offs</h2>

          <div className="space-y-3">
            {unusedSingles.length ? (
              unusedSingles.map((purchase) => (
                <Link key={purchase.id} href={`/customers/${purchase.customerId}`} className="list-row-quiet block">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{purchase.customer.fullName}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {compactList([
                          purchase.category,
                          purchase.classType?.name ?? "Any matching class",
                          formatCurrency(purchase.amountPaid.toString()),
                        ])}
                      </p>
                    </div>
                    <Badge tone="outline">{purchase.status}</Badge>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                title="No unused one-offs"
              />
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
