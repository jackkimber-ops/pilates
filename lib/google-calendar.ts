import { formatInTimeZone } from "date-fns-tz";
import { google } from "googleapis";
import { APP_TIMEZONE } from "@/lib/constants";
import { getServerEnv } from "@/lib/env/server";

type GoogleSessionInput = {
  id: string;
  title: string;
  notes?: string | null;
  startsAt: Date;
  endsAt: Date;
  googleCalendarEventId?: string | null;
  classTypeName: string;
  instructorName: string;
  attendeeNames?: string[];
  status?: string;
};

function getGoogleCalendarId() {
  return getServerEnv().GOOGLE_CALENDAR_ID;
}

export function isGoogleCalendarConfigured() {
  const env = getServerEnv();

  return Boolean(
    env.GOOGLE_CLIENT_EMAIL &&
      env.GOOGLE_PRIVATE_KEY &&
      env.GOOGLE_CALENDAR_ID,
  );
}

function getGoogleCalendarClient() {
  if (!isGoogleCalendarConfigured()) {
    return null;
  }

  const env = getServerEnv();

  const auth = new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: env.GOOGLE_IMPERSONATED_USER || undefined,
  });

  return google.calendar({
    version: "v3",
    auth,
  });
}

function buildDescription(input: GoogleSessionInput) {
  const sections = [
    `Instructor: ${input.instructorName}`,
    `Class type: ${input.classTypeName}`,
    input.notes ? `Notes: ${input.notes}` : null,
    input.attendeeNames?.length ? `Attendees: ${input.attendeeNames.join(", ")}` : null,
    input.status ? `Status: ${input.status}` : null,
  ].filter(Boolean);

  return sections.join("\n");
}

function toGoogleDateTime(date: Date) {
  return formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export async function upsertGoogleCalendarEvent(input: GoogleSessionInput) {
  const calendar = getGoogleCalendarClient();
  const calendarId = getGoogleCalendarId();

  if (!calendar || !calendarId) {
    return null;
  }

  const requestBody = {
    summary: input.title,
    description: buildDescription(input),
    start: {
      dateTime: toGoogleDateTime(input.startsAt),
      timeZone: APP_TIMEZONE,
    },
    end: {
      dateTime: toGoogleDateTime(input.endsAt),
      timeZone: APP_TIMEZONE,
    },
  };

  if (input.googleCalendarEventId) {
    await calendar.events.update({
      calendarId,
      eventId: input.googleCalendarEventId,
      requestBody,
    });

    return input.googleCalendarEventId;
  }

  const response = await calendar.events.insert({
    calendarId,
    requestBody,
  });

  return response.data.id ?? null;
}

export async function cancelGoogleCalendarEvent(input: GoogleSessionInput) {
  const calendar = getGoogleCalendarClient();
  const calendarId = getGoogleCalendarId();
  const env = getServerEnv();

  if (!calendar || !calendarId || !input.googleCalendarEventId) {
    return;
  }

  if (env.GOOGLE_DELETE_CANCELLED_EVENTS === "true") {
    await calendar.events.delete({
      calendarId,
      eventId: input.googleCalendarEventId,
    });
    return;
  }

  await calendar.events.update({
    calendarId,
    eventId: input.googleCalendarEventId,
    requestBody: {
      summary: `${input.title} (Cancelled)`,
      description: buildDescription({ ...input, status: "CANCELLED" }),
      status: "cancelled",
      start: {
        dateTime: toGoogleDateTime(input.startsAt),
        timeZone: APP_TIMEZONE,
      },
      end: {
        dateTime: toGoogleDateTime(input.endsAt),
        timeZone: APP_TIMEZONE,
      },
    },
  });
}
