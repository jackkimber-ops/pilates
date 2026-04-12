import Link from "next/link";
import { CalendarCheck2, Ticket, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { getToday, toDateInputValue } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { SingleSaleForm } from "@/app/(app)/sales/single/single-sale-form";

export default async function SellSingleClassPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const params = await searchParams;
  const [customers, classTypes] = await Promise.all([
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
    prisma.classType.findMany({
      where: {
        active: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        defaultSinglePrice: true,
      },
    }),
  ]);

  return (
    <div className="page-stack">
      <PageHeader
        title="Sell one-off"
        actions={
          <Link href="/customers" className={buttonStyles({ variant: "secondary" })}>
            Customers
          </Link>
        }
      />

      <section className="mock-stage">
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1fr_460px]">
          <div className="order-2 space-y-4 xl:order-1">
            <Card variant="soft" className="space-y-5">
              <div className="section-header">
                <h2 className="section-title">One-off</h2>
                <Badge tone="warm">Single use</Badge>
              </div>
              <div className="space-y-3">
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Used on attendance</p>
                </div>
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Category must match</p>
                </div>
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">No package change</p>
                </div>
              </div>
            </Card>

            <Card variant="plain" className="p-0">
              <div className="grid gap-3 sm:grid-cols-2">
                {classTypes.slice(0, 4).map((classType) => (
                  <div key={classType.id} className="drawer-preview">
                    <div className="chip-row">
                      <Badge tone={classType.category === "GROUP" ? "plum" : "warm"}>
                        {classType.category}
                      </Badge>
                    </div>
                    <p className="mt-3 font-semibold text-ink">{classType.name}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {formatCurrency(classType.defaultSinglePrice.toString())}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Sheet className="order-1 xl:order-2" title="One-off">
            <SingleSaleForm
              redirectTo={params.customerId ? `/customers/${params.customerId}` : "/customers"}
              initialCustomerId={params.customerId}
              initialPurchaseDate={toDateInputValue(getToday())}
              customers={customers}
              classTypes={classTypes.map((classType) => ({
                ...classType,
                defaultSinglePrice: classType.defaultSinglePrice.toString(),
              }))}
            />

            <div className="surface-inset rounded-[24px] p-4">
              <div className="section-header">
                <h3 className="font-display text-[1.45rem] leading-none tracking-[-0.04em] text-ink">After save</h3>
                <WalletCards className="size-5 text-accent-strong" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="stat-shell">
                  <p className="stat-label">Class types</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{classTypes.length} active</p>
                </div>
                <div className="stat-shell">
                  <p className="stat-label">Used on</p>
                  <p className="mt-2 text-sm font-semibold text-ink">Attendance</p>
                </div>
                <div className="stat-shell">
                  <p className="stat-label">Package impact</p>
                  <p className="mt-2 text-sm font-semibold text-ink">None</p>
                </div>
              </div>
              <div className="mt-4 chip-row">
                <Badge tone="warm">
                  <Ticket className="mr-1 size-3.5" />
                  One use
                </Badge>
                <Badge tone="outline">
                  <CalendarCheck2 className="mr-1 size-3.5" />
                  Match category
                </Badge>
              </div>
            </div>
          </Sheet>
        </div>
      </section>
    </div>
  );
}
