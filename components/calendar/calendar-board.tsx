"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DayHeaderContentArg, EventContentArg } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { ArrowRight } from "lucide-react";
import { CalendarSessionCreateSheet } from "@/components/calendar/calendar-session-create-sheet";
import { CalendarSessionDrawer } from "@/components/calendar/calendar-session-drawer";
import { buttonStyles } from "@/components/ui/button";
import { dispatchNavigationStart } from "@/lib/navigation-feedback";
import { cn, getInitials } from "@/lib/utils";

type CalendarView = "dayGridMonth" | "timeGridWeek" | "timeGridDay";

const VIEW_OPTIONS: Array<{ value: CalendarView; label: string }> = [
  { value: "timeGridDay", label: "Day" },
  { value: "timeGridWeek", label: "Week" },
  { value: "dayGridMonth", label: "Month" },
];

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

function toLocalDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalTimeInputValue(value: Date) {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function renderDayHeader(arg: DayHeaderContentArg) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(arg.date);
  const date = new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(arg.date);

  return (
    <div className="calendar-day-header">
      <span className="calendar-day-header-weekday">{weekday}</span>
      <span className="calendar-day-header-date">{date}</span>
    </div>
  );
}

function formatCompactEventTime(value: Date | null) {
  if (!value) {
    return "Session";
  }

  const hours = value.getHours();
  const minutes = value.getMinutes();
  const period = hours >= 12 ? "pm" : "am";
  const normalizedHour = hours % 12 || 12;

  if (minutes === 0) {
    return `${normalizedHour}${period}`;
  }

  return `${normalizedHour}:${String(minutes).padStart(2, "0")}${period}`;
}

function renderEventContent(info: EventContentArg) {
  const status = String(info.event.extendedProps.status ?? "SCHEDULED");
  const classTypeName = String(info.event.extendedProps.classTypeName ?? info.event.title);
  const instructorName = String(info.event.extendedProps.instructorName ?? "");
  const customerPreviewLines = Array.isArray(info.event.extendedProps.customerPreviewLines)
    ? info.event.extendedProps.customerPreviewLines.map((line) => String(line))
    : [];
  const bookingCount = Number(info.event.extendedProps.bookingCount ?? 0);
  const capacity = Number(info.event.extendedProps.capacity ?? 0);
  const isMonthView = info.view.type === "dayGridMonth";
  const customerSummary = customerPreviewLines.length ? customerPreviewLines.join(" · ") : "No bookings";
  const instructorLabel = instructorName ? getInitials(instructorName).slice(0, 1) : "";
  const compactTime = formatCompactEventTime(info.event.start);
  const topPill =
    status === "SCHEDULED"
      ? `${bookingCount}/${capacity}`
      : (STATUS_LABELS[status] ?? status.replaceAll("_", " "));

  return (
    <div
      className={cn(
        "calendar-event-shell",
        isMonthView ? "calendar-event-shell-month" : "calendar-event-shell-time",
        status === "CANCELLED" ? "calendar-event-shell-cancelled" : undefined,
      )}
      style={
        {
          "--event-accent": info.event.extendedProps.accentColor ?? info.event.backgroundColor,
          "--event-accent-soft":
            info.event.extendedProps.accentSoftColor ?? info.event.backgroundColor,
          "--event-accent-tint":
            info.event.extendedProps.accentTintColor ?? info.event.extendedProps.accentSoftColor ?? info.event.backgroundColor,
        } as CSSProperties
      }
    >
      <div className="calendar-event-topline">
        <span className="calendar-event-time">{compactTime}</span>
        <span className="calendar-event-topline-end">
          {instructorLabel ? <span className="calendar-event-instructor-chip">{instructorLabel}</span> : null}
          <span className={cn("calendar-event-pill", "calendar-event-pill-neutral")}>{topPill}</span>
        </span>
      </div>

      <div className={cn("calendar-event-body", isMonthView ? "calendar-event-body-month" : "calendar-event-body-time")}>
        <p
          className={cn(
            "calendar-event-customer-summary",
            customerSummary === "No bookings" ? "calendar-event-customer-empty" : undefined,
          )}
        >
          {customerSummary}
        </p>
        <p className="calendar-event-title">{classTypeName}</p>
      </div>
    </div>
  );
}

export function CalendarBoard() {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar | null>(null);
  const [view, setView] = useState<CalendarView>("timeGridDay");
  const [isDesktop, setIsDesktop] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [createSlot, setCreateSlot] = useState<{ date: string; time: string } | null>(null);
  const [, startRefreshTransition] = useTransition();

  const applyView = (nextView: CalendarView) => {
    setView(nextView);
    queueMicrotask(() => {
      calendarRef.current?.getApi().changeView(nextView);
    });
  };

  const refreshCalendarEvents = (options: { refreshPage?: boolean } = {}) => {
    const shouldRefreshPage = options.refreshPage ?? true;
    calendarRef.current?.getApi().refetchEvents();

    if (shouldRefreshPage) {
      startRefreshTransition(() => {
        router.refresh();
      });
    }
  };

  const handleSessionDeleted = (sessionId: string) => {
    setSelectedSessionId(null);
    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.getEventById(sessionId)?.remove();
    refreshCalendarEvents();
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const handleChange = () => {
      setIsDesktop(mediaQuery.matches);
      setView((currentView) => {
        const nextView =
          currentView === "dayGridMonth"
            ? currentView
            : mediaQuery.matches
              ? "timeGridWeek"
              : "timeGridDay";

        queueMicrotask(() => {
          calendarRef.current?.getApi().changeView(nextView);
        });

        return nextView;
      });
    };

    handleChange();

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-end">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="segmented-control max-w-[320px]">
            {VIEW_OPTIONS.map((option) => (
              <button
              key={option.value}
              type="button"
              className={cn("segmented-option", view === option.value ? "segmented-option-active" : undefined)}
              onClick={() => applyView(option.value)}
            >
              {option.label}
            </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-[22px] border border-danger-soft bg-danger-soft/90 px-4 py-3.5 text-sm leading-6 text-danger">
          {error}
        </div>
      ) : null}

      <div className="calendar-shell">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          headerToolbar={
            isDesktop
              ? {
                  left: "prev,next today",
                  center: "title",
                  right: "",
                }
              : {
                  left: "title",
                  center: "",
                  right: "prev,next",
                }
          }
          buttonText={{
            today: "Today",
          }}
          editable
          eventDurationEditable={false}
          eventOverlap={false}
          slotEventOverlap={false}
          allDaySlot={false}
          height="auto"
          stickyHeaderDates
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotLabelInterval={{ hours: 1 }}
          nowIndicator
          dayMaxEventRows={3}
          eventDisplay="block"
          eventTimeFormat={{
            hour: "numeric",
            minute: "2-digit",
            meridiem: "short",
          }}
          slotLabelFormat={{
            hour: "numeric",
            minute: "2-digit",
            meridiem: "short",
          }}
          events={async (fetchInfo, successCallback, failureCallback) => {
            try {
              setError(null);
              const params = new URLSearchParams({
                start: fetchInfo.startStr,
                end: fetchInfo.endStr,
              });
              const response = await fetch(`/api/calendar/events?${params.toString()}`, {
                cache: "no-store",
              });

              if (!response.ok) {
                throw new Error("Unable to load calendar sessions.");
              }

              successCallback(await response.json());
            } catch (eventError) {
              const message =
                eventError instanceof Error ? eventError.message : "Unable to load calendar sessions.";
              setError(message);
              failureCallback(eventError as Error);
            }
          }}
          dateClick={(info) => {
            setSelectedSessionId(null);
            const date = info.dateStr.slice(0, 10);
            const time = info.allDay ? "08:00" : toLocalTimeInputValue(info.date);
            setCreateSlot({ date, time });
          }}
          eventClick={(info) => {
            if (info.jsEvent.metaKey || info.jsEvent.ctrlKey) {
              dispatchNavigationStart();
              router.push(`/sessions/${info.event.id}`);
              return;
            }

            setSelectedSessionId(info.event.id);
          }}
          eventDrop={async (info) => {
            setError(null);

            try {
              const response = await fetch(`/api/sessions/${info.event.id}/move`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  startsAt: info.event.start?.toISOString(),
                }),
              });

              if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                throw new Error(payload?.error ?? "Unable to move the session.");
              }

              refreshCalendarEvents();
            } catch (eventError) {
              info.revert();
              setError(eventError instanceof Error ? eventError.message : "Unable to move the session.");
            }
          }}
          dayHeaderContent={renderDayHeader}
          moreLinkContent={(arg) => `+${arg.num} more`}
          eventClassNames={(info) => [
            "calendar-event-host",
            info.view.type === "dayGridMonth" ? "calendar-event-host-month" : "calendar-event-host-time",
          ]}
          eventContent={renderEventContent}
        />
      </div>

      <div className="calendar-board-footer">
        <p className="text-sm leading-6 text-muted">Tap a session to preview.</p>
        <button
          type="button"
          className={buttonStyles({ variant: "ghost", size: "sm" })}
          onClick={() => {
            const baseDate = calendarRef.current?.getApi().getDate() ?? new Date();
            const date = toLocalDateInputValue(baseDate);
            setCreateSlot({ date, time: "08:00" });
          }}
        >
          Create session
          <ArrowRight className="size-4" />
        </button>
      </div>

      <CalendarSessionDrawer
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
        onDeleted={handleSessionDeleted}
      />
      <CalendarSessionCreateSheet
        slot={createSlot}
        onClose={() => setCreateSlot(null)}
        onCreated={() => {
          setCreateSlot(null);
          refreshCalendarEvents();
        }}
      />
    </div>
  );
}
