import { PageHeader } from "@/components/layout/page-header";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCustomerBalanceLabel, getCustomerBalanceSourceLabel } from "@/lib/balances";
import { DEFAULT_REPORT_RANGE_DAYS, LOW_CREDIT_THRESHOLD } from "@/lib/constants";
import { getReportRangeEnd, getReportRangeStart, toDateInputValue, toShortDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { compactList, formatCurrency, formatNumber } from "@/lib/utils";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const fallbackStart = toDateInputValue(getReportRangeStart(DEFAULT_REPORT_RANGE_DAYS));
  const fallbackEnd = toDateInputValue(getReportRangeEnd());
  const start = params.start ?? fallbackStart;
  const end = params.end ?? fallbackEnd;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T23:59:59`);

  const [
    sessions,
    attendanceCount,
    packageSales,
    singleSales,
    trialSales,
    balanceAdjustments,
    restorationEvents,
    remainingCredits,
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
      include: {
        classType: true,
        instructor: true,
        bookings: true,
      },
      orderBy: {
        startsAt: "asc",
      },
    }),
    prisma.booking.count({
      where: {
        status: "ATTENDED",
        session: {
          startsAt: {
            gte: startDate,
            lte: endDate,
          },
        },
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
      include: {
        classType: true,
        customer: true,
        packageTemplate: true,
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
      include: {
        customer: true,
        classType: true,
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
      include: {
        customer: true,
        trialPackageTemplate: true,
        items: true,
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
      include: {
        adjustedByUser: true,
        customerPackage: {
          include: {
            customer: true,
            classType: true,
            packageTemplate: true,
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
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    }),
    prisma.customer.findMany({
      include: {
        packages: {
          where: {
            active: true,
            remainingCredits: {
              gt: 0,
            },
            OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
          },
          include: {
            classType: true,
            packageTemplate: true,
          },
        },
      },
      orderBy: {
        fullName: "asc",
      },
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
        include: {
          classType: true,
          customer: true,
          packageTemplate: true,
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
      include: {
        classType: true,
        customer: true,
        packageTemplate: true,
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
      include: {
        customer: true,
        trialPackageTemplate: true,
        items: {
          include: {
            classType: true,
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
      include: {
        customer: true,
        session: true,
        customerTrialPackage: {
          include: {
            trialPackageTemplate: true,
          },
        },
        customerTrialPackageItem: {
          include: {
            classType: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  const packageSalesTotal = packageSales.reduce((sum, sale) => sum + Number(sale.amountPaid.toString()), 0);
  const singleSalesTotal = singleSales.reduce((sum, sale) => sum + Number(sale.amountPaid.toString()), 0);
  const trialSalesTotal = trialSales.reduce((sum, sale) => sum + Number(sale.amountPaid.toString()), 0);
  const remainingCreditsByCustomer = remainingCredits
    .map((customer) => ({
      customerId: customer.id,
      fullName: customer.fullName,
      remainingCredits: customer.packages.reduce(
        (sum, customerPackage) => sum + customerPackage.remainingCredits,
        0,
      ),
    }))
    .filter((item) => item.remainingCredits > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reports"
        title="Reports"
      />

      <Card variant="tint" className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="space-y-2">
            <p className="section-kicker">Range</p>
            <h2 className="section-title">Date range</h2>
          </div>

          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input name="start" type="date" className="field-input" defaultValue={start} />
            <input name="end" type="date" className="field-input" defaultValue={end} />
            <button type="submit" className={buttonStyles({ variant: "secondary" })}>
              Apply
            </button>
          </form>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="stat-shell">
            <p className="stat-label">Sessions</p>
            <p className="stat-value">{formatNumber(sessions.length)}</p>
          </div>
          <div className="stat-shell">
            <p className="stat-label">Attendance</p>
            <p className="stat-value">{formatNumber(attendanceCount)}</p>
          </div>
          <div className="stat-shell">
            <p className="stat-label">Package sales</p>
            <p className="stat-value">{formatCurrency(packageSalesTotal)}</p>
            <p className="mt-2 text-sm text-muted">{packageSales.length} sales</p>
          </div>
          <div className="stat-shell">
            <p className="stat-label">One-off sales</p>
            <p className="stat-value">{formatCurrency(singleSalesTotal)}</p>
            <p className="mt-2 text-sm text-muted">{singleSales.length} sales</p>
          </div>
          <div className="stat-shell">
            <p className="stat-label">Trial sales</p>
            <p className="stat-value">{formatCurrency(trialSalesTotal)}</p>
            <p className="mt-2 text-sm text-muted">{trialSales.length} sales</p>
          </div>
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="section-kicker">Sessions</p>
            <h2 className="section-title">Sessions</h2>
          </div>
          <div className="space-y-3">
            {sessions.length ? (
              sessions.map((session) => (
                <div key={session.id} className="list-row-quiet">
                  <p className="font-semibold text-ink">{session.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {toShortDate(session.startsAt)} / {session.instructor.fullName} /{" "}
                    {session.bookings.filter((booking) => booking.status !== "CANCELLED").length}/
                    {session.capacity} bookings
                  </p>
                </div>
              ))
            ) : (
              <div className="empty-state">No sessions in this range.</div>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="section-kicker">Balances</p>
            <h2 className="section-title">Customer balances</h2>
          </div>
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
              <div className="empty-state">No active balances.</div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="section-kicker">Adjustments</p>
            <h2 className="section-title">Balance adjustments</h2>
          </div>
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
              <div className="empty-state">No balance adjustments in this range.</div>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="section-kicker">Restorations</p>
            <h2 className="section-title">Restored usage</h2>
          </div>
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
              <div className="empty-state">No restored usage in this range.</div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="section-kicker">Sales log</p>
            <h2 className="section-title">Package sales</h2>
          </div>
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
              <div className="empty-state">No package sales in this range.</div>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="section-kicker">Sales log</p>
            <h2 className="section-title">One-off sales</h2>
          </div>
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
              <div className="empty-state">No one-off sales in this range.</div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="section-kicker">Sales log</p>
            <h2 className="section-title">Trial sales</h2>
          </div>
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
              <div className="empty-state">No trial sales in this range.</div>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="section-kicker">Trials</p>
            <h2 className="section-title">Active balances</h2>
          </div>
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
              <div className="empty-state">No active trial balances.</div>
            )}
          </div>
        </Card>
      </section>

      <section>
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="section-kicker">Usage</p>
            <h2 className="section-title">Trial usage</h2>
          </div>
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
              <div className="empty-state">No trial usage in this range.</div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="section-kicker">Expired</p>
            <h2 className="section-title">Expired packages</h2>
          </div>
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
              <div className="empty-state">No expired packages with sessions left.</div>
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="section-kicker">Low balance</p>
            <h2 className="section-title">Follow-up</h2>
          </div>
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
              <div className="empty-state">No low-balance customers.</div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
