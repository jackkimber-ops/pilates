"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Textarea } from "@/components/ui/input";
import { saveSessionAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/validation";
import { formatNumber } from "@/lib/utils";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, "0"));

function parseStartTime(value?: string) {
  if (!value) {
    return {
      hour12: "8",
      minute: "00",
      period: "AM" as const,
    };
  }

  const [rawHour = "08", rawMinute = "00"] = value.split(":");
  const hour = Number(rawHour);
  const minute = rawMinute.padStart(2, "0");
  const period = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;

  return {
    hour12: String(normalizedHour),
    minute,
    period: period as "AM" | "PM",
  };
}

function to24HourTime(hour12: string, minute: string, period: "AM" | "PM") {
  const parsedHour = Number(hour12);
  const safeHour = Number.isFinite(parsedHour) && parsedHour >= 1 && parsedHour <= 12 ? parsedHour : 8;
  const normalizedHour = period === "PM" ? (safeHour % 12) + 12 : safeHour % 12;
  return `${normalizedHour.toString().padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function formatTimeLabel(value: string) {
  const [hour = "08", minute = "00"] = value.split(":");
  const parsedHour = Number(hour);
  const date = new Date(2000, 0, 1, Number.isFinite(parsedHour) ? parsedHour : 8, Number(minute));

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function addMinutesToTime(value: string, minutesToAdd: number) {
  const [hour = "08", minute = "00"] = value.split(":");
  const parsedHour = Number(hour);
  const parsedMinute = Number(minute);
  const baseMinutes = (Number.isFinite(parsedHour) ? parsedHour : 8) * 60 + (Number.isFinite(parsedMinute) ? parsedMinute : 0);
  const totalMinutes = ((baseMinutes + minutesToAdd) % (24 * 60) + 24 * 60) % (24 * 60);
  const nextHour = Math.floor(totalMinutes / 60);
  const nextMinute = totalMinutes % 60;

  return `${nextHour.toString().padStart(2, "0")}:${nextMinute.toString().padStart(2, "0")}`;
}

type SessionFormProps = {
  redirectTo?: string;
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
  customers?: Array<{
    id: string;
    fullName: string;
  }>;
  packageAvailability?: Array<{
    customerId: string;
    classTypeId: string;
    totalRemainingCredits: number;
    nextPackageName: string;
    nextPackageRemainingCredits: number;
    sourceType: "PACKAGE_SALE" | "IMPORTED";
  }>;
  initialValues?: {
    id?: string;
    classTypeId?: string;
    instructorId?: string;
    customerId?: string;
    title?: string;
    date?: string;
    startTime?: string;
    capacity?: number;
    notes?: string | null;
    syncToGoogle?: boolean;
  };
  action?: (state: FormState, formData: FormData) => Promise<FormState>;
  layout?: "standard" | "quick";
  submitLabel?: string;
  pendingLabel?: string;
  footerSecondaryAction?: ReactNode;
  onSuccess?: (state: FormState) => void;
};

export function SessionForm({
  redirectTo,
  classTypes,
  instructors,
  customers = [],
  packageAvailability = [],
  initialValues,
  action: actionProp = saveSessionAction,
  layout = "standard",
  submitLabel,
  pendingLabel,
  footerSecondaryAction,
  onSuccess,
}: SessionFormProps) {
  const [state, action] = useActionState(actionProp, INITIAL_FORM_STATE);
  const [selectedClassTypeId, setSelectedClassTypeId] = useState(
    initialValues?.classTypeId ?? classTypes[0]?.id ?? "",
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialValues?.customerId ?? "");
  const selectedClassType =
    classTypes.find((classType) => classType.id === selectedClassTypeId) ?? classTypes[0];
  const [title, setTitle] = useState(initialValues?.title ?? selectedClassType?.name ?? "");
  const [capacity, setCapacity] = useState(initialValues?.capacity ?? selectedClassType?.maxCapacity ?? 6);
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [recurringWeekly, setRecurringWeekly] = useState(false);
  const parsedInitialTime = parseStartTime(initialValues?.startTime);
  const [selectedHour, setSelectedHour] = useState(parsedInitialTime.hour12);
  const [selectedMinute, setSelectedMinute] = useState(parsedInitialTime.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(parsedInitialTime.period);
  const packageAvailabilityByKey = useMemo(
    () =>
      new Map(
        packageAvailability.map((entry) => [`${entry.customerId}:${entry.classTypeId}`, entry] as const),
      ),
    [packageAvailability],
  );
  const selectedPackageAvailability = useMemo(
    () =>
      packageAvailabilityByKey.get(`${selectedCustomerId}:${selectedClassTypeId}`) ?? null,
    [packageAvailabilityByKey, selectedCustomerId, selectedClassTypeId],
  );
  const normalizedStartTime = useMemo(
    () => to24HourTime(selectedHour, selectedMinute, selectedPeriod),
    [selectedHour, selectedMinute, selectedPeriod],
  );
  const computedEndTime = useMemo(
    () => addMinutesToTime(normalizedStartTime, selectedClassType?.durationMinutes ?? 60),
    [normalizedStartTime, selectedClassType?.durationMinutes],
  );
  const isCreateMode = !initialValues?.id;
  const missingPackage = isCreateMode && selectedCustomerId !== "" && !selectedPackageAvailability;
  const lastSuccessRef = useRef<string | null>(null);
  const isQuickLayout = layout === "quick";

  useEffect(() => {
    if (!state.ok || !onSuccess) {
      return;
    }

    const successKey = state.entityId ?? state.message ?? "success";
    if (lastSuccessRef.current === successKey) {
      return;
    }

    lastSuccessRef.current = successKey;
    onSuccess(state);
  }, [onSuccess, state]);

  return (
      <form action={action} className="space-y-6">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}

      <FormMessage state={state} />

      <Field label="Class type" htmlFor="classTypeId" error={state.fieldErrors?.classTypeId?.[0]}>
        <Select
          id="classTypeId"
          name="classTypeId"
          value={selectedClassTypeId}
          onChange={(event) => {
            const nextClassType = classTypes.find((classType) => classType.id === event.target.value);
            setSelectedClassTypeId(event.target.value);
            if (nextClassType) {
              setTitle(nextClassType.name);
              setCapacity(nextClassType.maxCapacity);
            }
          }}
        >
          {classTypes.map((classType) => (
            <option key={classType.id} value={classType.id}>
              {classType.name}
            </option>
          ))}
        </Select>
      </Field>

      {isCreateMode ? (
        <Field label="Customer" htmlFor="customerId" error={state.fieldErrors?.customerId?.[0]}>
          <Select
            id="customerId"
            name="customerId"
            value={selectedCustomerId}
            onChange={(event) => setSelectedCustomerId(event.target.value)}
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.fullName}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {isCreateMode ? (
        <div className="surface-inset rounded-[24px] p-4">
          <div className="section-header">
            <div className="space-y-1.5">
              <p className="section-kicker">{isQuickLayout ? "Balance" : "Package check"}</p>
              <h3 className="font-display text-[1.3rem] leading-none tracking-[-0.04em] text-ink">
                {selectedCustomerId
                  ? selectedPackageAvailability
                    ? "Balance available"
                    : "No active balance"
                  : "Select a customer"}
              </h3>
            </div>
            {selectedPackageAvailability ? <Badge tone="sage">Ready</Badge> : <Badge tone="warm">Required</Badge>}
          </div>

          <div className="mt-3 text-sm leading-6 text-muted">
            {selectedPackageAvailability ? (
              <>
                <p>
                  Next package: <span className="font-semibold text-ink">{selectedPackageAvailability.nextPackageName}</span>
                </p>
                <p>
                  Remaining:{" "}
                  <span className="font-semibold text-ink">
                    {formatNumber(selectedPackageAvailability.totalRemainingCredits)}
                  </span>
                </p>
                <p>
                  Source:{" "}
                  <span className="font-semibold text-ink">
                    {selectedPackageAvailability.sourceType === "IMPORTED" ? "Imported balance" : "Package"}
                  </span>
                </p>
                <p>Credits are deducted on attendance.</p>
              </>
            ) : selectedCustomerId ? (
              <p>Matching balance required.</p>
            ) : (
              <p>Select a customer.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Instructor" htmlFor="instructorId" error={state.fieldErrors?.instructorId?.[0]}>
          <Select
            id="instructorId"
            name="instructorId"
            defaultValue={initialValues?.instructorId ?? instructors[0]?.id ?? ""}
          >
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Capacity" htmlFor="capacity" error={state.fieldErrors?.capacity?.[0]}>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
          />
        </Field>
      </div>

      <Field label="Title" htmlFor="title" error={state.fieldErrors?.title?.[0]}>
        <Input id="title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Field label="Date" htmlFor="date" error={state.fieldErrors?.date?.[0]}>
          <Input id="date" name="date" type="date" defaultValue={initialValues?.date} />
        </Field>

        <Field label="Start time" htmlFor="startHour" error={state.fieldErrors?.startTime?.[0]}>
          <input type="hidden" name="startTime" value={normalizedStartTime} />
          <div className="grid gap-3 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_104px]">
            <Select
              id="startHour"
              value={selectedHour}
              onChange={(event) => setSelectedHour(event.target.value)}
            >
              {HOUR_OPTIONS.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </Select>
            <Select
              id="startMinute"
              value={selectedMinute}
              onChange={(event) => setSelectedMinute(event.target.value)}
            >
              {MINUTE_OPTIONS.map((minute) => (
                <option key={minute} value={minute}>
                  {minute}
                </option>
              ))}
            </Select>
            <Select
              id="startPeriod"
              value={selectedPeriod}
              onChange={(event) => setSelectedPeriod(event.target.value as "AM" | "PM")}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </Select>
          </div>
        </Field>
      </div>

      <Field label="End time" htmlFor="endTimePreview">
        <Input id="endTimePreview" value={formatTimeLabel(computedEndTime)} readOnly />
      </Field>

      <Field label="Notes" htmlFor="notes" error={state.fieldErrors?.notes?.[0]}>
        <Textarea id="notes" name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      {isCreateMode ? (
        <div className="space-y-2">
          <label className="surface-inset flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm font-medium text-ink">
            <input
              name="recurringWeekly"
              type="checkbox"
              className="field-checkbox"
              checked={recurringWeekly}
              onChange={(event) => setRecurringWeekly(event.target.checked)}
            />
            Recurring weekly
          </label>
          {recurringWeekly ? (
            <p className="px-1 text-sm leading-6 text-muted">
              Creates weekly sessions. Credits are deducted only when attended.
            </p>
          ) : null}
        </div>
      ) : null}

      <label className="surface-inset flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm font-medium text-ink">
        <input
          name="syncToGoogle"
          type="checkbox"
          className="field-checkbox"
          defaultChecked={initialValues?.syncToGoogle ?? false}
        />
        Sync to Google Calendar
      </label>

      <div className="action-dock">
        <div className="action-dock-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {footerSecondaryAction}
            <SubmitButton
              className="w-full md:w-auto"
              size={isQuickLayout ? "md" : "lg"}
              pendingLabel={pendingLabel ?? (initialValues?.id ? "Saving..." : "Creating...")}
              disabled={missingPackage}
            >
              {submitLabel ?? (initialValues?.id ? "Save session" : "Create session")}
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}
