import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClassTypeForm } from "@/app/(app)/catalog/class-types/class-type-form";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export default async function ClassTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;
  const classTypes = await prisma.classType.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  const editing = classTypes.find((classType) => classType.id === params.edit);

  return (
    <div className="space-y-8">
      <PageHeader title="Class types" />

      <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
        <Card variant="tint">
          <ClassTypeForm
            redirectTo="/catalog/class-types"
            initialValues={
              editing
                ? {
                    id: editing.id,
                    name: editing.name,
                    category: editing.category,
                    durationMinutes: editing.durationMinutes,
                    defaultSinglePrice: editing.defaultSinglePrice.toString(),
                    maxCapacity: editing.maxCapacity,
                    color: editing.color,
                    active: editing.active,
                  }
                : undefined
            }
          />
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="px-6 py-5">
            <h2 className="section-title">Class types</h2>
          </div>

          {classTypes.length ? (
            <div className="divide-y divide-line">
              {classTypes.map((classType) => (
                <div key={classType.id} className="px-6 py-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={classType.category} />
                        <StatusBadge status={classType.active ? "ACTIVE" : "INACTIVE"} />
                      </div>
                      <div className="space-y-1">
                        <h2 className="font-display text-[1.8rem] leading-none tracking-[-0.04em] text-ink">
                          {classType.name}
                        </h2>
                        <p className="text-sm leading-6 text-muted">
                          {classType.durationMinutes} min / Capacity {classType.maxCapacity} / One-off{" "}
                          {formatCurrency(classType.defaultSinglePrice.toString())}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/catalog/class-types?edit=${classType.id}`}
                      className={buttonStyles({ variant: "secondary", size: "sm" })}
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 pb-6">
              <div className="empty-state">No class types yet.</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
