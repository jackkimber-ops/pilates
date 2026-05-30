import { addDays } from "date-fns";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { toggleRecurringRuleAction } from "@/app/(app)/actions";
import { RecurringGenerationForm } from "@/app/(app)/recurring/recurring-generation-form";
import { RecurringRuleForm } from "@/app/(app)/recurring/recurring-rule-form";
import { getToday, toDateInputValue } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { compactList } from "@/lib/utils";

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const params = await searchParams;
  const [customers, classTypes, instructors, rules] = await Promise.all([
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
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
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
    prisma.recurringBookingRule.findMany({
      include: {
        customer: true,
        classType: true,
        instructor: true,
      },
      orderBy: [{ active: "desc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const today = getToday();
  const activeRuleCount = rules.filter((rule) => rule.active).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Recurring"
        actions={
          <Link href="#new-recurring" className={buttonStyles({ size: "lg" })}>
            <Plus className="size-4" />
            New recurring
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="space-y-5">
          <div className="section-header">
            <div className="space-y-2">
              <p className="section-kicker">Active setup</p>
              <h2 className="section-title">Recurring bookings</h2>
            </div>
            <Badge tone="outline">{activeRuleCount} active</Badge>
          </div>

          <div className="space-y-4">
            {rules.length ? (
              rules.map((rule) => {
                const generationStartDate = rule.startDate > today ? rule.startDate : today;
                const defaultGenerationEnd = addDays(generationStartDate, 56);
                const generationEndDate =
                  rule.endDate && rule.endDate < defaultGenerationEnd ? rule.endDate : defaultGenerationEnd;

                return (
                  <div key={rule.id} className="list-row space-y-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={rule.active ? "ACTIVE" : "INACTIVE"} />
                          <StatusBadge status={rule.paymentSourceType} />
                        </div>
                        <div className="space-y-1">
                          <h2 className="font-display text-[1.8rem] leading-none tracking-[-0.04em] text-ink">
                            {rule.customer.fullName}
                          </h2>
                          <p className="text-sm leading-6 text-muted">
                            {compactList([
                              rule.dayOfWeek.replaceAll("_", " "),
                              rule.startTime,
                              rule.classType.name,
                              rule.instructor?.fullName ?? "No instructor assigned",
                            ])}
                          </p>
                        </div>
                      </div>

                      <form action={toggleRecurringRuleAction}>
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <input type="hidden" name="active" value={rule.active ? "false" : "true"} />
                        <input type="hidden" name="redirectTo" value="/recurring" />
                        <button
                          type="submit"
                          className={buttonStyles({
                            variant: rule.active ? "secondary" : "primary",
                            size: "sm",
                          })}
                        >
                          {rule.active ? "Pause" : "Reactivate"}
                        </button>
                      </form>
                    </div>

                    <div className="surface-inset rounded-[24px] p-4">
                      <p className="font-semibold text-ink">Generate sessions</p>
                      <div className="mt-4">
                        <RecurringGenerationForm
                          ruleId={rule.id}
                          startDate={toDateInputValue(generationStartDate)}
                          endDate={toDateInputValue(generationEndDate)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">No recurring rules yet.</div>
            )}
          </div>
        </Card>

        <Card
          id="new-recurring"
          variant="tint"
          className="scroll-mt-28 space-y-5 self-start xl:sticky xl:top-24"
        >
          <h2 className="section-title">New rule</h2>

          <RecurringRuleForm
            redirectTo="/recurring"
            initialCustomerId={params.customerId}
            initialStartDate={toDateInputValue(today)}
            customers={customers}
            classTypes={classTypes}
            instructors={instructors}
          />
        </Card>
      </div>
    </div>
  );
}
