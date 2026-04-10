"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { upsertClassTypeAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";

export function ClassTypeForm({
  redirectTo,
  initialValues,
}: {
  redirectTo: string;
  initialValues?: {
    id?: string;
    name?: string;
    category?: "GROUP" | "PRIVATE";
    durationMinutes?: number;
    defaultSinglePrice?: string;
    maxCapacity?: number;
    color?: string;
    active?: boolean;
  };
}) {
  const [state, action] = useActionState(upsertClassTypeAction, INITIAL_FORM_STATE);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}

      <FormMessage state={state} />

      <Field label="Name" htmlFor="name" error={state.fieldErrors?.name?.[0]}>
        <input id="name" name="name" className="field-input" defaultValue={initialValues?.name ?? ""} />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Category" htmlFor="category" error={state.fieldErrors?.category?.[0]}>
          <select
            id="category"
            name="category"
            className="field-input"
            defaultValue={initialValues?.category ?? "GROUP"}
          >
            <option value="GROUP">Group</option>
            <option value="PRIVATE">Private</option>
          </select>
        </Field>

        <Field label="Duration (minutes)" htmlFor="durationMinutes" error={state.fieldErrors?.durationMinutes?.[0]}>
          <input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            className="field-input"
            defaultValue={initialValues?.durationMinutes ?? 60}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Default single price" htmlFor="defaultSinglePrice" error={state.fieldErrors?.defaultSinglePrice?.[0]}>
          <input
            id="defaultSinglePrice"
            name="defaultSinglePrice"
            type="number"
            step="0.01"
            className="field-input"
            defaultValue={initialValues?.defaultSinglePrice ?? "0"}
          />
        </Field>

        <Field label="Capacity" htmlFor="maxCapacity" error={state.fieldErrors?.maxCapacity?.[0]}>
          <input
            id="maxCapacity"
            name="maxCapacity"
            type="number"
            className="field-input"
            defaultValue={initialValues?.maxCapacity ?? 6}
          />
        </Field>

        <Field label="Color" htmlFor="color" error={state.fieldErrors?.color?.[0]}>
          <input
            id="color"
            name="color"
            type="color"
            className="field-input px-2"
            defaultValue={initialValues?.color ?? "#7b5c71"}
          />
        </Field>
      </div>

      <label className="surface-inset flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm font-medium text-ink">
        <input
          name="active"
          type="checkbox"
          className="field-checkbox"
          defaultChecked={initialValues?.active ?? true}
        />
        Active
      </label>

      <SubmitButton className="w-full md:w-auto" pendingLabel="Saving...">
        {initialValues?.id ? "Save class type" : "Create class type"}
      </SubmitButton>
    </form>
  );
}
