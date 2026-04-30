import { BookingStatus, Prisma, SessionStatus } from "@prisma/client";
import { addMinutes } from "date-fns";
import { logAudit } from "@/lib/audit";
import {
  calculateEndTime,
  combineDateAndTime,
  toDateInputValue,
  toDateOnly,
  toTimeInputValue,
} from "@/lib/date";
import { reverseBookingUsage, updateBookingStatus } from "@/lib/domain/bookings";
import { cancelGoogleCalendarEvent, upsertGoogleCalendarEvent } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

type SessionTransactionClient = Prisma.TransactionClient;

type SessionForSync = Prisma.SessionGetPayload<{
  include: {
    classType: true;
    instructor: true;
    bookings: {
      include: {
        customer: true;
      };
    };
  };
}>;

const STUDIO_SCHEDULE_LOCK_KEY = 41_001;

async function withStudioScheduleLock<T>(
  callback: (tx: SessionTransactionClient) => Promise<T>,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${STUDIO_SCHEDULE_LOCK_KEY})`;
      return callback(tx);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

async function assertNoSessionOverlap(input: {
  tx: SessionTransactionClient;
  startsAt: Date;
  endsAt: Date;
  excludeSessionId?: string;
}) {
  const overlappingSession = await input.tx.session.findFirst({
    where: {
      status: {
        not: SessionStatus.CANCELLED,
      },
      id: input.excludeSessionId
        ? {
            not: input.excludeSessionId,
          }
        : undefined,
      startsAt: {
        lt: input.endsAt,
      },
      endsAt: {
        gt: input.startsAt,
      },
    },
  });

  if (overlappingSession) {
    throw new Error("Session overlaps another booking.");
  }
}

async function loadSessionForSync(sessionId: string): Promise<SessionForSync | null> {
  return prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      classType: true,
      instructor: true,
      bookings: {
        include: {
          customer: true,
        },
      },
    },
  });
}

async function syncSessionToGoogle(sessionId: string, shouldSync: boolean) {
  if (!shouldSync) {
    return;
  }

  const session = await loadSessionForSync(sessionId);
  if (!session) {
    return;
  }

  try {
    const eventId = await upsertGoogleCalendarEvent({
      id: session.id,
      title: session.title,
      notes: session.notes,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      googleCalendarEventId: session.googleCalendarEventId,
      classTypeName: session.classType.name,
      instructorName: session.instructor.fullName,
      attendeeNames: session.bookings.map((booking) => booking.customer.fullName),
      status: session.status,
    });

    if (eventId && eventId !== session.googleCalendarEventId) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          googleCalendarEventId: eventId,
        },
      });
    }
  } catch (error) {
    console.error("Google Calendar sync failed", error);
  }
}

export async function createSession(input: {
  classTypeId: string;
  instructorId: string;
  title: string;
  date: string;
  startTime: string;
  capacity: number;
  notes?: string;
  syncToGoogle?: boolean;
  recurringBookingRuleId?: string;
  userId?: string;
}) {
  const classType = await prisma.classType.findUnique({
    where: { id: input.classTypeId },
  });

  if (!classType) {
    throw new Error("Class type not found.");
  }

  const startsAt = combineDateAndTime(input.date, input.startTime);
  const endsAt = addMinutes(startsAt, classType.durationMinutes);

  const session = await withStudioScheduleLock(async (tx) => {
    await assertNoSessionOverlap({
      tx,
      startsAt,
      endsAt,
    });

    return tx.session.create({
      data: {
        classTypeId: input.classTypeId,
        instructorId: input.instructorId,
        title: input.title,
        date: toDateOnly(startsAt),
        startTime: input.startTime,
        endTime: calculateEndTime(input.date, input.startTime, classType.durationMinutes),
        startsAt,
        endsAt,
        capacity: input.capacity,
        notes: input.notes,
        recurringBookingRuleId: input.recurringBookingRuleId,
      },
    });
  });

  await syncSessionToGoogle(session.id, Boolean(input.syncToGoogle));

  await logAudit({
    userId: input.userId,
    entityType: "Session",
    entityId: session.id,
    action: "CREATE_SESSION",
    details: {
      classTypeId: input.classTypeId,
      instructorId: input.instructorId,
      date: input.date,
      startTime: input.startTime,
      syncToGoogle: Boolean(input.syncToGoogle),
      recurringBookingRuleId: input.recurringBookingRuleId,
    },
  });

  return session;
}

export async function updateSession(input: {
  sessionId: string;
  classTypeId: string;
  instructorId: string;
  title: string;
  date: string;
  startTime: string;
  capacity: number;
  notes?: string;
  syncToGoogle?: boolean;
  userId?: string;
}) {
  const existingSession = await loadSessionForSync(input.sessionId);

  if (!existingSession) {
    throw new Error("Session not found.");
  }

  const activeBookingCount = existingSession.bookings.filter(
    (booking) => booking.status !== BookingStatus.CANCELLED,
  ).length;

  if (input.capacity < activeBookingCount) {
    throw new Error(`Capacity cannot be lower than ${activeBookingCount} current bookings.`);
  }

  const classType = await prisma.classType.findUnique({
    where: { id: input.classTypeId },
  });

  if (!classType) {
    throw new Error("Class type not found.");
  }

  const startsAt = combineDateAndTime(input.date, input.startTime);
  const endsAt = addMinutes(startsAt, classType.durationMinutes);

  const updatedSession = await withStudioScheduleLock(async (tx) => {
    await assertNoSessionOverlap({
      tx,
      startsAt,
      endsAt,
      excludeSessionId: input.sessionId,
    });

    return tx.session.update({
      where: { id: input.sessionId },
      data: {
        classTypeId: input.classTypeId,
        instructorId: input.instructorId,
        title: input.title,
        date: toDateOnly(startsAt),
        startTime: input.startTime,
        endTime: calculateEndTime(input.date, input.startTime, classType.durationMinutes),
        startsAt,
        endsAt,
        capacity: input.capacity,
        notes: input.notes,
        googleCalendarEventId: input.syncToGoogle ? existingSession.googleCalendarEventId : null,
      },
    });
  });

  if (!input.syncToGoogle && existingSession.googleCalendarEventId) {
    try {
      await cancelGoogleCalendarEvent({
        id: existingSession.id,
        title: existingSession.title,
        notes: existingSession.notes,
        startsAt: existingSession.startsAt,
        endsAt: existingSession.endsAt,
        googleCalendarEventId: existingSession.googleCalendarEventId,
        classTypeName: existingSession.classType.name,
        instructorName: existingSession.instructor.fullName,
        attendeeNames: existingSession.bookings.map((booking) => booking.customer.fullName),
        status: "CANCELLED",
      });
    } catch (error) {
      console.error("Failed to remove Google Calendar event", error);
    }
  }

  await syncSessionToGoogle(updatedSession.id, Boolean(input.syncToGoogle));

  await logAudit({
    userId: input.userId,
    entityType: "Session",
    entityId: updatedSession.id,
    action: "UPDATE_SESSION",
    details: {
      classTypeId: input.classTypeId,
      instructorId: input.instructorId,
      date: input.date,
      startTime: input.startTime,
      syncToGoogle: Boolean(input.syncToGoogle),
    },
  });

  return updatedSession;
}

export async function moveSession(input: {
  sessionId: string;
  startsAt: Date;
  userId?: string;
}) {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: {
      classType: true,
    },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  const endsAt = addMinutes(input.startsAt, session.classType.durationMinutes);

  const updatedSession = await withStudioScheduleLock(async (tx) => {
    await assertNoSessionOverlap({
      tx,
      startsAt: input.startsAt,
      endsAt,
      excludeSessionId: input.sessionId,
    });

    return tx.session.update({
      where: { id: input.sessionId },
      data: {
        date: toDateOnly(input.startsAt),
        startTime: toTimeInputValue(input.startsAt),
        endTime: toTimeInputValue(endsAt),
        startsAt: input.startsAt,
        endsAt,
      },
    });
  });

  await syncSessionToGoogle(updatedSession.id, Boolean(updatedSession.googleCalendarEventId));

  await logAudit({
    userId: input.userId,
    entityType: "Session",
    entityId: updatedSession.id,
    action: "MOVE_SESSION",
    details: {
      date: toDateInputValue(updatedSession.startsAt),
      startTime: updatedSession.startTime,
      endTime: updatedSession.endTime,
    },
  });

  return updatedSession;
}

export async function cancelSession(input: {
  sessionId: string;
  restoreConsumedBookings?: boolean;
  userId?: string;
}) {
  const session = await loadSessionForSync(input.sessionId);

  if (!session) {
    throw new Error("Session not found.");
  }

  const updatedSession = await prisma.session.update({
    where: { id: input.sessionId },
    data: {
      status: SessionStatus.CANCELLED,
    },
  });

  const activeBookings = session.bookings.filter((booking) => booking.status !== BookingStatus.CANCELLED);
  const consumedBookingCount = activeBookings.filter(
    (booking) => booking.creditDeducted || booking.singleUseConsumed || booking.trialUseConsumed,
  ).length;

  for (const booking of activeBookings) {
    await updateBookingStatus({
      bookingId: booking.id,
      status: BookingStatus.CANCELLED,
      notes: booking.notes ?? undefined,
      skipRestore: input.restoreConsumedBookings === false,
      userId: input.userId,
    });
  }

  try {
    await cancelGoogleCalendarEvent({
      id: session.id,
      title: session.title,
      notes: session.notes,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      googleCalendarEventId: session.googleCalendarEventId,
      classTypeName: session.classType.name,
      instructorName: session.instructor.fullName,
      attendeeNames: session.bookings.map((booking) => booking.customer.fullName),
      status: "CANCELLED",
    });
  } catch (error) {
    console.error("Failed to cancel Google Calendar event", error);
  }

  await logAudit({
    userId: input.userId,
    entityType: "Session",
    entityId: updatedSession.id,
    action: "CANCEL_SESSION",
    details: {
      googleCalendarEventId: session.googleCalendarEventId,
      restoreConsumedBookings: input.restoreConsumedBookings !== false,
      restoredBookingCount: input.restoreConsumedBookings === false ? 0 : consumedBookingCount,
    },
  });

  return updatedSession;
}

export async function restoreCancelledSessionUsage(input: { sessionId: string; userId?: string }) {
  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    include: {
      bookings: true,
    },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  if (session.status !== SessionStatus.CANCELLED) {
    throw new Error("Only cancelled sessions can bulk-restore usage.");
  }

  const restorableBookings = session.bookings.filter(
    (booking) =>
      booking.status === BookingStatus.CANCELLED &&
      (booking.creditDeducted || booking.singleUseConsumed || booking.trialUseConsumed),
  );

  for (const booking of restorableBookings) {
    await reverseBookingUsage({
      bookingId: booking.id,
      targetStatus: BookingStatus.CANCELLED,
      userId: input.userId,
    });
  }

  await logAudit({
    userId: input.userId,
    entityType: "Session",
    entityId: session.id,
    action: "RESTORE_CANCELLED_SESSION_USAGE",
    details: {
      restoredBookingCount: restorableBookings.length,
    },
  });

  return {
    sessionId: session.id,
    restoredBookingCount: restorableBookings.length,
  };
}
