import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getInstructorCalendarTheme } from "@/lib/instructor-theme";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeHex(hex: string) {
  const trimmed = hex.replace("#", "").trim();

  if (trimmed.length === 3) {
    return trimmed
      .split("")
      .map((value) => value + value)
      .join("");
  }

  return trimmed.padEnd(6, "0").slice(0, 6);
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex);

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHex(first: string, second: string, weight: number) {
  const colorOne = hexToRgb(first);
  const colorTwo = hexToRgb(second);

  return rgbToHex({
    r: colorOne.r * (1 - weight) + colorTwo.r * weight,
    g: colorOne.g * (1 - weight) + colorTwo.g * weight,
    b: colorOne.b * (1 - weight) + colorTwo.b * weight,
  });
}

function buildCustomerPreview(names: string[]) {
  if (!names.length) {
    return {
      lines: ["No bookings"],
      summary: "No bookings",
    };
  }

  if (names.length === 1) {
    return {
      lines: [names[0]],
      summary: names[0],
    };
  }

  if (names.length === 2) {
    return {
      lines: [names[0], names[1]],
      summary: names.join(", "),
    };
  }

  return {
    lines: [names[0], `${names[1]} +${names.length - 2}`],
    summary: `${names[0]}, ${names[1]} +${names.length - 2}`,
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Start and end are required." }, { status: 400 });
  }

  const sessions = await prisma.session.findMany({
    where: {
      status: {
        not: "CANCELLED",
      },
      startsAt: {
        lt: new Date(end),
      },
      endsAt: {
        gt: new Date(start),
      },
    },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      title: true,
      classType: {
        select: {
          name: true,
          category: true,
        },
      },
      instructor: {
        select: {
          fullName: true,
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
    },
    orderBy: {
      startsAt: "asc",
    },
  });

  const events = sessions.map((session) => {
    const instructorTheme = getInstructorCalendarTheme(session.instructor.fullName);
    const activeBookingCount = session.bookings.length;
    const attendeeNames = session.bookings.map((booking) => booking.customer.fullName);
    const customerPreview = buildCustomerPreview(attendeeNames);

    return {
      id: session.id,
      title: session.classType.name,
      start: session.startsAt.toISOString(),
      end: session.endsAt.toISOString(),
      editable: session.status === "SCHEDULED",
      backgroundColor: mixHex(instructorTheme.soft, "#fffaf6", 0.36),
      borderColor: mixHex(instructorTheme.accent, "#ffffff", 0.82),
      textColor: "#302726",
      extendedProps: {
        accentColor: instructorTheme.accent,
        accentSoftColor: mixHex(instructorTheme.softStrong, "#fffaf6", 0.32),
        accentTintColor: mixHex(instructorTheme.soft, "#fffaf6", 0.18),
        instructorName: session.instructor.fullName,
        bookingLabel: `${activeBookingCount}/${session.capacity} booked`,
        bookingCount: activeBookingCount,
        capacity: session.capacity,
        status: session.status,
        category: session.classType.category,
        classTypeName: session.classType.name,
        customerPreviewLines: customerPreview.lines,
        customerSummary: customerPreview.summary,
        customerCount: attendeeNames.length,
        sessionTitle: session.title,
      },
    };
  });

  return NextResponse.json(events);
}
