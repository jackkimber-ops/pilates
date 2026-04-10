"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { generateRecurringBookingsAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";

export function RecurringGenerationForm({
  ruleId,
  startDate,
  endDate,
}: {
  ruleId: string;
  startDate: string;
  endDate: string;
}) {
  const [state, action] = useActionState(generateRecurringBookingsAction, INITIAL_FORM_STATE);

  return (
    <form action={action} className="surface-inset space-y-4 rounded-[22px] p-4">
      <input type="hidden" name="ruleId" value={ruleId} />

      <FormMessage state={state} />

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="From" htmlFor={`start-${ruleId}`} error={state.fieldErrors?.startDate?.[0]}>
          <input
            id={`start-${ruleId}`}
            name="startDate"
            type="date"
            className="field-input"
            defaultValue={startDate}
          />
        </Field>

        <Field label="To" htmlFor={`end-${ruleId}`} error={state.fieldErrors?.endDate?.[0]}>
          <input
            id={`end-${ruleId}`}
            name="endDate"
            type="date"
            className="field-input"
            defaultValue={endDate}
          />
        </Field>
      </div>

      <SubmitButton className="w-full md:w-auto" variant="secondary" pendingLabel="Generating...">
        Generate
      </SubmitButton>
    </form>
  );
}
