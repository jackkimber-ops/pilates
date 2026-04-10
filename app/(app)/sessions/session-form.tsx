"use client";

import { useActionState, useMemo, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Textarea } from "@/components/ui/input";
import { saveSessionAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";
import { formatNumber } from "@/lib/utils";

type SessionFormProps = {
  redirectTo?: string;
  classTypes: Array<{
    id: string;
    name: string;
    maxCapacity: number;
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
};

export function SessionForm({
  redirectTo,
  classTypes,
  instructors,
  customers = [],
  packageAvailability = [],
  initialValues,
}: SessionFormProps) {
  const [state, action] = useActionState(saveSessionAction, INITIAL_FORM_STATE);
  const [selectedClassTypeId, setSelectedClassTypeId] = useState(
    initialValues?.classTypeId ?? classTypes[0]?.id ?? "",
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialValues?.customerId ?? "");
  const selectedClassType =
    classTypes.find((classType) => classType.id === selectedClassTypeId) ?? classTypes[0];
  const [title, setTitle] = useState(initialValues?.title ?? selectedClassType?.name ?? "");
  const [capacity, setCapacity] = useState(initialValues?.capacity ?? selectedClassType?.maxCapacity ?? 6);
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const selectedPackageAvailability = useMemo(
    () =>
      packageAvailability.find(
        (entry) => entry.customerId === selectedCustomerId && entry.classTypeId === selectedClassTypeId,
      ) ?? null,
    [packageAvailability, selectedCustomerId, selectedClassTypeId],
  );
  const isCreateMode = !initialValues?.id;
  const missingPackage = isCreateMode && selectedCustomerId !== "" && !selectedPackageAvailability;

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
              <p className="section-kicker">Package check</p>
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
                <p>1 credit will be used.</p>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Date" htmlFor="date" error={state.fieldErrors?.date?.[0]}>
          <Input id="date" name="date" type="date" defaultValue={initialValues?.date} />
        </Field>

        <Field label="Start time" htmlFor="startTime" error={state.fieldErrors?.startTime?.[0]}>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue={initialValues?.startTime}
          />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" error={state.fieldErrors?.notes?.[0]}>
        <Textarea id="notes" name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

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
          <SubmitButton
            className="w-full md:w-auto"
            size="lg"
            pendingLabel={initialValues?.id ? "Saving..." : "Creating..."}
            disabled={missingPackage}
          >
            {initialValues?.id ? "Save session" : "Create and book"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
