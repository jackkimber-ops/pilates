import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCustomerBalanceLabel, getCustomerBalanceSourceLabel } from "@/lib/balances";
import { LOW_CREDIT_THRESHOLD } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { compactList, formatCurrency } from "@/lib/utils";
import { toShortDate } from "@/lib/date";

export async function ReportsContent({
  startDate,
  endDate,
}: {
  startDate: Date;
  endDate: Date;
}) {
  const [
    sessions,
    packageSales,
    singleSales,
    trialSales,
    balanceAdjustments,
    restorationEvents,
    remainingCreditsByCustomer,
    expiredPackages,
    lowBalanceCustomers,
    activeTrialPackages,
    trialUsage,
  ] = await Promise.all([
    prisma.session.findMany({
      where: {
        startsAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        capacity: true,
        instructor: {
          select: {
            fullName: true,
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
    prisma.customerPackage.findMany({
      where: {
        sourceType: "PACKAGE_SALE",
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        purchaseDate: true,
        amountPaid: true,
        sourceType: true,
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
    }),
    prisma.singleClassPurchase.findMany({
      where: {
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        customerId: true,
        category: true,
        purchaseDate: true,
        amountPaid: true,
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
      orderBy: {
        purchaseDate: "desc",
      },
    }),
    prisma.customerTrialPackage.findMany({
      where: {
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
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
    }),
    prisma.packageAdjustment.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        deltaCredits: true,
        reason: true,
        notes: true,
        createdAt: true,
        adjustedByUser: {
          select: {
            name: true,
          },
        },
        customerPackage: {
          select: {
            sourceType: true,
            customer: {
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
            packageTemplate: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: {
        action: {
          in: ["RESTORE_BOOKING_USAGE", "RESTORE_CANCELLED_SESSION_USAGE"],
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    }),
    prisma.customerPackage.groupBy({
      by: ["customerId"],
      where: {
        active: true,
        remainingCredits: {
          gt: 0,
        },
        OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
      },
      _sum: {
        remainingCredits: true,
      },
    }).then(async (groups) => {
      const customerIds = groups.map((group) => group.customerId);
      if (!customerIds.length) {
        return [];
      }

      const customers = await prisma.customer.findMany({
        where: {
          id: {
            in: customerIds,
          },
        },
        select: {
          id: true,
          fullName: true,
        },
      });

      const customerMap = new Map(customers.map((customer) => [customer.id, customer.fullName]));
      return groups
        .map((group) => ({
          customerId: group.customerId,
          fullName: customerMap.get(group.customerId) ?? "Customer",
          remainingCredits: group._sum.remainingCredits ?? 0,
        }))
        .filter((item) => item.remainingCredits > 0)
        .sort((left, right) => left.fullName.localeCompare(right.fullName));
    }),
    prisma.customerPackage.findMany({
      where: {
        expiryDate: {
          lt: new Date(),
        },
        remainingCredits: {
          gt: 0,
        },
      },
      select: {
        id: true,
        remainingCredits: true,
        expiryDate: true,
        sourceType: true,
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
      take: 10,
    }),
    prisma.customerPackage.findMany({
      where: {
        active: true,
        remainingCredits: {
          lte: LOW_CREDIT_THRESHOLD,
          gt: 0,
        },
        OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
      },
      select: {
        id: true,
        remainingCredits: true,
        sourceType: true,
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
      take: 10,
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
      take: 12,
    }),
    prisma.booking.findMany({
      where: {
        paymentSourceType: "TRIAL",
        trialUseConsumed: true,
        session: {
          startsAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      select: {
        id: true,
        status: true,
        customer: {
          select: {
            fullName: true,
          },
        },
        session: {
          select: {
            title: true,
            startsAt: true,
          },
        },
        customerTrialPackage: {
          select: {
            trialPackageTemplate: {
              select: {
                name: true,
              },
            },
          },
        },
        customerTrialPackageItem: {
          select: {
            classType: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="section-title">Sessions</h2>
          <div className="space-y-3">
            {sessions.length ? (
              sessions.map((session) => (
                <div key={session.id} className="list-row-quiet">
                  <p className="font-semibold text-ink">{session.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {toShortDate(session.startsAt)} / {session.instructor.fullName} /{" "}
                    {session._count.bookings}/{session.capacity} bookings
                  </p>
                </div>
              ))
            ) : (
              <EmptyState title="No sessions in this range" />
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="section-title">Customer balances</h2>
          <div className="space-y-3">
            {remainingCreditsByCustomer.length ? (
              remainingCreditsByCustomer.map((customer) => (
                <div key={customer.customerId} className="list-row-quiet">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{customer.fullName}</p>
                    <p className="text-2xl font-display tracking-[-0.04em] text-ink">
                      {customer.remainingCredits}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No active balances" />
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="section-title">Balance adjustments</h2>
          <div className="space-y-3">
            {balanceAdjustments.length ? (
              balanceAdjustments.map((adjustment) => (
                <div key={adjustment.id} className="list-row-quiet">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {adjustment.customerPackage.customer.fullName}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {compactList([
                          `${adjustment.deltaCredits > 0 ? "+" : ""}${adjustment.deltaCredits} credit${Math.abs(adjustment.deltaCredits) === 1 ? "" : "s"}`,
                          getCustomerBalanceLabel(adjustment.customerPackage),
                          adjustment.reason,
                        ])}
                      </p>
                      {adjustment.notes ? (
                        <p className="mt-1 text-sm leading-6 text-muted">{adjustment.notes}</p>
                      ) : null}
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">
                      {compactList([toShortDate(adjustment.createdAt), adjustment.adjustedByUser.name])}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No balance adjustments in this range" />
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="section-title">Restored usage</h2>
          <div className="space-y-3">
            {restorationEvents.length ? (
              restorationEvents.map((event) => {
                const details =
                  typeof event.details === "object" && event.details !== null ? event.details : {};
                const restoredSources = Array.isArray((details as { restoredSources?: unknown }).restoredSources)
                  ? ((details as { restoredSources?: string[] }).restoredSources ?? []).join(" / ")
                  : null;

                return (
                  <div key={event.id} className="list-row-quiet">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">
                          {event.action === "RESTORE_CANCELLED_SESSION_USAGE"
                            ? "Cancelled session restore"
                            : "Booking usage restored"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {compactList([
                            restoredSources,
                            typeof (details as { status?: unknown }).status === "string"
                              ? (details as { status?: string }).status?.replaceAll("_", " ")
                              : null,
                          ])}
                        </p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">
                        {compactList([toShortDate(event.createdAt), event.user?.name ?? null])}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState title="No restored usage in this range" />
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="section-title">Package sales</h2>
          <div className="space-y-3">
            {packageSales.length ? (
              packageSales.map((sale) => (
                <div key={sale.id} className="list-row-quiet">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{sale.customer.fullName}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {getCustomerBalanceLabel(sale)} / {toShortDate(sale.purchaseDate)}
                      </p>
                    </div>
                    <p className="font-semibold text-ink">{formatCurrency(sale.amountPaid.toString())}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No package sales in this range" />
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="section-title">One-off sales</h2>
          <div className="space-y-3">
            {singleSales.length ? (
              singleSales.map((sale) => (
                <div key={sale.id} className="list-row-quiet">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{sale.customer.fullName}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {sale.classType?.name ?? `${sale.category} one-off`} / {toShortDate(sale.purchaseDate)}
                      </p>
                    </div>
                    <p className="font-semibold text-ink">{formatCurrency(sale.amountPaid.toString())}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No one-off sales in this range" />
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="section-title">Trial sales</h2>
          <div className="space-y-3">
            {trialSales.length ? (
              trialSales.map((sale) => (
                <div key={sale.id} className="list-row-quiet">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{sale.customer.fullName}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {sale.trialPackageTemplate.name} / {toShortDate(sale.purchaseDate)}
                      </p>
                    </div>
                    <p className="font-semibold text-ink">{formatCurrency(sale.amountPaid.toString())}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No trial sales in this range" />
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="section-title">Active trials</h2>
          <div className="space-y-3">
            {activeTrialPackages.length ? (
              activeTrialPackages.map((trialPackage) => (
                <div key={trialPackage.id} className="list-row-quiet">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{trialPackage.customer.fullName}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{trialPackage.trialPackageTemplate.name}</p>
                      </div>
                      <p className="font-semibold text-ink">
                        {trialPackage.items.reduce((sum, item) => sum + item.remainingQuantity, 0)} left
                      </p>
                    </div>
                    <p className="text-sm leading-6 text-muted">
                      {trialPackage.items
                        .filter((item) => item.remainingQuantity > 0)
                        .map((item) => `${item.classType.name}: ${item.remainingQuantity}/${item.originalQuantity}`)
                        .join(" / ")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No active trial balances" />
            )}
          </div>
        </Card>
      </section>

      <section>
        <Card className="space-y-4">
          <h2 className="section-title">Trial usage</h2>
          <div className="space-y-3">
            {trialUsage.length ? (
              trialUsage.map((booking) => (
                <div key={booking.id} className="list-row-quiet">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{booking.customer.fullName}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {[
                          booking.customerTrialPackage?.trialPackageTemplate.name ?? "Trial package",
                          booking.customerTrialPackageItem?.classType.name ?? booking.session.title,
                          toShortDate(booking.session.startsAt),
                        ].join(" / ")}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-muted">{booking.status.replaceAll("_", " ")}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No trial usage in this range" />
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="section-title">Expired packages</h2>
          <div className="space-y-3">
            {expiredPackages.length ? (
              expiredPackages.map((customerPackage) => (
                <div key={customerPackage.id} className="list-row-quiet">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{customerPackage.customer.fullName}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {getCustomerBalanceLabel(customerPackage)} / {customerPackage.remainingCredits} sessions left
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">
                      {customerPackage.expiryDate ? toShortDate(customerPackage.expiryDate) : "No expiry"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No expired packages with sessions left" />
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="section-title">Follow-up</h2>
          <div className="space-y-3">
            {lowBalanceCustomers.length ? (
              lowBalanceCustomers.map((customerPackage) => (
                <div key={customerPackage.id} className="list-row-quiet">
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
                    <p className="text-2xl font-display tracking-[-0.04em] text-warm">
                      {customerPackage.remainingCredits}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No low-balance customers" />
            )}
          </div>
        </Card>
      </section>
    </>
  );
}
