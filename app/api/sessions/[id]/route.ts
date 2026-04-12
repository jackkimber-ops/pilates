import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCustomerBalanceLabel } from "@/lib/balances";
import { formatSessionWindow } from "@/lib/date";
import { cancelSession } from "@/lib/domain/sessions";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { compactList } from "@/lib/utils";

type SessionAlertTone = "warning" | "info";
type SessionBookingPreview = {
  status: "BOOKED" | "ATTENDED" | "CANCELLED" | "LATE_CANCEL" | "NO_SHOW";
  paymentSourceType: "PACKAGE" | "SINGLE" | "TRIAL" | "OVERRIDE";
  creditDeducted: boolean;
  singleUseConsumed: boolean;
  trialUseConsumed: boolean;
  restoredAt: Date | null;
  customerPackage: {
    sourceType: "PACKAGE_SALE" | "IMPORTED";
    classType: {
      name: string;
      category: "GROUP" | "PRIVATE";
    } | null;
    packageTemplate: {
      name: string;
    } | null;
  } | null;
  singleClassPurchase: {
    classType: {
      name: string;
    } | null;
  } | null;
  customerTrialPackage: {
    trialPackageTemplate: {
      name: string;
    } | null;
  } | null;
  customerTrialPackageItem: {
    classType: {
      name: string;
    } | null;
  } | null;
  reversedByUser: {
    name: string;
  } | null;
};

function buildBookingBackingLabel(
  booking: SessionBookingPreview,
  sessionClassName: string,
) {
  if (booking.paymentSourceType === "PACKAGE") {
    return (
      (booking.customerPackage ? getCustomerBalanceLabel(booking.customerPackage) : null) ??
      `${sessionClassName} package`
    );
  }

  if (booking.paymentSourceType === "SINGLE") {
    return booking.singleClassPurchase?.classType?.name ?? "One-off purchase";
  }

  if (booking.paymentSourceType === "TRIAL") {
    return compactList([
      booking.customerTrialPackage?.trialPackageTemplate?.name ?? "Trial package",
      booking.customerTrialPackageItem?.classType?.name ?? sessionClassName,
    ]);
  }

  return "Override";
}

function buildBookingOperationalNote(
  booking: SessionBookingPreview,
) {
  if (booking.paymentSourceType === "OVERRIDE") {
    return "Override booking. No automatic deduction.";
  }

  if (booking.creditDeducted) {
    return "Credit deducted.";
  }

  if (booking.singleUseConsumed) {
    return "One-off used.";
  }

  if (booking.trialUseConsumed) {
    return "Trial used.";
  }

  if (booking.paymentSourceType === "PACKAGE") {
    return "Package will be used on attendance.";
  }

  if (booking.paymentSourceType === "SINGLE") {
    return "One-off will be used on attendance.";
  }

  if (booking.paymentSourceType === "TRIAL") {
    return "Trial item will be used on attendance.";
  }

  if (
    booking.restoredAt &&
    !booking.creditDeducted &&
    !booking.singleUseConsumed &&
    !booking.trialUseConsumed
  ) {
    return compactList([
      "Usage restored",
      booking.reversedByUser?.name ?? null,
    ]);
  }

  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const session = await prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      notes: true,
      googleCalendarEventId: true,
      recurringBookingRuleId: true,
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
        select: {
          id: true,
          status: true,
          paymentSourceType: true,
          creditDeducted: true,
          singleUseConsumed: true,
          trialUseConsumed: true,
          restoredAt: true,
          notes: true,
          customer: {
            select: {
              fullName: true,
            },
          },
          customerPackage: {
            select: {
              sourceType: true,
              classType: {
                select: {
                  name: true,
                  category: true,
                },
              },
              packageTemplate: {
                select: {
                  name: true,
                },
              },
            },
          },
          singleClassPurchase: {
            select: {
              classType: {
                select: {
                  name: true,
                },
              },
            },
          },
          customerTrialPackage: {
            select: {
              trialPackageTemplate: {
                select: {
                  name: true,
                },
              },
            },
          },
          customerTrialPackageItem: {
            select: {
              classType: {
                select: {
                  name: true,
                },
              },
            },
          },
          reversedByUser: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const activeBookingCount = session.bookings.filter((booking) => booking.status !== "CANCELLED").length;
  const attendedBookingCount = session.bookings.filter((booking) => booking.status === "ATTENDED").length;
  const packageBackedCount = session.bookings.filter(
    (booking) => booking.status !== "CANCELLED" && booking.paymentSourceType === "PACKAGE",
  ).length;
  const singleBackedCount = session.bookings.filter(
    (booking) => booking.status !== "CANCELLED" && booking.paymentSourceType === "SINGLE",
  ).length;
  const trialBackedCount = session.bookings.filter(
    (booking) => booking.status !== "CANCELLED" && booking.paymentSourceType === "TRIAL",
  ).length;
  const overrideCount = session.bookings.filter(
    (booking) => booking.status !== "CANCELLED" && booking.paymentSourceType === "OVERRIDE",
  ).length;
  const restorableCancelledBookingCount = session.bookings.filter(
    (booking) =>
      booking.status === "CANCELLED" &&
      (booking.creditDeducted || booking.singleUseConsumed || booking.trialUseConsumed),
  ).length;

  const alerts: Array<{ title: string; detail: string; tone: SessionAlertTone }> = [];

  if (session.status === "CANCELLED") {
    alerts.push({
      title: "Cancelled",
      detail: "New bookings are disabled.",
      tone: "warning",
    });
  }

  if (overrideCount > 0) {
    alerts.push({
      title: `${overrideCount} override booking${overrideCount === 1 ? "" : "s"}`,
      detail: "No automatic deduction.",
      tone: "warning",
    });
  }

  if (restorableCancelledBookingCount > 0) {
    alerts.push({
      title: `${restorableCancelledBookingCount} restored booking${restorableCancelledBookingCount === 1 ? "" : "s"} pending`,
      detail: "Credits have not been restored yet.",
      tone: "warning",
    });
  }

  if (!session.googleCalendarEventId && isGoogleCalendarConfigured()) {
    alerts.push({
      title: "Google Calendar",
      detail: "Will sync on save.",
      tone: "info",
    });
  }

  return NextResponse.json({
    id: session.id,
    title: session.title,
    status: session.status,
    startsAt: session.startsAt.toISOString(),
    endsAt: session.endsAt.toISOString(),
    capacity: session.capacity,
    notes: session.notes,
    isRecurring: Boolean(session.recurringBookingRuleId),
    syncStatus: session.googleCalendarEventId
      ? "LINKED"
      : isGoogleCalendarConfigured()
        ? "READY"
        : "OFF",
    classType: session.classType,
    instructor: session.instructor,
    summary: compactList([
      formatSessionWindow(session.startsAt, session.endsAt),
      session.instructor.fullName,
      `${activeBookingCount}/${session.capacity} booked`,
    ]),
    counts: {
      activeBookingCount,
      attendedBookingCount,
      packageBackedCount,
      singleBackedCount,
      trialBackedCount,
      overrideCount,
    },
    alerts,
    bookings: session.bookings.map((booking) => ({
      id: booking.id,
      customerName: booking.customer.fullName,
      status: booking.status,
      paymentSourceType: booking.paymentSourceType,
      backingLabel: buildBookingBackingLabel(booking, session.classType.name),
      note: buildBookingOperationalNote(booking),
      bookingNotes: booking.notes,
      creditDeducted: booking.creditDeducted,
      singleUseConsumed: booking.singleUseConsumed,
      trialUseConsumed: booking.trialUseConsumed,
      restored: Boolean(
        booking.restoredAt &&
          !booking.creditDeducted &&
          !booking.singleUseConsumed &&
          !booking.trialUseConsumed,
      ),
    })),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const restoreConsumedBookings = searchParams.get("restoreConsumedBookings") !== "false";

  try {
    await cancelSession({
      sessionId: id,
      restoreConsumedBookings,
      userId: user.id,
    });

    revalidatePath("/");
    revalidatePath("/calendar");
    revalidatePath("/customers");
    revalidatePath("/reports");
    revalidatePath(`/sessions/${id}`);

    return NextResponse.json({
      ok: true,
      id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete session.",
      },
      { status: 400 },
    );
  }
}
