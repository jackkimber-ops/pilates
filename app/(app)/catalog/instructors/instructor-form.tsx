"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { upsertInstructorAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";

export function InstructorForm({
  redirectTo,
  initialValues,
}: {
  redirectTo: string;
  initialValues?: {
    id?: string;
    fullName?: string;
    active?: boolean;
  };
}) {
  const [state, action] = useActionState(upsertInstructorAction, INITIAL_FORM_STATE);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}

      <FormMessage state={state} />

      <Field label="Full name" htmlFor="fullName" error={state.fieldErrors?.fullName?.[0]}>
        <input
          id="fullName"
          name="fullName"
          className="field-input"
          defaultValue={initialValues?.fullName ?? ""}
        />
      </Field>

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
        {initialValues?.id ? "Save instructor" : "Create instructor"}
      </SubmitButton>
    </form>
  );
}
