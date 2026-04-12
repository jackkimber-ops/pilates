import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { getCurrentUser } from "@/lib/auth/session";
import { combineDateAndTime, getToday, toDateInputValue } from "@/lib/date";
import { getSessionCreateOptions } from "@/lib/session-create-options";
import { SessionForm } from "@/app/(app)/sessions/session-form";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; time?: string }>;
}) {
  const params = await searchParams;
  const today = getToday();
  const user = await getCurrentUser();
  const initialDate = params.date ?? toDateInputValue(today);
  const initialTime = params.time ?? "08:00";
  const { classTypes, instructors, customers, packageAvailability, defaultInstructorId } =
    await getSessionCreateOptions({
      balanceValidFrom: combineDateAndTime(initialDate, initialTime),
      user,
    });

  return (
    <div className="page-stack">
      <PageHeader title="Create session" />

      <section className="mock-stage">
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1fr_460px]">
          <div className="order-2 space-y-4 xl:order-1">
            <Card variant="soft" className="space-y-5">
              <div className="section-header">
                <h2 className="section-title">Create session</h2>
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
            title="Create session"
          >
            <SessionForm
              classTypes={classTypes}
              instructors={instructors}
              customers={customers.map((customer) => ({
                id: customer.id,
                fullName: customer.fullName,
              }))}
              packageAvailability={packageAvailability}
              initialValues={{
                date: initialDate,
                startTime: initialTime,
                classTypeId: classTypes[0]?.id,
                instructorId: defaultInstructorId || instructors[0]?.id,
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
