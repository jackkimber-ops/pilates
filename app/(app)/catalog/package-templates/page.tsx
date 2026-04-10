import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PackageTemplateForm } from "@/app/(app)/catalog/package-templates/package-template-form";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export default async function PackageTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;
  const [packageTemplates, classTypes] = await Promise.all([
    prisma.packageTemplate.findMany({
      include: {
        classType: true,
      },
      orderBy: [{ classType: { name: "asc" } }, { sessionCount: "asc" }],
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
      },
    }),
  ]);
  const editing = packageTemplates.find((template) => template.id === params.edit);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog"
        title="Package templates"
      />

      <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
        <Card variant="tint">
          <PackageTemplateForm
            redirectTo="/catalog/package-templates"
            classTypes={classTypes}
            initialValues={
              editing
                ? {
                    id: editing.id,
                    name: editing.name,
                    classTypeId: editing.classTypeId,
                    sessionCount: editing.sessionCount,
                    validityMonths: editing.validityMonths,
                    regularPrice: editing.regularPrice.toString(),
                    packagePrice: editing.packagePrice.toString(),
                    active: editing.active,
                  }
                : undefined
            }
          />
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="px-6 py-5">
            <p className="section-kicker">List</p>
            <h2 className="mt-2 section-title">Package templates</h2>
          </div>

          {packageTemplates.length ? (
            <div className="divide-y divide-line">
              {packageTemplates.map((template) => (
                <div key={template.id} className="px-6 py-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={template.category} />
                        <StatusBadge status={template.active ? "ACTIVE" : "INACTIVE"} />
                      </div>
                      <div className="space-y-1">
                        <h2 className="font-display text-[1.8rem] leading-none tracking-[-0.04em] text-ink">
                          {template.name}
                        </h2>
                        <p className="text-sm leading-6 text-muted">
                          {template.classType.name} / {template.sessionCount} sessions / {template.validityMonths} months
                        </p>
                        <p className="text-sm leading-6 text-muted">
                          Regular {formatCurrency(template.regularPrice.toString())} / Package{" "}
                          {formatCurrency(template.packagePrice.toString())}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/catalog/package-templates?edit=${template.id}`}
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
              <div className="empty-state">No package templates yet.</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
