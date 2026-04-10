import Link from "next/link";
import { Sparkles, Ticket } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { getToday, toDateInputValue } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { TrialSaleForm } from "@/app/(app)/sales/trial/trial-sale-form";

export default async function SellTrialPackagePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const params = await searchParams;

  const [customers, templates] = await Promise.all([
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
  ]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Trials"
        title="Sell trial"
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
                  <p className="section-kicker">Rules</p>
                  <h2 className="section-title">Trial</h2>
                </div>
                <Badge tone="plum">New only</Badge>
              </div>

              <div className="space-y-3">
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Class type must match</p>
                </div>
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Used on attendance</p>
                </div>
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Warning only</p>
                </div>
              </div>
            </Card>

            <Card variant="plain" className="p-0">
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
          </div>

          <Sheet className="order-1 xl:order-2" eyebrow="Trial" title="Trial">
            <TrialSaleForm
              redirectTo={params.customerId ? `/customers/${params.customerId}` : "/customers"}
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
                <div className="space-y-2">
                  <p className="section-kicker">Summary</p>
                  <h3 className="font-display text-[1.45rem] leading-none tracking-[-0.04em] text-ink">After save</h3>
                </div>
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
        </div>
      </section>
    </div>
  );
}
