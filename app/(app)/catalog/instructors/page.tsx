import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { InstructorForm } from "@/app/(app)/catalog/instructors/instructor-form";
import { prisma } from "@/lib/prisma";

export default async function InstructorsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;
  const instructors = await prisma.instructor.findMany({
    orderBy: {
      fullName: "asc",
    },
  });
  const editing = instructors.find((instructor) => instructor.id === params.edit);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog"
        title="Instructors"
      />

      <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
        <Card variant="tint">
          <InstructorForm
            redirectTo="/catalog/instructors"
            initialValues={
              editing
                ? {
                    id: editing.id,
                    fullName: editing.fullName,
                    active: editing.active,
                  }
                : undefined
            }
          />
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="px-6 py-5">
            <p className="section-kicker">List</p>
            <h2 className="mt-2 section-title">Instructors</h2>
          </div>

          {instructors.length ? (
            <div className="divide-y divide-line">
              {instructors.map((instructor) => (
                <div key={instructor.id} className="px-6 py-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                      <StatusBadge status={instructor.active ? "ACTIVE" : "INACTIVE"} />
                      <h2 className="font-display text-[1.8rem] leading-none tracking-[-0.04em] text-ink">
                        {instructor.fullName}
                      </h2>
                    </div>
                    <Link
                      href={`/catalog/instructors?edit=${instructor.id}`}
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
              <div className="empty-state">No instructors yet.</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
