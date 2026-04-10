import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { CustomerForm } from "@/app/(app)/customers/customer-form";
import { prisma } from "@/lib/prisma";

export default async function NewCustomerPage() {
  const classTypes = await prisma.classType.findMany({
    where: {
      active: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
    },
  });

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Customers"
        title="Add customer"
      />

      <section className="mock-stage">
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1fr_460px]">
          <div className="order-2 space-y-4 xl:order-1">
            <Card variant="soft" className="space-y-5">
              <div className="section-header">
                <div className="space-y-2">
                  <p className="section-kicker">Fields</p>
                  <h2 className="section-title">Customer</h2>
                </div>
              </div>
              <div className="space-y-3">
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Name, contact, status, notes</p>
                </div>
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Tags optional</p>
                </div>
              </div>
            </Card>
          </div>

          <Sheet
            className="order-1 xl:order-2"
            eyebrow="New customer"
            title="Customer"
          >
            <CustomerForm redirectTo="/customers" classTypes={classTypes} />
          </Sheet>
        </div>
      </section>
    </div>
  );
}
