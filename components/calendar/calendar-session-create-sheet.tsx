"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { createCalendarSessionAction } from "@/app/(app)/actions";
import { SessionForm } from "@/app/(app)/sessions/session-form";
import { buttonStyles } from "@/components/ui/button";
import type { FormState } from "@/lib/validation";

type SlotSelection = {
  date: string;
  time: string;
};

type SessionCreateOptionsPayload = {
  classTypes: Array<{
    id: string;
    name: string;
    maxCapacity: number;
    durationMinutes: number;
  }>;
  instructors: Array<{
    id: string;
    fullName: string;
  }>;
  customers: Array<{
    id: string;
    fullName: string;
  }>;
  packageAvailability: Array<{
    customerId: string;
    classTypeId: string;
    totalRemainingCredits: number;
    nextPackageName: string;
    nextPackageRemainingCredits: number;
    sourceType: "PACKAGE_SALE" | "IMPORTED";
  }>;
  trialAvailability: Array<{
    customerId: string;
    classTypeId: string;
    customerTrialPackageItemId: string;
    templateName: string;
    classTypeName: string;
    originalQuantity: number;
    remainingQuantity: number;
    availableQuantity: number;
  }>;
  defaultInstructorId: string;
};

function formatSlotSummary(slot: SlotSelection) {
  const [year, month, day] = slot.date.split("-").map(Number);
  const [hour = 8, minute = 0] = slot.time.split(":").map(Number);
  const value = new Date(year, (month ?? 1) - 1, day ?? 1, hour, minute);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function CalendarSessionCreateSheet({
  slot,
  onClose,
  onCreated,
}: {
  slot: SlotSelection | null;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}) {
  const [options, setOptions] = useState<SessionCreateOptionsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slot) {
      return;
    }

    const requestedSlot = slot;
    const controller = new AbortController();

    async function loadOptions() {
      try {
        setOptions(null);
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          date: requestedSlot.date,
          time: requestedSlot.time,
        });
        const response = await fetch(`/api/calendar/session-create?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Unable to load session options.");
        }

        const payload = (await response.json()) as SessionCreateOptionsPayload;
        setOptions(payload);
      } catch (optionsError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(optionsError instanceof Error ? optionsError.message : "Unable to load session options.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadOptions();

    return () => controller.abort();
  }, [slot]);

  useEffect(() => {
    if (!slot) {
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
  }, [onClose, slot]);

  const slotSummary = useMemo(() => (slot ? formatSlotSummary(slot) : ""), [slot]);

  if (!slot) {
    return null;
  }

  return (
    <div className="calendar-detail-overlay" role="dialog" aria-modal="true" aria-label="New session">
      <button
        type="button"
        className="calendar-detail-backdrop"
        aria-label="Close new session"
        onClick={onClose}
      />

      <aside className="calendar-detail-sheet sheet-shell">
        <div className="sheet-handle md:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="section-title">New session</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted">{slotSummary}</p>
          </div>

          <button
            type="button"
            className={buttonStyles({ variant: "ghost", size: "icon", className: "shrink-0" })}
            onClick={onClose}
            aria-label="Close new session"
          >
            <X className="size-5" />
          </button>
        </div>

        {loading && !options ? (
          <div className="mt-6 space-y-4">
            <div className="surface-inset rounded-[24px] p-4 space-y-3 animate-pulse">
              <div className="h-4 w-28 rounded-full bg-[rgba(122,109,105,0.14)]" />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-12 rounded-[20px] bg-[rgba(122,109,105,0.1)]" />
                <div className="h-12 rounded-[20px] bg-[rgba(122,109,105,0.1)]" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-12 rounded-[20px] bg-[rgba(122,109,105,0.1)]" />
                <div className="h-12 rounded-[20px] bg-[rgba(122,109,105,0.1)]" />
              </div>
              <div className="h-28 rounded-[22px] bg-[rgba(122,109,105,0.08)]" />
            </div>
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[22px] border border-danger-soft bg-danger-soft/92 px-4 py-3.5 text-sm leading-6 text-danger">
            {error}
          </div>
        ) : options ? (
          <div className="mt-6">
            <SessionForm
              key={`${slot.date}-${slot.time}-${options.defaultInstructorId}`}
              action={createCalendarSessionAction}
              layout="quick"
              submitLabel="Create session"
              pendingLabel="Creating..."
              classTypes={options.classTypes}
              instructors={options.instructors}
              customers={options.customers}
              packageAvailability={options.packageAvailability}
              trialAvailability={options.trialAvailability}
              initialValues={{
                date: slot.date,
                startTime: slot.time,
                classTypeId: options.classTypes[0]?.id,
                instructorId: options.defaultInstructorId || options.instructors[0]?.id,
                title: options.classTypes[0]?.name,
                capacity: options.classTypes[0]?.maxCapacity ?? 6,
              }}
              footerSecondaryAction={
                <button
                  type="button"
                  className={buttonStyles({ variant: "secondary", size: "md", className: "w-full md:w-auto" })}
                  onClick={onClose}
                >
                  Cancel
                </button>
              }
              onSuccess={(state: FormState) => {
                if (!state.entityId) {
                  return;
                }

                onCreated(state.entityId);
                setOptions(null);
              }}
            />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
