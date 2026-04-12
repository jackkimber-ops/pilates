"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Clock3,
  ExternalLink,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { formatSessionWindow } from "@/lib/date";
import { cn } from "@/lib/utils";

type DrawerSessionDetail = {
  id: string;
  title: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  startsAt: string;
  endsAt: string;
  capacity: number;
  notes: string | null;
  isRecurring: boolean;
  syncStatus: "LINKED" | "READY" | "OFF";
  classType: {
    name: string;
    category: "GROUP" | "PRIVATE";
  };
  instructor: {
    fullName: string;
  };
  summary: string;
  counts: {
    activeBookingCount: number;
    attendedBookingCount: number;
    packageBackedCount: number;
    singleBackedCount: number;
    trialBackedCount: number;
    overrideCount: number;
  };
  alerts: Array<{
    title: string;
    detail: string;
    tone: "warning" | "info";
  }>;
  bookings: Array<{
    id: string;
    customerName: string;
    status: "BOOKED" | "ATTENDED" | "CANCELLED" | "LATE_CANCEL" | "NO_SHOW";
    paymentSourceType: "PACKAGE" | "SINGLE" | "TRIAL" | "OVERRIDE";
    backingLabel: string;
    note: string | null;
    bookingNotes: string | null;
    creditDeducted: boolean;
    singleUseConsumed: boolean;
    trialUseConsumed: boolean;
    restored: boolean;
  }>;
};

function getSessionStatusTone(status: DrawerSessionDetail["status"]) {
  if (status === "CANCELLED") return "neutral";
  if (status === "COMPLETED") return "sage";
  return "plum";
}

function getBookingStatusTone(status: DrawerSessionDetail["bookings"][number]["status"]) {
  if (status === "ATTENDED") return "sage";
  if (status === "CANCELLED") return "neutral";
  if (status === "NO_SHOW") return "danger";
  if (status === "LATE_CANCEL") return "warm";
  return "plum";
}

function getPaymentSourceTone(type: DrawerSessionDetail["bookings"][number]["paymentSourceType"]) {
  if (type === "PACKAGE") return "sage";
  if (type === "SINGLE") return "warm";
  if (type === "TRIAL") return "plum";
  return "neutral";
}

export function CalendarSessionDrawer({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const cacheRef = useRef(new Map<string, DrawerSessionDetail>());
  const [detail, setDetail] = useState<DrawerSessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(sessionId);
    if (cached) {
      setDetail(cached);
      setError(null);
    } else {
      setDetail(null);
    }

    const controller = new AbortController();
    const requestedSessionId = sessionId;

    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/sessions/${requestedSessionId}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Unable to load session.");
        }

        const payload = (await response.json()) as DrawerSessionDetail;
        cacheRef.current.set(requestedSessionId, payload);
        setDetail(payload);
      } catch (detailError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(detailError instanceof Error ? detailError.message : "Unable to load session.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => controller.abort();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, sessionId]);

  const sheetTitle = detail?.title ?? "Session";
  const startsAt = detail ? new Date(detail.startsAt) : null;
  const endsAt = detail ? new Date(detail.endsAt) : null;
  const drawerSummary = useMemo(() => {
    if (!detail || !startsAt || !endsAt) {
      return null;
    }

    return formatSessionWindow(startsAt, endsAt);
  }, [detail, startsAt, endsAt]);

  if (!sessionId) {
    return null;
  }

  return (
    <div className="calendar-detail-overlay" role="dialog" aria-modal="true" aria-label={sheetTitle}>
      <button
        type="button"
        className="calendar-detail-backdrop"
        aria-label="Close session details"
        onClick={onClose}
      />

      <aside className="calendar-detail-sheet sheet-shell">
        <div className="sheet-handle md:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="section-kicker">Session</p>
            <div className="space-y-1.5">
              <h2 className="section-title">{sheetTitle}</h2>
              {detail?.summary ? <p className="max-w-2xl text-sm leading-6 text-muted">{detail.summary}</p> : null}
            </div>
          </div>

          <button
            type="button"
            className={buttonStyles({ variant: "ghost", size: "icon", className: "shrink-0" })}
            onClick={onClose}
            aria-label="Close session details"
          >
            <X className="size-5" />
          </button>
        </div>

        {loading && !detail ? (
          <div className="mt-6 space-y-4">
            <div className="session-drawer-hero animate-pulse space-y-4">
              <div className="h-4 w-28 rounded-full bg-[rgba(122,109,105,0.14)]" />
              <div className="h-10 w-48 rounded-full bg-[rgba(122,109,105,0.14)]" />
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 rounded-[22px] bg-[rgba(122,109,105,0.12)]"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[22px] border border-danger-soft bg-danger-soft/92 px-4 py-3.5 text-sm leading-6 text-danger">
            {error}
          </div>
        ) : detail ? (
          <div className="mt-6 space-y-6">
            <section className="space-y-4">
              <div className="session-drawer-hero">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-4">
                    <div className="chip-row">
                      <Badge tone={detail.classType.category === "GROUP" ? "plum" : "warm"}>
                        {detail.classType.category}
                      </Badge>
                      <Badge tone={getSessionStatusTone(detail.status)}>{detail.status}</Badge>
                      {detail.isRecurring ? <Badge tone="outline">Recurring</Badge> : null}
                    </div>

                    <div className="space-y-2.5">
                      <div className="session-drawer-line">
                        <Clock3 className="size-4 text-accent-strong" />
                        {drawerSummary}
                      </div>
                      <div className="session-drawer-line">
                        <UserRound className="size-4 text-accent-strong" />
                        {detail.instructor.fullName}
                      </div>
                      <div className="session-drawer-line">
                        <WalletCards className="size-4 text-accent-strong" />
                        {detail.classType.name}
                      </div>
                      <div className="session-drawer-line">
                        <CalendarDays className="size-4 text-accent-strong" />
                        {detail.syncStatus === "LINKED"
                          ? "Google Calendar linked"
                          : detail.syncStatus === "READY"
                            ? "Google Calendar ready"
                            : "Google Calendar off"}
                      </div>
                    </div>
                  </div>

                  <div className="session-drawer-occupancy">
                    <p className="session-drawer-occupancy-label">Booked</p>
                    <p className="session-drawer-occupancy-value">
                      {detail.counts.activeBookingCount}/{detail.capacity}
                    </p>
                  </div>
                </div>

                <div className="session-drawer-kpis">
                  <div className="session-drawer-kpi">
                    <p className="session-drawer-kpi-label">Attended</p>
                    <p className="session-drawer-kpi-value">{detail.counts.attendedBookingCount}</p>
                  </div>
                  <div className="session-drawer-kpi">
                    <p className="session-drawer-kpi-label">Bookings</p>
                    <p className="session-drawer-kpi-value">{detail.bookings.length}</p>
                  </div>
                  <div className="session-drawer-kpi">
                    <p className="session-drawer-kpi-label">Alerts</p>
                    <p className="session-drawer-kpi-value">{detail.alerts.length}</p>
                  </div>
                </div>

                <div className="session-drawer-mix">
                  <span className="session-drawer-mix-pill">Package {detail.counts.packageBackedCount}</span>
                  <span className="session-drawer-mix-pill">One-off {detail.counts.singleBackedCount}</span>
                  <span className="session-drawer-mix-pill">Trial {detail.counts.trialBackedCount}</span>
                  <span className="session-drawer-mix-pill">Override {detail.counts.overrideCount}</span>
                </div>
              </div>

              {detail.alerts.length ? (
                <div className="space-y-2.5">
                  {detail.alerts.map((alert) => (
                    <div
                      key={`${alert.title}-${alert.detail}`}
                      className={cn(
                        "session-drawer-alert",
                        alert.tone === "warning"
                          ? "session-drawer-alert-warning"
                          : "session-drawer-alert-info",
                      )}
                    >
                      <div>
                        <p className="font-semibold text-ink">{alert.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{alert.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="surface-inset rounded-[24px] p-4">
                <p className="section-kicker">Notes</p>
                <p className="mt-3 text-sm leading-6 text-muted">{detail.notes || "No notes."}</p>
              </div>
            </section>

            <section className="space-y-4">
              <div className="section-header">
                <div className="space-y-2">
                  <p className="section-kicker">Bookings</p>
                  <h3 className="font-display text-[1.45rem] leading-none tracking-[-0.04em] text-ink">
                    Roster
                  </h3>
                </div>
                <Badge tone="outline">{detail.bookings.length}</Badge>
              </div>

              <div className="space-y-3">
                {detail.bookings.length ? (
                  detail.bookings.map((booking, index) => (
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
                            {booking.restored ? <Badge tone="outline">Restored</Badge> : null}
                          </div>

                          <div>
                            <p className="font-semibold text-ink">{booking.customerName}</p>
                            <p className="mt-1 text-sm leading-6 text-muted">{booking.backingLabel}</p>
                            {booking.bookingNotes ? (
                              <p className="mt-1 text-sm leading-6 text-muted">{booking.bookingNotes}</p>
                            ) : null}
                          </div>

                          {booking.note ? (
                            <div className="session-booking-note">
                              <p>{booking.note}</p>
                            </div>
                          ) : null}
                        </div>

                        <div className="session-booking-index">
                          <span className="session-booking-index-label">Booking</span>
                          <span className="session-booking-index-value">{index + 1}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No bookings yet.</div>
                )}
              </div>
            </section>
          </div>
        ) : null}

        <div className="sheet-footer">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
              onClick={onClose}
            >
              Close
            </button>
            {detail ? (
              <Link href={`/sessions/${detail.id}`} className={buttonStyles({ size: "sm" })}>
                Edit session
                <ExternalLink className="size-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
