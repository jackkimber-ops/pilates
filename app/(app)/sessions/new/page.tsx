import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { getToday, toDateInputValue } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { SessionForm } from "@/app/(app)/sessions/session-form";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; time?: string }>;
}) {
  const params = await searchParams;
  const [classTypes, instructors, customers] = await Promise.all([
    prisma.classType.findMany({
      where: {
        active: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        maxCapacity: true,
      },
    }),
    prisma.instructor.findMany({
      where: {
        active: true,
      },
      orderBy: {
        fullName: "asc",
      },
      select: {
        id: true,
        fullName: true,
      },
    }),
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
        packages: {
          where: {
            active: true,
            remainingCredits: {
              gt: 0,
            },
            OR: [{ expiryDate: null }, { expiryDate: { gte: getToday() } }],
          },
          include: {
            classType: true,
            packageTemplate: true,
          },
          orderBy: [{ purchaseDate: "asc" }],
        },
      },
    }),
  ]);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Calendar" title="Create session" />

      <section className="mock-stage">
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1fr_460px]">
          <div className="order-2 space-y-4 xl:order-1">
            <Card variant="soft" className="space-y-5">
              <div className="section-header">
                <div className="space-y-2">
                  <p className="section-kicker">Rules</p>
                  <h2 className="section-title">Create and book</h2>
                </div>
                <Badge tone="warm">1 room</Badge>
              </div>
              <div className="space-y-3">
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">No overlapping sessions</p>
                </div>
                <div className="list-row-quiet">
                  <p className="font-semibold text-ink">Matching balance required</p>
                </div>
              </div>
            </Card>
          </div>

          <Sheet
            className="order-1 xl:order-2"
            eyebrow="Session"
            title="Create session"
          >
            <SessionForm
              classTypes={classTypes}
              instructors={instructors}
              customers={customers.map((customer) => ({
                id: customer.id,
                fullName: customer.fullName,
              }))}
              packageAvailability={customers.flatMap((customer) =>
                Array.from(
                  new Map(
                    customer.packages.map((customerPackage) => [
                      customerPackage.classTypeId,
                      {
                        customerId: customer.id,
                        classTypeId: customerPackage.classTypeId,
                        totalRemainingCredits: customer.packages
                          .filter(
                            (entry) => entry.classTypeId === customerPackage.classTypeId,
                          )
                          .reduce((sum, entry) => sum + entry.remainingCredits, 0),
                        nextPackageName:
                          customerPackage.packageTemplate?.name ??
                          `${customerPackage.classType.name} imported balance`,
                        nextPackageRemainingCredits: customerPackage.remainingCredits,
                        sourceType: customerPackage.sourceType,
                      },
                    ]),
                  ).values(),
                ),
              )}
              initialValues={{
                date: params.date ?? toDateInputValue(getToday()),
                startTime: params.time ?? "08:00",
                classTypeId: classTypes[0]?.id,
                instructorId: instructors[0]?.id,
                title: classTypes[0]?.name,
                capacity: classTypes[0]?.maxCapacity ?? 6,
              }}
            />
          </Sheet>
        </div>
      </section>
    </div>
  );
}
