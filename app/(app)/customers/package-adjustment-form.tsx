"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, Textarea } from "@/components/ui/input";
import { adjustPackageCreditsAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";

export function PackageAdjustmentForm({
  customerPackageId,
  redirectTo,
}: {
  customerPackageId: string;
  redirectTo: string;
}) {
  const [state, action] = useActionState(adjustPackageCreditsAction, INITIAL_FORM_STATE);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="customerPackageId" value={customerPackageId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <FormMessage state={state} />

      <Field label="Change" htmlFor={`delta-${customerPackageId}`} error={state.fieldErrors?.deltaCredits?.[0]}>
        <Input
          id={`delta-${customerPackageId}`}
          name="deltaCredits"
          type="text"
          inputMode="numeric"
          placeholder="+1 or -1"
        />
      </Field>

      <Field label="Reason" htmlFor={`reason-${customerPackageId}`} error={state.fieldErrors?.reason?.[0]}>
        <Textarea
          id={`reason-${customerPackageId}`}
          name="reason"
          placeholder="Reason"
        />
      </Field>

      <Field label="Notes" htmlFor={`notes-${customerPackageId}`} error={state.fieldErrors?.notes?.[0]}>
        <Textarea
          id={`notes-${customerPackageId}`}
          name="notes"
          placeholder="Optional note"
        />
      </Field>

      <SubmitButton className="w-full" variant="secondary" size="lg" pendingLabel="Saving...">
        Adjust balance
      </SubmitButton>
    </form>
  );
}
