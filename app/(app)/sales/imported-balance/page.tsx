import Link from "next/link";
import { Database, Layers3 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { prisma } from "@/lib/prisma";
import { ImportedBalanceForm } from "@/app/(app)/sales/imported-balance/imported-balance-form";

export default async function ImportedBalancePage({
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
      },
    }),
  ]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Balances"
        title="Add imported balance"
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
                <div className="space-y-2">
                  <p className="section-kicker">Migration</p>
                  <h2 className="section-title">Existing sessions</h2>
                </div>
                <Badge tone="plum">Imported</Badge>
              </div>
              <div className="space-y-3">
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Exact class type</p>
                </div>
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Used in future bookings</p>
                </div>
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Deducted on attendance</p>
                </div>
              </div>
            </Card>

            <Card variant="plain" className="p-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="drawer-preview">
                  <Layers3 className="size-5 text-accent-strong" />
                  <p className="mt-3 font-semibold text-ink">{classTypes.length} class types</p>
                  <p className="mt-1 text-sm leading-6 text-muted">Import by exact class type.</p>
                </div>
                <div className="drawer-preview">
                  <Database className="size-5 text-accent-strong" />
                  <p className="mt-3 font-semibold text-ink">{customers.length} active customers</p>
                  <p className="mt-1 text-sm leading-6 text-muted">Add balances without recording a new sale.</p>
                </div>
              </div>
            </Card>
          </div>

          <Sheet className="order-1 xl:order-2" eyebrow="Imported" title="Balance">
            <ImportedBalanceForm
              redirectTo={params.customerId ? `/customers/${params.customerId}` : "/customers"}
              initialCustomerId={params.customerId}
              customers={customers}
              classTypes={classTypes}
            />
          </Sheet>
        </div>
      </section>
    </div>
  );
}

