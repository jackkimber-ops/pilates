import Link from "next/link";
import { CalendarClock, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { getCustomerBalanceLabel, getCustomerBalanceSourceLabel } from "@/lib/balances";
import { LOW_CREDIT_THRESHOLD } from "@/lib/constants";
import { getToday, toDateInputValue, toRelativeDayLabel, toShortDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { compactList, formatCurrency } from "@/lib/utils";
import { PackageSaleForm } from "@/app/(app)/sales/package/package-sale-form";

export default async function SellPackagePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const params = await searchParams;
  const today = getToday();

  const [customers, templates, activePackages, lowBalancePackages, recentPackages] = await Promise.all([
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
      },
    }),
    prisma.packageTemplate.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        category: true,
        sessionCount: true,
        validityMonths: true,
        regularPrice: true,
        packagePrice: true,
        classType: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ classType: { name: "asc" } }, { sessionCount: "asc" }],
    }),
    prisma.customerPackage.findMany({
      where: {
        active: true,
        remainingCredits: {
          gt: 0,
        },
        OR: [{ expiryDate: null }, { expiryDate: { gte: today } }],
      },
      select: {
        id: true,
        customerId: true,
        sourceType: true,
        remainingCredits: true,
        originalCredits: true,
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
      orderBy: [{ customer: { fullName: "asc" } }, { expiryDate: "asc" }],
      take: 80,
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
      orderBy: [{ remainingCredits: "asc" }, { expiryDate: "asc" }],
      take: 8,
    }),
    prisma.customerPackage.findMany({
      where: {
        sourceType: "PACKAGE_SALE",
      },
      select: {
        id: true,
        customerId: true,
        sourceType: true,
        remainingCredits: true,
        originalCredits: true,
        purchaseDate: true,
        expiryDate: true,
        amountPaid: true,
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
        purchaseDate: "desc",
      },
      take: 8,
    }),
  ]);

  const balancesByCustomer = Array.from(
    activePackages.reduce(
      (map, customerPackage) => {
        const existing = map.get(customerPackage.customerId);
        if (existing) {
          existing.packages.push(customerPackage);
          existing.totalCredits += customerPackage.remainingCredits;
        } else {
          map.set(customerPackage.customerId, {
            customerId: customerPackage.customerId,
            fullName: customerPackage.customer.fullName,
            totalCredits: customerPackage.remainingCredits,
            packages: [customerPackage],
          });
        }

        return map;
      },
      new Map<
        string,
        {
          customerId: string;
          fullName: string;
          totalCredits: number;
          packages: typeof activePackages;
        }
      >(),
    ).values(),
  );

  const totalActiveCredits = balancesByCustomer.reduce((sum, item) => sum + item.totalCredits, 0);

  return (
    <div className="page-stack">
      <PageHeader
        title="Packages"
        actions={
          <Link href="#sell-package" className={buttonStyles({ size: "lg" })}>
            <Plus className="size-4" />
            Sell package
          </Link>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="space-y-5">
          <div className="section-header">
            <div className="space-y-2">
              <p className="section-kicker">Balances</p>
              <h2 className="section-title">Customer package balances</h2>
            </div>
            <Badge tone="outline">{totalActiveCredits} credits</Badge>
          </div>

          <div className="space-y-3">
            {balancesByCustomer.length ? (
              balancesByCustomer.map((balance) => (
                <Link
                  key={balance.customerId}
                  href={`/customers/${balance.customerId}`}
                  prefetch={false}
                  className="list-row block"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="font-display text-[1.6rem] leading-none tracking-[-0.04em] text-ink">
                        {balance.fullName}
                      </p>
                      <p className="text-sm leading-6 text-muted">
                        {balance.packages
                          .slice(0, 3)
                          .map((customerPackage) =>
                            compactList([
                              getCustomerBalanceLabel(customerPackage),
                              getCustomerBalanceSourceLabel(customerPackage),
                              customerPackage.expiryDate
                                ? `expires ${toRelativeDayLabel(customerPackage.expiryDate)}`
                                : "no expiry",
                            ]),
                          )
                          .join(" / ")}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[240px]">
                      <div className="stat-shell">
                        <p className="stat-label">Credits left</p>
                        <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">
                          {balance.totalCredits}
                        </p>
                      </div>
                      <div className="stat-shell">
                        <p className="stat-label">Packages</p>
                        <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">
                          {balance.packages.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState title="No active package balances" />
            )}
          </div>
        </Card>

        <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <Card variant="tint" className="space-y-4">
            <div className="section-header">
              <h2 className="section-title">Low balance</h2>
              <Badge tone="warm">{lowBalancePackages.length}</Badge>
            </div>

            <div className="space-y-3">
              {lowBalancePackages.length ? (
                lowBalancePackages.map((customerPackage) => (
                  <Link
                    key={customerPackage.id}
                    href={`/customers/${customerPackage.customerId}`}
                    prefetch={false}
                    className="list-row-quiet block"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{customerPackage.customer.fullName}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {getCustomerBalanceLabel(customerPackage)}
                        </p>
                      </div>
                      <p className="font-display text-2xl leading-none tracking-[-0.04em] text-warm">
                        {customerPackage.remainingCredits}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState title="No low balances" />
              )}
            </div>
          </Card>

          <Card variant="soft" className="space-y-4">
            <h2 className="section-title">Recent sales</h2>
            <div className="space-y-3">
              {recentPackages.length ? (
                recentPackages.map((customerPackage) => (
                  <Link
                    key={customerPackage.id}
                    href={`/customers/${customerPackage.customerId}`}
                    prefetch={false}
                    className="list-row-quiet block"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{customerPackage.customer.fullName}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {getCustomerBalanceLabel(customerPackage)} / {toShortDate(customerPackage.purchaseDate)}
                        </p>
                      </div>
                      <p className="font-semibold text-ink">
                        {formatCurrency(customerPackage.amountPaid.toString())}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState title="No package sales yet" />
              )}
            </div>
          </Card>
        </div>
      </section>

      <section id="sell-package" className="scroll-mt-28 grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
        <Card variant="soft" className="order-2 space-y-5 xl:order-1">
          <div className="section-header">
            <h2 className="section-title">Package templates</h2>
            <Badge tone="plum">{templates.length} active</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.slice(0, 6).map((template) => (
              <div key={template.id} className="drawer-preview">
                <div className="chip-row">
                  <Badge tone={template.category === "GROUP" ? "plum" : "warm"}>{template.category}</Badge>
                </div>
                <p className="mt-3 font-semibold text-ink">{template.name}</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {template.sessionCount} sessions / {template.validityMonths} months
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">{template.classType.name}</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {formatCurrency(template.packagePrice.toString())}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Sheet className="order-1 xl:order-2" title="Sell package">
          <PackageSaleForm
            redirectTo={params.customerId ? `/customers/${params.customerId}` : "/sales/package"}
            initialCustomerId={params.customerId}
            initialPurchaseDate={toDateInputValue(today)}
            customers={customers}
            templates={templates.map((template) => ({
              id: template.id,
              name: template.name,
              category: template.category,
              sessionCount: template.sessionCount,
              validityMonths: template.validityMonths,
              regularPrice: template.regularPrice.toString(),
              packagePrice: template.packagePrice.toString(),
            }))}
          />

          <div className="surface-inset rounded-[24px] p-4">
            <div className="section-header">
              <h3 className="font-display text-[1.45rem] leading-none tracking-[-0.04em] text-ink">After save</h3>
              <Wallet className="size-5 text-accent-strong" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="stat-shell">
                <p className="stat-label">Products</p>
                <p className="mt-2 text-sm font-semibold text-ink">{templates.length} active</p>
              </div>
              <div className="stat-shell">
                <p className="stat-label">Credits</p>
                <p className="mt-2 text-sm font-semibold text-ink">1 per session</p>
              </div>
              <div className="stat-shell">
                <p className="stat-label">Payment</p>
                <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ink">
                  <CalendarClock className="size-3.5 text-accent-strong" />
                  Saved now
                </p>
              </div>
            </div>
          </div>
        </Sheet>
      </section>
    </div>
  );
}
