import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CircleAlert,
  CircleDollarSign,
  Clock3,
  UserRound,
  Users2,
  WalletCards,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MobileSectionNav } from "@/components/layout/mobile-section-nav";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { cancelBookingAction, cancelSessionAction } from "@/app/(app)/actions";
import { BookingForm } from "@/app/(app)/sessions/[id]/booking-form";
import { RestoreBookingUsageForm } from "@/app/(app)/sessions/[id]/restore-booking-usage-form";
import { RestoreSessionUsageForm } from "@/app/(app)/sessions/[id]/restore-session-usage-form";
import { BookingStatusForm } from "@/app/(app)/sessions/[id]/booking-status-form";
import { SessionForm } from "@/app/(app)/sessions/session-form";
import { getCustomerBalanceLabel } from "@/lib/balances";
import { formatSessionWindow, toDateInputValue } from "@/lib/date";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { getEffectiveSessionStatus } from "@/lib/session-status";
import { compactList, formatCurrency } from "@/lib/utils";

function getSessionStatusTone(status: string) {
  if (status === "CANCELLED") return "neutral";
  if (status === "COMPLETED") return "sage";
  return "plum";
}

function getBookingStatusTone(status: string) {
  if (status === "ATTENDED") return "sage";
  if (status === "CANCELLED") return "neutral";
  if (status === "NO_SHOW") return "danger";
  if (status === "LATE_CANCEL") return "warm";
  return "plum";
}

function getPaymentSourceTone(type: string) {
  if (type === "PACKAGE") return "sage";
  if (type === "SINGLE") return "warm";
  if (type === "TRIAL") return "plum";
  return "neutral";
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      classTypeId: true,
      instructorId: true,
      title: true,
      date: true,
      startTime: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      status: true,
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
          sessionId: true,
          customerId: true,
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
    notFound();
  }

  const [classTypes, instructors, customers, packageBalances, singlePurchases, trialItems] = await Promise.all([
    prisma.classType.findMany({
      where: {
        active: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        maxCapacity: true,
        durationMinutes: true,
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
    prisma.customerPackage.findMany({
      where: {
        classTypeId: session.classTypeId,
        active: true,
        remainingCredits: {
          gt: 0,
        },
        OR: [{ expiryDate: null }, { expiryDate: { gte: session.startsAt } }],
      },
      select: {
        customerId: true,
        remainingCredits: true,
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
      orderBy: [{ purchaseDate: "asc" }],
    }),
    prisma.singleClassPurchase.findMany({
      where: {
        status: "UNUSED",
        category: session.classType.category,
        AND: [
          {
            OR: [{ expiryDate: null }, { expiryDate: { gte: session.startsAt } }],
          },
          {
            OR: [{ classTypeId: null }, { classTypeId: session.classTypeId }],
          },
        ],
      },
      select: {
        id: true,
        customerId: true,
        category: true,
        amountPaid: true,
        expiryDate: true,
        classType: {
          select: {
            name: true,
          },
        },
        bookings: {
          where: {
            status: {
              not: "CANCELLED",
            },
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
      orderBy: [{ purchaseDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.customerTrialPackageItem.findMany({
      where: {
        classTypeId: session.classTypeId,
        remainingQuantity: {
          gt: 0,
        },
        customerTrialPackage: {
          active: true,
        },
      },
      select: {
        id: true,
        originalQuantity: true,
        remainingQuantity: true,
        classType: {
          select: {
            name: true,
          },
        },
        customerTrialPackage: {
          select: {
            customerId: true,
            trialPackageTemplate: {
              select: {
                name: true,
              },
            },
          },
        },
        bookings: {
          where: {
            status: {
              not: "CANCELLED",
            },
          },
          select: {
            id: true,
            trialUseConsumed: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  const singlePurchaseOptions = singlePurchases
    .filter((purchase) => purchase.bookings.length === 0)
    .map((purchase) => ({
      id: purchase.id,
      customerId: purchase.customerId,
      label: compactList([
        purchase.classType?.name ?? `${purchase.category} one-off`,
        purchase.expiryDate ? `Expires ${purchase.expiryDate.toISOString().slice(0, 10)}` : "No expiry",
        formatCurrency(purchase.amountPaid.toString()),
      ]),
    }));

  const packageBalanceOptions = Array.from(
    packageBalances
      .reduce((map, balance) => {
        const existing = map.get(balance.customerId);

        if (existing) {
          existing.totalRemaining += balance.remainingCredits;
          return map;
        }

        map.set(balance.customerId, {
          customerId: balance.customerId,
          totalRemaining: balance.remainingCredits,
          availabilityLabel: balance.sourceType === "IMPORTED" ? "Imported balance available" : "Package available",
          balanceLabel: getCustomerBalanceLabel(balance),
        });

        return map;
      }, new Map<
        string,
        {
          customerId: string;
          totalRemaining: number;
          availabilityLabel: string;
          balanceLabel: string;
        }
      >())
      .values(),
  ).map((option) => ({
    customerId: option.customerId,
    label: compactList([
      option.availabilityLabel,
      `${option.totalRemaining} remaining`,
      option.balanceLabel,
    ]),
  }));

  const trialPurchaseOptions = trialItems
    .map((item) => ({
      id: item.id,
      customerId: item.customerTrialPackage.customerId,
      label: compactList([
        item.customerTrialPackage.trialPackageTemplate.name,
        `${item.classType.name}`,
        `${item.remainingQuantity - item.bookings.filter((booking) => !booking.trialUseConsumed).length}/${item.originalQuantity} remaining`,
      ]),
      availableQuantity:
        item.remainingQuantity - item.bookings.filter((booking) => !booking.trialUseConsumed).length,
      templateName: item.customerTrialPackage.trialPackageTemplate.name,
    }))
    .filter((item) => item.availableQuantity > 0);

  const activeBookingCount = session.bookings.filter((booking) => booking.status !== "CANCELLED").length;
  const activeBookedCustomerIds = new Set(
    session.bookings
      .filter((booking) => booking.status !== "CANCELLED")
      .map((booking) => booking.customerId),
  );
  const availableBookingCustomers = customers.filter((customer) => !activeBookedCustomerIds.has(customer.id));
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
  const consumedBookingCount = session.bookings.filter(
    (booking) => booking.creditDeducted || booking.singleUseConsumed || booking.trialUseConsumed,
  ).length;
  const effectiveSessionStatus = getEffectiveSessionStatus(session);
  const restorableCancelledBookingCount = session.bookings.filter(
    (booking) =>
      booking.status === "CANCELLED" &&
      (booking.creditDeducted || booking.singleUseConsumed || booking.trialUseConsumed),
  ).length;

  const sessionAlerts: Array<{ title: string; detail: string; tone: "warning" | "info" }> = [];

  if (session.status === "CANCELLED") {
    sessionAlerts.push({
      title: "Cancelled",
      detail: "New bookings are disabled.",
      tone: "warning",
    });
  }

  if (overrideCount > 0) {
    sessionAlerts.push({
      title: `${overrideCount} override booking${overrideCount === 1 ? "" : "s"}`,
      detail: "No automatic deduction.",
      tone: "warning",
    });
  }

  if (restorableCancelledBookingCount > 0) {
    sessionAlerts.push({
      title: `${restorableCancelledBookingCount} restored booking${restorableCancelledBookingCount === 1 ? "" : "s"} pending`,
      detail: "Credits have not been restored yet.",
      tone: "warning",
    });
  }

  if (!session.googleCalendarEventId && isGoogleCalendarConfigured()) {
    sessionAlerts.push({
      title: "Google Calendar",
      detail: "Will sync on save.",
      tone: "info",
    });
  }

  const getBookingBackingLabel = (
    booking: (typeof session.bookings)[number],
  ) => {
    if (booking.paymentSourceType === "PACKAGE") {
      return (
        (booking.customerPackage ? getCustomerBalanceLabel(booking.customerPackage) : null) ??
        `${session.classType.name} package auto-selects on attendance`
      );
    }

    if (booking.paymentSourceType === "SINGLE") {
      return booking.singleClassPurchase?.classType?.name ?? "Selected one-off purchase";
    }

    if (booking.paymentSourceType === "TRIAL") {
      return compactList([
        booking.customerTrialPackage?.trialPackageTemplate.name ?? "Trial package",
        booking.customerTrialPackageItem?.classType.name ?? session.classType.name,
      ]);
    }

    return "Override";
  };

  const getBookingOperationalNote = (booking: (typeof session.bookings)[number]) => {
    if (booking.paymentSourceType === "OVERRIDE") {
      return "Override booking. No package or one-off will be deducted automatically.";
    }

    if (booking.creditDeducted) {
      return "Credit deducted.";
    }

    if (booking.singleUseConsumed) {
      return "The linked one-off purchase has already been consumed.";
    }

    if (booking.trialUseConsumed) {
      return "One trial entitlement has already been consumed for this booking.";
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
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Session detail"
        title={session.title}
        description={compactList([
          formatSessionWindow(session.startsAt, session.endsAt),
          session.instructor.fullName,
          `${activeBookingCount}/${session.capacity} booked`,
        ])}
        actions={
          <>
            <Link href="/calendar" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Calendar
            </Link>
            <Link href="/sessions/new" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              New session
            </Link>
          </>
        }
      />

      <MobileSectionNav
        items={[
          { href: "#drawer", label: "Operate" },
          { href: "#overview", label: "Overview" },
          { href: "#setup", label: "Edit" },
        ]}
      />

      <section className="mock-stage">
        <div className="relative z-10 grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
          <div className="order-2 space-y-5 xl:order-1">
            <Card id="overview" variant="tint" className="scroll-mt-28 overflow-hidden p-0">
              <div className="grid gap-6 px-6 py-6 md:px-8 md:py-8 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="space-y-4">
                  <div className="chip-row">
                    <Badge tone={getSessionStatusTone(effectiveSessionStatus)}>{effectiveSessionStatus}</Badge>
                    <Badge tone={session.classType.category === "GROUP" ? "plum" : "warm"}>
                      {session.classType.category}
                    </Badge>
                    {session.recurringBookingRuleId ? <Badge tone="outline">Recurring</Badge> : null}
                  </div>

                  <div className="space-y-3">
                    <h2 className="section-title">{session.title}</h2>
                    <p className="max-w-2xl text-base leading-7 text-muted">
                      {compactList([
                        formatSessionWindow(session.startsAt, session.endsAt),
                        session.instructor.fullName,
                        session.classType.name,
                      ])}
                    </p>
                  </div>

                  <div className="surface-inset rounded-[24px] p-5">
                    <p className="section-kicker">Notes</p>
                    <p className="mt-3 text-sm leading-7 text-ink">
                      {session.notes || "No notes."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="stat-shell">
                    <p className="stat-label">Booked</p>
                    <p className="metric-number mt-3">{activeBookingCount}</p>
                  </div>
                  <div className="stat-shell">
                    <p className="stat-label">Capacity</p>
                    <p className="metric-number mt-3">{session.capacity}</p>
                  </div>
                  <div className="stat-shell">
                    <p className="stat-label">Attended</p>
                    <p className="metric-number mt-3">{attendedBookingCount}</p>
                  </div>
                  <div className="stat-shell">
                    <p className="stat-label">Google sync</p>
                    <p className="mt-3 text-base font-semibold text-ink">
                      {session.googleCalendarEventId
                        ? "Linked"
                        : isGoogleCalendarConfigured()
                          ? "Ready"
                          : "Off"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {session.googleCalendarEventId
                        ? "Linked"
                        : isGoogleCalendarConfigured()
                          ? "Ready"
                          : "Off"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card id="setup" variant="soft" className="scroll-mt-28 space-y-5">
              <div className="section-header">
                <div className="space-y-2">
                  <p className="section-kicker">Edit</p>
                  <h2 className="section-title">Session</h2>
                </div>
                <Badge tone="outline">Edit</Badge>
              </div>

              <SessionForm
                redirectTo={`/sessions/${session.id}`}
                classTypes={classTypes}
                instructors={instructors}
                initialValues={{
                  id: session.id,
                  classTypeId: session.classTypeId,
                  instructorId: session.instructorId,
                  title: session.title,
                  date: toDateInputValue(session.date),
                  startTime: session.startTime,
                  capacity: session.capacity,
                  notes: session.notes,
                  syncToGoogle: Boolean(session.googleCalendarEventId),
                }}
              />

              {session.status !== "CANCELLED" ? (
                <div className="space-y-3">
                  <form action={cancelSessionAction} className="space-y-3">
                    <input type="hidden" name="sessionId" value={session.id} />
                    <input type="hidden" name="redirectTo" value="/calendar" />
                    <input type="hidden" name="restoreConsumedBookings" value="true" />
                    <button type="submit" className={buttonStyles({ variant: "danger", size: "sm" })}>
                      {consumedBookingCount > 0 ? "Cancel and restore" : "Cancel session"}
                    </button>
                  </form>

                  {consumedBookingCount > 0 ? (
                    <form action={cancelSessionAction}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="redirectTo" value={`/sessions/${session.id}`} />
                      <input type="hidden" name="restoreConsumedBookings" value="false" />
                      <button type="submit" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                        Cancel only
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : restorableCancelledBookingCount > 0 ? (
                <RestoreSessionUsageForm sessionId={session.id} redirectTo={`/sessions/${session.id}`} />
              ) : null}
            </Card>
          </div>

          <Sheet
            className="order-1 xl:order-2"
            eyebrow="Session drawer"
            title={session.title}
            description={compactList([
              formatSessionWindow(session.startsAt, session.endsAt),
              session.instructor.fullName,
              `${activeBookingCount}/${session.capacity} booked`,
            ])}
            footer={
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/calendar" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                  Calendar
                </Link>
                <Link href="#setup" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                  Edit
                </Link>
                <Link href="/sales/package" className={buttonStyles({ variant: "ghost", size: "sm" })}>
                  <CircleDollarSign className="size-4" />
                  Sales
                </Link>
                <Link href="/sales/trial" className={buttonStyles({ variant: "ghost", size: "sm" })}>
                  Trials
                </Link>
              </div>
            }
          >
            <section id="drawer" className="scroll-mt-28 space-y-4">
              <div className="session-drawer-hero">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-4">
                    <div className="chip-row">
                      <Badge tone={session.classType.category === "GROUP" ? "plum" : "warm"}>
                        {session.classType.category}
                      </Badge>
                      <Badge tone={getSessionStatusTone(effectiveSessionStatus)}>{effectiveSessionStatus}</Badge>
                      {session.recurringBookingRuleId ? <Badge tone="outline">Recurring</Badge> : null}
                    </div>

                    <div className="space-y-2.5">
                      <div className="session-drawer-line">
                        <Clock3 className="size-4 text-accent-strong" />
                        {formatSessionWindow(session.startsAt, session.endsAt)}
                      </div>
                      <div className="session-drawer-line">
                        <UserRound className="size-4 text-accent-strong" />
                        {session.instructor.fullName}
                      </div>
                      <div className="session-drawer-line">
                        <WalletCards className="size-4 text-accent-strong" />
                        {session.classType.name}
                      </div>
                    </div>
                  </div>

                  <div className="session-drawer-occupancy">
                    <p className="session-drawer-occupancy-label">Booked</p>
                    <p className="session-drawer-occupancy-value">
                      {activeBookingCount}/{session.capacity}
                    </p>
                  </div>
                </div>

                <div className="session-drawer-kpis">
                  <div className="session-drawer-kpi">
                    <p className="session-drawer-kpi-label">Attended</p>
                    <p className="session-drawer-kpi-value">{attendedBookingCount}</p>
                  </div>
                  <div className="session-drawer-kpi">
                    <p className="session-drawer-kpi-label">Backed</p>
                    <p className="session-drawer-kpi-value">
                      {packageBackedCount + singleBackedCount + trialBackedCount}
                    </p>
                  </div>
                  <div className="session-drawer-kpi">
                    <p className="session-drawer-kpi-label">Alerts</p>
                    <p className="session-drawer-kpi-value">{sessionAlerts.length}</p>
                  </div>
                </div>

                <div className="session-drawer-mix">
                  <span className="session-drawer-mix-pill">Package {packageBackedCount}</span>
                  <span className="session-drawer-mix-pill">One-off {singleBackedCount}</span>
                  <span className="session-drawer-mix-pill">Trial {trialBackedCount}</span>
                  <span className="session-drawer-mix-pill">Override {overrideCount}</span>
                </div>
              </div>

              {sessionAlerts.length ? (
                <div className="space-y-2.5">
                  {sessionAlerts.map((alert) => (
                    <div
                      key={alert.title}
                      className={`session-drawer-alert ${alert.tone === "warning" ? "session-drawer-alert-warning" : "session-drawer-alert-info"}`}
                    >
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-accent-strong" />
                      <div>
                        <p className="font-semibold text-ink">{alert.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{alert.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="surface-inset rounded-[26px] p-4 md:p-5">
              <div className="section-header">
                <div className="space-y-2">
                  <p className="section-kicker">Add</p>
                  <h3 className="font-display text-[1.45rem] leading-none tracking-[-0.04em] text-ink">Booking</h3>
                </div>
                <Users2 className="size-4 text-accent-strong" />
              </div>
              {session.status !== "CANCELLED" ? (
                <div className="mt-4">
                  {activeBookingCount >= session.capacity ? (
                    <EmptyState title="Class is full" />
                  ) : (
                    <BookingForm
                      sessionId={session.id}
                      redirectTo={`/sessions/${session.id}`}
                      customers={availableBookingCustomers}
                      packageBalanceOptions={packageBalanceOptions}
                      singlePurchaseOptions={singlePurchaseOptions}
                      trialPurchaseOptions={trialPurchaseOptions.map((option) => ({
                        id: option.id,
                        customerId: option.customerId,
                        label: option.label,
                      }))}
                    />
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    title="Bookings are disabled"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="section-header">
                <div className="space-y-2">
                  <p className="section-kicker">Roster</p>
                  <h3 className="font-display text-[1.45rem] leading-none tracking-[-0.04em] text-ink">Roster</h3>
                </div>
              </div>

              <div className="space-y-3">
                {session.bookings.length ? (
                  session.bookings.map((booking, index) => (
                    <div key={booking.id} className="session-booking-card">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div className="chip-row">
                            <Badge tone={getPaymentSourceTone(booking.paymentSourceType)}>
                              {booking.paymentSourceType}
                            </Badge>
                            <Badge tone={getBookingStatusTone(booking.status)}>{booking.status}</Badge>
                          {booking.creditDeducted ? <Badge tone="outline">Credit deducted</Badge> : null}
                          {booking.singleUseConsumed ? <Badge tone="outline">One-off used</Badge> : null}
                          {booking.trialUseConsumed ? <Badge tone="outline">Trial used</Badge> : null}
                          {booking.restoredAt &&
                          !booking.creditDeducted &&
                          !booking.singleUseConsumed &&
                          !booking.trialUseConsumed ? <Badge tone="outline">Restored</Badge> : null}
                        </div>

                          <div>
                            <p className="font-semibold text-ink">{booking.customer.fullName}</p>
                            <p className="mt-1 text-sm leading-6 text-muted">
                              {getBookingBackingLabel(booking)}
                            </p>
                            {booking.notes ? (
                              <p className="mt-1 text-sm leading-6 text-muted">{booking.notes}</p>
                            ) : null}
                          </div>

                          {getBookingOperationalNote(booking) ? (
                            <div className="session-booking-note">
                              <p>{getBookingOperationalNote(booking)}</p>
                            </div>
                          ) : null}
                        </div>

                        <div className="session-booking-index">
                          <span className="session-booking-index-label">Booking</span>
                          <span className="session-booking-index-value">{index + 1}</span>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <BookingStatusForm
                          bookingId={booking.id}
                          redirectTo={`/sessions/${session.id}`}
                          currentStatus={booking.status}
                        />
                        {booking.status !== "CANCELLED" ? (
                          <form action={cancelBookingAction}>
                            <input type="hidden" name="bookingId" value={booking.id} />
                            <input type="hidden" name="redirectTo" value={`/sessions/${session.id}`} />
                            <button type="submit" className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full" })}>
                              Remove customer
                            </button>
                          </form>
                        ) : null}
                        {booking.creditDeducted || booking.singleUseConsumed || booking.trialUseConsumed ? (
                          <RestoreBookingUsageForm
                            bookingId={booking.id}
                            redirectTo={`/sessions/${session.id}`}
                            targetStatus={booking.status === "CANCELLED" ? "CANCELLED" : "BOOKED"}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No bookings yet" />
                )}
              </div>
            </div>
          </Sheet>
        </div>
      </section>
    </div>
  );
}
