import { getNow, getTodayRangeInAppTimezone } from "@/lib/date";
import { autoAttendEndedBookings } from "@/lib/domain/bookings";
import { prisma } from "@/lib/prisma";
import { getEffectiveSessionStatus, type SessionStatusValue } from "@/lib/session-status";

type DashboardSessionRecord = {
  id: string;
  title: string;
  status: SessionStatusValue;
  startsAt: Date;
  endsAt: Date;
  startTime: string;
  capacity: number;
  classType: {
    name: string;
    category: "GROUP" | "PRIVATE";
  };
  instructor: {
    fullName: string;
  };
  bookings: Array<{
    customer: {
      fullName: string;
    };
  }>;
};

export type DashboardLiveSession = {
  id: string;
  title: string;
  status: SessionStatusValue;
  startsAt: string;
  endsAt: string;
  startTime: string;
  capacity: number;
  bookingCount: number;
  customerNames: string[];
  classType: {
    name: string;
    category: "GROUP" | "PRIVATE";
  };
  instructor: {
    fullName: string;
  };
};

export type DashboardLiveSessionsPayload = {
  fetchedAt: string;
  todaySessions: DashboardLiveSession[];
  upcomingSessions: DashboardLiveSession[];
  totalTodayBookings: number;
};

const sessionSelect = {
  id: true,
  title: true,
  status: true,
  startsAt: true,
  endsAt: true,
  startTime: true,
  capacity: true,
  instructor: {
    select: {
      fullName: true,
    },
  },
  classType: {
    select: {
      name: true,
      category: true,
    },
  },
  bookings: {
    where: {
      status: {
        not: "CANCELLED",
      },
    },
    select: {
      customer: {
        select: {
          fullName: true,
        },
      },
    },
  },
} as const;

function serializeSession(session: DashboardSessionRecord, now: Date): DashboardLiveSession {
  return {
    id: session.id,
    title: session.title,
    status: getEffectiveSessionStatus(session, now),
    startsAt: session.startsAt.toISOString(),
    endsAt: session.endsAt.toISOString(),
    startTime: session.startTime,
    capacity: session.capacity,
    bookingCount: session.bookings.length,
    customerNames: session.bookings.map((booking) => booking.customer.fullName),
    classType: session.classType,
    instructor: session.instructor,
  };
}

export async function getDashboardLiveSessions(now = getNow()): Promise<DashboardLiveSessionsPayload> {
  await autoAttendEndedBookings({ now });

  const { start: todayStart, end: tomorrowStart } = getTodayRangeInAppTimezone(now);

  const [todaySessions, upcomingSessions] = await Promise.all([
    prisma.session.findMany({
      where: {
        status: "SCHEDULED",
        startsAt: {
          gte: todayStart,
          lt: tomorrowStart,
        },
        endsAt: {
          gt: now,
        },
      },
      select: sessionSelect,
      orderBy: {
        startsAt: "asc",
      },
    }),
    prisma.session.findMany({
      where: {
        status: "SCHEDULED",
        endsAt: {
          gt: now,
        },
      },
      select: sessionSelect,
      orderBy: {
        startsAt: "asc",
      },
      take: 6,
    }),
  ]);

  const serializedTodaySessions = todaySessions.map((session) => serializeSession(session, now));

  return {
    fetchedAt: now.toISOString(),
    todaySessions: serializedTodaySessions,
    upcomingSessions: upcomingSessions.map((session) => serializeSession(session, now)),
    totalTodayBookings: serializedTodaySessions.reduce((sum, session) => sum + session.bookingCount, 0),
  };
}
