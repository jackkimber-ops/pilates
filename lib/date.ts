import {
  addDays,
  addMinutes,
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  startOfDay,
} from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { APP_TIMEZONE, CLASS_DURATION_MINUTES } from "@/lib/constants";

export function getNow() {
  return new Date();
}

export function combineDateAndTime(date: string, time: string) {
  return fromZonedTime(`${date}T${time}:00`, APP_TIMEZONE);
}

export function toStoredDate(date: string | Date) {
  const dateValue = typeof date === "string" ? date : formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd");
  return new Date(`${dateValue}T00:00:00.000Z`);
}

export function toDateOnly(date: Date) {
  return toStoredDate(date);
}

export function toDateInputValue(date: Date) {
  return formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd");
}

export function toTimeInputValue(date: Date) {
  return formatInTimeZone(date, APP_TIMEZONE, "HH:mm");
}

export function toDateTimeLabel(date: Date) {
  return formatInTimeZone(date, APP_TIMEZONE, "EEE, d MMM yyyy / HH:mm");
}

export function toShortDate(date: Date) {
  return formatInTimeZone(date, APP_TIMEZONE, "d MMM yyyy");
}

export function toLongDate(date: Date) {
  return formatInTimeZone(date, APP_TIMEZONE, "EEEE, d MMMM yyyy");
}

export function toRelativeDayLabel(date: Date) {
  const today = getToday();
  const diff = differenceInCalendarDays(toDateOnly(date), today);

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";

  return toShortDate(date);
}

export function getToday() {
  return toDateOnly(getNow());
}

export function getTodayRangeInAppTimezone(now = getNow()) {
  const start = combineDateAndTime(toDateInputValue(now), "00:00");

  return {
    start,
    end: addDays(start, 1),
  };
}

export function getReportRangeEnd() {
  return endOfDay(getNow());
}

export function getReportRangeStart(days: number) {
  return startOfDay(addDays(getReportRangeEnd(), -days));
}

export function calculateExpiryDate(purchaseDate: string, validityMonths: number) {
  return endOfDay(addMonths(combineDateAndTime(purchaseDate, "00:00"), validityMonths));
}

export function calculateEndTime(date: string, startTime: string, durationMinutes = CLASS_DURATION_MINUTES) {
  const endsAt = addMinutes(combineDateAndTime(date, startTime), durationMinutes);
  return toTimeInputValue(endsAt);
}

export function formatSessionWindow(startsAt: Date, endsAt: Date) {
  return `${formatInTimeZone(startsAt, APP_TIMEZONE, "EEE d MMM / HH:mm")} - ${formatInTimeZone(
    endsAt,
    APP_TIMEZONE,
    "HH:mm",
  )}`;
}

export function clampDateRangeEnd(start: string, fallbackDays = 56) {
  return toDateInputValue(addDays(combineDateAndTime(start, "00:00"), fallbackDays));
}
