"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { addImportedBalanceAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";

type ImportedBalanceFormProps = {
  redirectTo: string;
  customers: Array<{ id: string; fullName: string }>;
  classTypes: Array<{ id: string; name: string }>;
  initialCustomerId?: string;
};

export function ImportedBalanceForm({
  redirectTo,
  customers,
  classTypes,
  initialCustomerId,
}: ImportedBalanceFormProps) {
  const [state, action] = useActionState(addImportedBalanceAction, INITIAL_FORM_STATE);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <FormMessage state={state} />

      <Field label="Customer" htmlFor="customerId" error={state.fieldErrors?.customerId?.[0]}>
        <Select id="customerId" name="customerId" defaultValue={initialCustomerId ?? ""}>
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.fullName}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Class type" htmlFor="classTypeId" error={state.fieldErrors?.classTypeId?.[0]}>
        <Select id="classTypeId" name="classTypeId" defaultValue="">
          <option value="">Select class type</option>
          {classTypes.map((classType) => (
            <option key={classType.id} value={classType.id}>
              {classType.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Remaining sessions" htmlFor="remainingCredits" error={state.fieldErrors?.remainingCredits?.[0]}>
          <Input id="remainingCredits" name="remainingCredits" type="number" min={0} />
        </Field>

        <Field label="Original sessions" htmlFor="originalCredits" error={state.fieldErrors?.originalCredits?.[0]}>
          <Input id="originalCredits" name="originalCredits" type="number" min={0} />
        </Field>
      </div>

      <Field label="Expiry date" htmlFor="expiryDate" error={state.fieldErrors?.expiryDate?.[0]}>
        <Input id="expiryDate" name="expiryDate" type="date" />
      </Field>

      <Field label="Notes" htmlFor="notes" error={state.fieldErrors?.notes?.[0]}>
        <Textarea id="notes" name="notes" defaultValue="Imported from previous system" />
      </Field>

      <div className="action-dock">
        <div className="action-dock-panel">
          <SubmitButton className="w-full md:w-auto" size="lg" pendingLabel="Saving...">
            Add imported balance
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

