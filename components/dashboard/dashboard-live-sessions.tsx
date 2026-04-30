"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardLiveSession, DashboardLiveSessionsPayload } from "@/lib/dashboard-live-sessions";
import { toDateTimeLabel, toRelativeDayLabel } from "@/lib/date";
import { compactList } from "@/lib/utils";

const DASHBOARD_REFRESH_MS = 60_000;

type DashboardLiveSessionsContextValue = {
  data: DashboardLiveSessionsPayload;
  isRefreshing: boolean;
  lastUpdatedLabel: string;
};

const DashboardLiveSessionsContext = createContext<DashboardLiveSessionsContextValue | null>(null);

function getSessionClientLabel(session: DashboardLiveSession) {
  if (!session.customerNames.length) {
    return "No clients";
  }

  if (session.customerNames.length <= 2) {
    return session.customerNames.join(", ");
  }

  return `${session.customerNames.slice(0, 2).join(", ")} +${session.customerNames.length - 2}`;
}

function getLastUpdatedLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function useDashboardLiveSessions() {
  const context = useContext(DashboardLiveSessionsContext);

  if (!context) {
    throw new Error("Dashboard live sessions context is missing.");
  }

  return context;
}

export function DashboardLiveSessionsProvider({
  initialData,
  children,
}: {
  initialData: DashboardLiveSessionsPayload;
  children: ReactNode;
}) {
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const latestRequestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    latestRequestRef.current?.abort();
    const controller = new AbortController();
    latestRequestRef.current = controller;

    try {
      setIsRefreshing(true);
      const response = await fetch("/api/dashboard/sessions", {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Unable to refresh dashboard.");
      }

      setData((await response.json()) as DashboardLiveSessionsPayload);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh();
    }, DASHBOARD_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      latestRequestRef.current?.abort();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      data,
      isRefreshing,
      lastUpdatedLabel: getLastUpdatedLabel(data.fetchedAt),
    }),
    [data, isRefreshing],
  );

  return (
    <DashboardLiveSessionsContext.Provider value={value}>
      {children}
    </DashboardLiveSessionsContext.Provider>
  );
}

export function DashboardSessionStats({ followUpCount }: { followUpCount: number }) {
  const { data } = useDashboardLiveSessions();

  return (
    <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
      <div className="stat-shell">
        <p className="stat-label">Sessions today</p>
        <p className="metric-number mt-3">{data.todaySessions.length}</p>
      </div>
      <div className="stat-shell">
        <p className="stat-label">Bookings today</p>
        <p className="metric-number mt-3">{data.totalTodayBookings}</p>
      </div>
      <div className="stat-shell">
        <p className="stat-label">Follow-up items</p>
        <p className="metric-number mt-3">{followUpCount}</p>
      </div>
    </div>
  );
}

export function DashboardNextSessionCard() {
  const { data, isRefreshing, lastUpdatedLabel } = useDashboardLiveSessions();
  const nextSession = data.upcomingSessions[0] ?? null;

  return (
    <Card variant="soft" className="space-y-5">
      <div className="section-header">
        <h2 className="section-title">Next session</h2>
        <Badge tone="outline">{isRefreshing ? "Updating" : `Live ${lastUpdatedLabel}`}</Badge>
      </div>

      {nextSession ? (
        <Link href={`/sessions/${nextSession.id}`} className="list-row block">
          <div className="space-y-3">
            <div className="chip-row">
              <Badge tone={nextSession.classType.category === "GROUP" ? "plum" : "warm"}>
                {nextSession.classType.category}
              </Badge>
              <Badge tone="outline">{nextSession.status}</Badge>
            </div>
            <div className="space-y-1">
              <p className="font-display text-[1.7rem] leading-none tracking-[-0.04em] text-ink">
                {nextSession.title}
              </p>
              <p className="text-sm leading-6 text-muted">
                {compactList([
                  toDateTimeLabel(new Date(nextSession.startsAt)),
                  getSessionClientLabel(nextSession),
                  `${nextSession.bookingCount}/${nextSession.capacity} booked`,
                ])}
              </p>
            </div>
          </div>
        </Link>
      ) : (
        <EmptyState title="No upcoming sessions" description="Create a session." />
      )}

      <div className="space-y-3">
        {data.upcomingSessions.slice(1, 4).map((session) => (
          <Link key={session.id} href={`/sessions/${session.id}`} className="list-row-quiet block">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{session.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {compactList([
                    toDateTimeLabel(new Date(session.startsAt)),
                    getSessionClientLabel(session),
                    `${session.bookingCount}/${session.capacity} booked`,
                  ])}
                </p>
              </div>
              <Badge tone={session.classType.category === "GROUP" ? "plum" : "warm"}>
                {session.classType.category}
              </Badge>
            </div>
          </Link>
        ))}
      </div>

      <Link href="/calendar" className={buttonStyles({ variant: "secondary", size: "sm" })}>
        Calendar
      </Link>
    </Card>
  );
}

export function DashboardTodaySessionsCard() {
  const { data } = useDashboardLiveSessions();

  return (
    <Card className="space-y-6">
      <div className="section-header">
        <h2 className="section-title">Today</h2>
      </div>

      <div className="space-y-3" aria-live="polite">
        {data.todaySessions.length ? (
          data.todaySessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`} className="list-row block">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <div className="chip-row">
                    <Badge tone={session.classType.category === "GROUP" ? "plum" : "warm"}>
                      {session.classType.category}
                    </Badge>
                    <Badge tone="outline">{session.status}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="font-display text-[1.8rem] leading-none tracking-[-0.04em] text-ink">
                      {session.title}
                    </p>
                    <p className="text-sm leading-6 text-muted">
                      {compactList([
                        session.classType.name,
                        getSessionClientLabel(session),
                        `${session.bookingCount}/${session.capacity} booked`,
                      ])}
                    </p>
                  </div>
                </div>

                <div className="md:text-right">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
                    {toRelativeDayLabel(new Date(session.startsAt))}
                  </p>
                  <p className="mt-2 font-display text-[1.55rem] leading-none tracking-[-0.04em] text-ink">
                    {session.startTime}
                  </p>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <EmptyState
            title="No sessions today"
            description="Create a session."
            action={
              <Link href="/sessions/new" className={buttonStyles({ variant: "tonal", size: "sm" })}>
                Create session
              </Link>
            }
          />
        )}
      </div>
    </Card>
  );
}
