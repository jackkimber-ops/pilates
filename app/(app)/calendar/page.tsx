import Link from "next/link";
import { addDays } from "date-fns";
import { Clock3 } from "lucide-react";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getToday, toDateTimeLabel } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { compactList } from "@/lib/utils";

export default async function CalendarPage() {
  const today = getToday();
  const tomorrow = addDays(today, 1);

  const [todaySessions, upcomingSessions] = await Promise.all([
    prisma.session.findMany({
      where: {
        status: "SCHEDULED",
          startsAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      select: {
        id: true,
        title: true,
        startsAt: true,
        capacity: true,
        instructor: {
          select: {
            fullName: true,
          },
        },
        classType: {
          select: {
            category: true,
          },
        },
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  not: "CANCELLED",
                },
              },
            },
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
    }),
    prisma.session.findMany({
      where: {
        status: "SCHEDULED",
      },
      select: {
        id: true,
        title: true,
        status: true,
        startsAt: true,
        capacity: true,
        instructor: {
          select: {
            fullName: true,
          },
        },
        classType: {
          select: {
            category: true,
          },
        },
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  not: "CANCELLED",
                },
              },
            },
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
      take: 6,
    }),
  ]);

  const todayBookingCount = todaySessions.reduce((sum, session) => sum + session._count.bookings, 0);
  const todayInstructorCount = new Set(todaySessions.map((session) => session.instructor.fullName)).size;
  const nextSession = upcomingSessions[0] ?? null;

  return (
    <div className="page-stack">
      <section className="mock-stage calendar-stage">
        <div className="relative z-10 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_288px]">
          <CalendarBoard />

          <div className="space-y-4 self-start 2xl:sticky 2xl:top-24">
            <Card variant="tint" className="space-y-4">
              <div className="section-header">
                <h2 className="section-title">Today</h2>
                <Badge tone="plum">Live</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 2xl:grid-cols-1">
                <div className="stat-shell">
                  <p className="stat-label">Sessions today</p>
                  <p className="metric-number mt-3">{todaySessions.length}</p>
                </div>
                <div className="stat-shell">
                  <p className="stat-label">Bookings today</p>
                  <p className="metric-number mt-3">{todayBookingCount}</p>
                </div>
                <div className="stat-shell">
                  <p className="stat-label">Instructors in room</p>
                  <p className="metric-number mt-3">{todayInstructorCount}</p>
                </div>
              </div>

              <div className="surface-inset rounded-[24px] p-4">
                <p className="mt-3 text-sm leading-7 text-muted">No overlaps. 60 minutes.</p>
              </div>
            </Card>

            <Card variant="soft" className="space-y-4">
              <div className="section-header">
                <h2 className="section-title">Upcoming</h2>
                <Badge tone="outline">Session list</Badge>
              </div>

              {nextSession ? (
                <Link href={`/sessions/${nextSession.id}`} className="list-row block">
                  <div className="space-y-3">
                    <div className="chip-row">
                      <Badge tone={nextSession.classType.category === "GROUP" ? "plum" : "warm"}>
                        {nextSession.classType.category}
                      </Badge>
                      <Badge tone="outline">{nextSession.status}</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="font-display text-[1.55rem] leading-none tracking-[-0.04em] text-ink">
                        {nextSession.title}
                      </p>
                      <p className="text-sm leading-6 text-muted">
                        {compactList([
                          toDateTimeLabel(nextSession.startsAt),
                          nextSession.instructor.fullName,
                        ])}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">
                        {nextSession._count.bookings}/{nextSession.capacity} booked
                      </p>
                      <p className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-muted">
                        <Clock3 className="size-3.5" />
                        60 min
                      </p>
                    </div>
                  </div>
                </Link>
              ) : (
                <EmptyState title="No upcoming sessions" />
              )}

              <div className="space-y-3">
                {upcomingSessions.slice(1).map((session) => (
                  <Link key={session.id} href={`/sessions/${session.id}`} className="list-row-quiet block">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="chip-row">
                          <Badge tone={session.classType.category === "GROUP" ? "plum" : "warm"}>
                            {session.classType.category}
                          </Badge>
                        </div>
                        <p className="mt-3 font-semibold text-ink">{session.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {compactList([
                          toDateTimeLabel(session.startsAt),
                          session.instructor.fullName,
                        ])}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-ink">
                        {session._count.bookings}/{session.capacity}
                    </p>
                  </div>
                </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
