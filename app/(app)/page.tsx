import Link from "next/link";
import { Plus } from "lucide-react";
import {
  DashboardLiveSessionsProvider,
  DashboardNextSessionCard,
  DashboardSessionStats,
  DashboardTodaySessionsCard,
} from "@/components/dashboard/dashboard-live-sessions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCustomerBalanceLabel, getCustomerBalanceSourceLabel } from "@/lib/balances";
import { LOW_CREDIT_THRESHOLD } from "@/lib/constants";
import { getDashboardLiveSessions } from "@/lib/dashboard-live-sessions";
import { getToday, toRelativeDayLabel } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { compactList, formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const today = getToday();

  const [liveSessions, lowBalancePackages, expiredPackages, unusedSingles] =
    await Promise.all([
      getDashboardLiveSessions(),
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

  const followUpCount = lowBalancePackages.length + expiredPackages.length;

  return (
    <DashboardLiveSessionsProvider initialData={liveSessions}>
      <div className="page-stack">
      <PageHeader
        title="Dashboard"
        actions={
          <Link href="/sessions/new" prefetch={false} className={buttonStyles({ size: "lg" })}>
            <Plus className="size-4" />
            New session
          </Link>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <DashboardNextSessionCard />
          <DashboardTodaySessionsCard />
        </div>

        <div className="space-y-5">
          <Card variant="tint" className="space-y-5">
            <div className="section-header">
              <h2 className="section-title">Today</h2>
              <Badge tone="plum">Live</Badge>
            </div>
            <DashboardSessionStats followUpCount={followUpCount} />
          </Card>

          <Card variant="soft" className="space-y-5">
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

      <section className="grid gap-5 xl:grid-cols-3">
        <Card className="space-y-4">
          <h2 className="section-title">Low balances</h2>

          <div className="space-y-3">
            {lowBalancePackages.length ? (
              lowBalancePackages.map((customerPackage) => (
                <Link
                  key={customerPackage.id}
                  href={`/customers/${customerPackage.customerId}`}
                  prefetch={false}
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
                  prefetch={false}
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
                <Link
                  key={purchase.id}
                  href={`/customers/${purchase.customerId}`}
                  prefetch={false}
                  className="list-row-quiet block"
                >
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
    </DashboardLiveSessionsProvider>
  );
}
