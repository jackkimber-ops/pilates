import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEFAULT_REPORT_RANGE_DAYS } from "@/lib/constants";
import { getReportRangeEnd, getReportRangeStart, toDateInputValue } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ReportsContent } from "@/app/(app)/reports/reports-content";

function ReportsSectionsFallback() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, sectionIndex) => (
        <section key={sectionIndex} className="grid gap-6 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((__, cardIndex) => (
            <Card key={cardIndex} className="space-y-4">
              <div className="h-4 w-32 rounded-full bg-[rgba(122,109,105,0.14)]" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((___, rowIndex) => (
                  <div key={rowIndex} className="list-row-quiet space-y-3">
                    <div className="h-4 w-36 rounded-full bg-[rgba(122,109,105,0.12)]" />
                    <div className="h-3 w-full rounded-full bg-[rgba(122,109,105,0.08)]" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}

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

  const [sessionCount, attendanceCount, packageSalesSummary, singleSalesSummary, trialSalesSummary] =
    await Promise.all([
      prisma.session.count({
        where: {
          startsAt: {
            gte: startDate,
            lte: endDate,
          },
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
      prisma.customerPackage.aggregate({
        where: {
          sourceType: "PACKAGE_SALE",
          purchaseDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountPaid: true,
        },
      }),
      prisma.singleClassPurchase.aggregate({
        where: {
          purchaseDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountPaid: true,
        },
      }),
      prisma.customerTrialPackage.aggregate({
        where: {
          purchaseDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          amountPaid: true,
        },
      }),
    ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Reports" />

      <Card variant="tint" className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <h2 className="section-title">Date range</h2>

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
            <p className="stat-value">{formatNumber(sessionCount)}</p>
          </div>
          <div className="stat-shell">
            <p className="stat-label">Attendance</p>
            <p className="stat-value">{formatNumber(attendanceCount)}</p>
          </div>
          <div className="stat-shell">
            <p className="stat-label">Package sales</p>
            <p className="stat-value">{formatCurrency(packageSalesSummary._sum.amountPaid?.toString() ?? "0")}</p>
            <p className="mt-2 text-sm text-muted">{packageSalesSummary._count._all} sales</p>
          </div>
          <div className="stat-shell">
            <p className="stat-label">One-off sales</p>
            <p className="stat-value">{formatCurrency(singleSalesSummary._sum.amountPaid?.toString() ?? "0")}</p>
            <p className="mt-2 text-sm text-muted">{singleSalesSummary._count._all} sales</p>
          </div>
          <div className="stat-shell">
            <p className="stat-label">Trial sales</p>
            <p className="stat-value">{formatCurrency(trialSalesSummary._sum.amountPaid?.toString() ?? "0")}</p>
            <p className="mt-2 text-sm text-muted">{trialSalesSummary._count._all} sales</p>
          </div>
        </div>
      </Card>

      <Suspense fallback={<ReportsSectionsFallback />}>
        <ReportsContent startDate={startDate} endDate={endDate} />
      </Suspense>
    </div>
  );
}
