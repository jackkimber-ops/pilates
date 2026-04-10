import { Weekday } from "@prisma/client";
import { addDays, addMinutes, eachDayOfInterval } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE, DEFAULT_RECURRING_GENERATION_DAYS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { createBooking } from "@/lib/domain/bookings";
import { createSession } from "@/lib/domain/sessions";
import { combineDateAndTime, getToday, toDateInputValue, toStoredDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";

const WEEKDAY_LABELS: Record<Weekday, string> = {
  SUNDAY: "SUNDAY",
  MONDAY: "MONDAY",
  TUESDAY: "TUESDAY",
  WEDNESDAY: "WEDNESDAY",
  THURSDAY: "THURSDAY",
  FRIDAY: "FRIDAY",
  SATURDAY: "SATURDAY",
};

function getWeekdayForDate(date: Date) {
  return formatInTimeZone(date, APP_TIMEZONE, "EEEE").toUpperCase() as Weekday;
}

function getCandidateDates(
  rule: {
    dayOfWeek: Weekday;
    startDate: Date;
    endDate: Date | null;
  },
  startDate: string,
  endDate: string,
) {
  const ruleStart = toDateInputValue(rule.startDate);
  const ruleEnd = rule.endDate ? toDateInputValue(rule.endDate) : null;

  return eachDayOfInterval({
    start: toStoredDate(startDate),
    end: toStoredDate(endDate),
  })
    .filter((date) => getWeekdayForDate(date) === WEEKDAY_LABELS[rule.dayOfWeek])
    .filter((date) => {
      const candidateDate = toDateInputValue(date);
      return candidateDate >= ruleStart && (ruleEnd ? candidateDate <= ruleEnd : true);
    });
}

export async function createRecurringRule(input: {
  customerId: string;
  classTypeId: string;
  instructorId?: string;
  dayOfWeek: Weekday;
  startTime: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  notes?: string;
  paymentSourceType: "PACKAGE" | "SINGLE" | "TRIAL" | "OVERRIDE";
  userId?: string;
}) {
  const rule = await prisma.recurringBookingRule.create({
    data: {
      customerId: input.customerId,
      classTypeId: input.classTypeId,
      instructorId: input.instructorId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      startDate: toStoredDate(input.startDate),
      endDate: input.endDate ? toStoredDate(input.endDate) : undefined,
      active: input.active,
      notes: input.notes,
      paymentSourceType: input.paymentSourceType,
    },
  });

  await logAudit({
    userId: input.userId,
    entityType: "RecurringBookingRule",
    entityId: rule.id,
    action: "CREATE_RECURRING_RULE",
    details: {
      customerId: input.customerId,
      classTypeId: input.classTypeId,
      instructorId: input.instructorId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
    },
  });

  return rule;
}

export async function toggleRecurringRule(input: {
  ruleId: string;
  active: boolean;
  userId?: string;
}) {
  const rule = await prisma.recurringBookingRule.update({
    where: { id: input.ruleId },
    data: {
      active: input.active,
    },
  });

  await logAudit({
    userId: input.userId,
    entityType: "RecurringBookingRule",
    entityId: rule.id,
    action: input.active ? "ACTIVATE_RECURRING_RULE" : "PAUSE_RECURRING_RULE",
  });

  return rule;
}

export async function generateRecurringBookings(input: {
  ruleId: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
}) {
  const rule = await prisma.recurringBookingRule.findUnique({
    where: { id: input.ruleId },
    include: {
      customer: true,
      classType: true,
      instructor: true,
    },
  });

  if (!rule) {
    throw new Error("Recurring rule not found.");
  }

  const startDate =
    input.startDate ??
    toDateInputValue(rule.startDate > getToday() ? rule.startDate : getToday());
  const endDate =
    input.endDate ??
    toDateInputValue(addDays(toStoredDate(startDate), DEFAULT_RECURRING_GENERATION_DAYS));

  const candidateDates = getCandidateDates(rule, startDate, endDate);
  const createdSessionIds: string[] = [];
  const conflicts: string[] = [];
  const existing: string[] = [];

  for (const candidate of candidateDates) {
    const candidateDate = toDateInputValue(candidate);
    const startsAt = combineDateAndTime(candidateDate, rule.startTime);
    const endsAt = addMinutes(startsAt, rule.classType.durationMinutes);

    if (!rule.instructorId) {
      conflicts.push(`${candidateDate} (missing instructor)`);
      continue;
    }

    const alreadyGenerated = await prisma.session.findFirst({
      where: {
        recurringBookingRuleId: rule.id,
        startsAt,
      },
    });

    if (alreadyGenerated) {
      existing.push(candidateDate);
      continue;
    }

    const overlappingSession = await prisma.session.findFirst({
      where: {
        status: {
          not: "CANCELLED",
        },
        startsAt: {
          lt: endsAt,
        },
        endsAt: {
          gt: startsAt,
        },
      },
    });

    if (overlappingSession) {
      conflicts.push(candidateDate);
      continue;
    }

    try {
      const session = await createSession({
        classTypeId: rule.classTypeId,
        instructorId: rule.instructorId,
        title: rule.classType.name,
        date: candidateDate,
        startTime: rule.startTime,
        capacity: rule.classType.maxCapacity,
        notes: ["Recurring", rule.notes].filter(Boolean).join(" / "),
        recurringBookingRuleId: rule.id,
        userId: input.userId,
      });

      await createBooking({
        sessionId: session.id,
        customerId: rule.customerId,
        paymentSourceType: rule.paymentSourceType,
        recurringBookingRuleId: rule.id,
        notes: "Recurring",
        userId: input.userId,
      });

      createdSessionIds.push(session.id);
    } catch (error) {
      console.error("Recurring generation skipped", error);
      conflicts.push(error instanceof Error ? `${candidateDate} (${error.message})` : candidateDate);
    }
  }

  await logAudit({
    userId: input.userId,
    entityType: "RecurringBookingRule",
    entityId: rule.id,
    action: "GENERATE_RECURRING_BOOKINGS",
    details: {
      startDate,
      endDate,
      createdSessionIds,
      conflicts,
      existing,
    },
  });

  return {
    createdCount: createdSessionIds.length,
    conflicts,
    existing,
    startDate,
    endDate,
  };
}
