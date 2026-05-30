import Link from "next/link";
import { Plus, Sparkles, Ticket } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { getToday, toDateInputValue, toShortDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { compactList, formatCurrency } from "@/lib/utils";
import { TrialSaleForm } from "@/app/(app)/sales/trial/trial-sale-form";

export default async function SellTrialPackagePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const params = await searchParams;

  const [customers, templates, activeTrials, recentTrials] = await Promise.all([
    prisma.customer.findMany({
      where: {
        status: "ACTIVE",
      },
      orderBy: {
        fullName: "asc",
      },
      select: {
        id: true,
        fullName: true,
        _count: {
          select: {
            bookings: true,
            packages: true,
            singleClassPurchases: true,
            trialPackages: true,
          },
        },
      },
    }),
    prisma.trialPackageTemplate.findMany({
      where: {
        active: true,
      },
      include: {
        items: {
          include: {
            classType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.customerTrialPackage.findMany({
      where: {
        active: true,
        items: {
          some: {
            remainingQuantity: {
              gt: 0,
            },
          },
        },
      },
      select: {
        id: true,
        customerId: true,
        purchaseDate: true,
        amountPaid: true,
        customer: {
          select: {
            fullName: true,
          },
        },
        trialPackageTemplate: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            originalQuantity: true,
            remainingQuantity: true,
            classType: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        purchaseDate: "desc",
      },
      take: 40,
    }),
    prisma.customerTrialPackage.findMany({
      select: {
        id: true,
        customerId: true,
        purchaseDate: true,
        amountPaid: true,
        customer: {
          select: {
            fullName: true,
          },
        },
        trialPackageTemplate: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        purchaseDate: "desc",
      },
      take: 8,
    }),
  ]);

  const totalRemaining = activeTrials.reduce(
    (sum, trialPackage) =>
      sum + trialPackage.items.reduce((itemSum, item) => itemSum + item.remainingQuantity, 0),
    0,
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="Trials"
        actions={
          <Link href="#sell-trial" className={buttonStyles({ size: "lg" })}>
            <Plus className="size-4" />
            Sell trial
          </Link>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Card className="space-y-5">
          <div className="section-header">
            <div className="space-y-2">
              <p className="section-kicker">Active trials</p>
              <h2 className="section-title">Trial customers</h2>
            </div>
            <Badge tone="plum">{totalRemaining} left</Badge>
          </div>

          <div className="space-y-3">
            {activeTrials.length ? (
              activeTrials.map((trialPackage) => {
                const remaining = trialPackage.items.reduce(
                  (sum, item) => sum + item.remainingQuantity,
                  0,
                );

                return (
                  <Link
                    key={trialPackage.id}
                    href={`/customers/${trialPackage.customerId}`}
                    prefetch={false}
                    className="list-row block"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="chip-row">
                          <Badge tone="plum">Active</Badge>
                          <Badge tone="outline">{trialPackage.trialPackageTemplate.name}</Badge>
                        </div>
                        <div>
                          <p className="font-display text-[1.65rem] leading-none tracking-[-0.04em] text-ink">
                            {trialPackage.customer.fullName}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted">
                            {compactList([
                              `Purchased ${toShortDate(trialPackage.purchaseDate)}`,
                              formatCurrency(trialPackage.amountPaid.toString()),
                            ])}
                          </p>
                        </div>
                        <p className="text-sm leading-6 text-muted">
                          {trialPackage.items
                            .filter((item) => item.remainingQuantity > 0)
                            .map((item) => `${item.classType.name}: ${item.remainingQuantity}/${item.originalQuantity}`)
                            .join(" / ")}
                        </p>
                      </div>

                      <div className="stat-shell lg:min-w-[170px]">
                        <p className="stat-label">Trial sessions</p>
                        <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">{remaining}</p>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <EmptyState title="No active trials" />
            )}
          </div>
        </Card>

        <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <Card variant="tint" className="space-y-4">
            <div className="section-header">
              <h2 className="section-title">Entitlements</h2>
              <Sparkles className="size-5 text-accent-strong" />
            </div>
            <div className="grid gap-3">
              <div className="stat-shell">
                <p className="stat-label">Active customers</p>
                <p className="metric-number mt-3">{activeTrials.length}</p>
              </div>
              <div className="stat-shell">
                <p className="stat-label">Sessions left</p>
                <p className="metric-number mt-3">{totalRemaining}</p>
              </div>
              <div className="stat-shell">
                <p className="stat-label">Templates</p>
                <p className="metric-number mt-3">{templates.length}</p>
              </div>
            </div>
          </Card>

          <Card variant="soft" className="space-y-4">
            <h2 className="section-title">Recent trial sales</h2>
            <div className="space-y-3">
              {recentTrials.length ? (
                recentTrials.map((trialPackage) => (
                  <Link
                    key={trialPackage.id}
                    href={`/customers/${trialPackage.customerId}`}
                    prefetch={false}
                    className="list-row-quiet block"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{trialPackage.customer.fullName}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {trialPackage.trialPackageTemplate.name} / {toShortDate(trialPackage.purchaseDate)}
                        </p>
                      </div>
                      <p className="font-semibold text-ink">
                        {formatCurrency(trialPackage.amountPaid.toString())}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState title="No trial sales yet" />
              )}
            </div>
          </Card>
        </div>
      </section>

      <section id="sell-trial" className="scroll-mt-28 grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
        <Card variant="soft" className="order-2 space-y-5 xl:order-1">
          <div className="section-header">
            <h2 className="section-title">Trial templates</h2>
            <Badge tone="plum">{templates.length} active</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((template) => (
              <div key={template.id} className="drawer-preview">
                <div className="chip-row">
                  <Badge tone="plum">{formatCurrency(template.price.toString())}</Badge>
                </div>
                <p className="mt-3 font-semibold text-ink">{template.name}</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-muted">
                  {template.items.map((item) => (
                    <p key={item.id}>
                      {item.quantity} x {item.classType.name}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Sheet className="order-1 xl:order-2" title="Sell trial">
          <TrialSaleForm
            redirectTo={params.customerId ? `/customers/${params.customerId}` : "/sales/trial"}
            initialCustomerId={params.customerId}
            initialPurchaseDate={toDateInputValue(getToday())}
            customers={customers.map((customer) => ({
              id: customer.id,
              fullName: customer.fullName,
              historyCounts: {
                bookings: customer._count.bookings,
                packages: customer._count.packages,
                oneOffs: customer._count.singleClassPurchases,
                trials: customer._count.trialPackages,
              },
            }))}
            templates={templates.map((template) => ({
              id: template.id,
              name: template.name,
              price: template.price.toString(),
              notes: template.notes,
              items: template.items.map((item) => ({
                classTypeId: item.classTypeId,
                classTypeName: item.classType.name,
                quantity: item.quantity,
              })),
            }))}
          />

          <div className="surface-inset rounded-[24px] p-4">
            <div className="section-header">
              <h3 className="font-display text-[1.45rem] leading-none tracking-[-0.04em] text-ink">After save</h3>
              <Sparkles className="size-5 text-accent-strong" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="stat-shell">
                <p className="stat-label">Trial products</p>
                <p className="mt-2 text-sm font-semibold text-ink">{templates.length} active</p>
              </div>
              <div className="stat-shell">
                <p className="stat-label">Match</p>
                <p className="mt-2 text-sm font-semibold text-ink">Exact class type</p>
              </div>
              <div className="stat-shell">
                <p className="stat-label">Used on</p>
                <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ink">
                  <Ticket className="size-3.5 text-accent-strong" />
                  Attendance
                </p>
              </div>
            </div>
          </div>
        </Sheet>
      </section>
    </div>
  );
}
