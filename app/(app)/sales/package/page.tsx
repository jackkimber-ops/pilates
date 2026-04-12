import Link from "next/link";
import { CalendarClock, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { getToday, toDateInputValue } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { PackageSaleForm } from "@/app/(app)/sales/package/package-sale-form";

export default async function SellPackagePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const params = await searchParams;
  const customers = await prisma.customer.findMany({
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
  });

  const templates = await prisma.packageTemplate.findMany({
    where: {
      active: true,
    },
    include: {
      classType: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ classType: { name: "asc" } }, { sessionCount: "asc" }],
  });

  return (
    <div className="page-stack">
      <PageHeader
        title="Sell package"
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
                <h2 className="section-title">Package</h2>
                <Badge tone="plum">Active</Badge>
              </div>
              <div className="space-y-3">
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Class type must match</p>
                </div>
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Expiry is automatic</p>
                </div>
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">1 session = 1 credit</p>
                </div>
              </div>
            </Card>

            <Card variant="plain" className="p-0">
              <div className="grid gap-3 sm:grid-cols-2">
                {templates.slice(0, 4).map((template) => (
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
          </div>

          <Sheet className="order-1 xl:order-2" title="Package">
            <PackageSaleForm
              redirectTo={params.customerId ? `/customers/${params.customerId}` : "/customers"}
              initialCustomerId={params.customerId}
              initialPurchaseDate={toDateInputValue(getToday())}
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
                  <p className="stat-label">Validity</p>
                  <p className="mt-2 text-sm font-semibold text-ink">3, 6, 12, 24 months</p>
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
        </div>
      </section>
    </div>
  );
}
