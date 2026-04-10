"use client";

import { useActionState } from "react";
import { PAYMENT_SOURCE_OPTIONS, WEEKDAY_OPTIONS } from "@/lib/constants";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { createRecurringRuleAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";

type RecurringRuleFormProps = {
  redirectTo: string;
  initialCustomerId?: string;
  initialStartDate: string;
  customers: Array<{ id: string; fullName: string }>;
  classTypes: Array<{ id: string; name: string }>;
  instructors: Array<{ id: string; fullName: string }>;
};

export function RecurringRuleForm({
  redirectTo,
  initialCustomerId,
  initialStartDate,
  customers,
  classTypes,
  instructors,
}: RecurringRuleFormProps) {
  const [state, action] = useActionState(createRecurringRuleAction, INITIAL_FORM_STATE);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="active" value="true" />

      <FormMessage state={state} />

      <Field label="Customer" htmlFor="customerId" error={state.fieldErrors?.customerId?.[0]}>
        <select
          id="customerId"
          name="customerId"
          className="field-input"
          defaultValue={initialCustomerId ?? ""}
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.fullName}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Class type" htmlFor="classTypeId" error={state.fieldErrors?.classTypeId?.[0]}>
          <select id="classTypeId" name="classTypeId" className="field-input">
            {classTypes.map((classType) => (
              <option key={classType.id} value={classType.id}>
                {classType.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Instructor" htmlFor="instructorId" hint="Optional" error={state.fieldErrors?.instructorId?.[0]}>
          <select id="instructorId" name="instructorId" className="field-input" defaultValue="">
            <option value="">Assign later</option>
            {instructors.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.fullName}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Day of week" htmlFor="dayOfWeek" error={state.fieldErrors?.dayOfWeek?.[0]}>
          <select id="dayOfWeek" name="dayOfWeek" className="field-input" defaultValue="WEDNESDAY">
            {WEEKDAY_OPTIONS.map((weekday) => (
              <option key={weekday.value} value={weekday.value}>
                {weekday.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Start time" htmlFor="startTime" error={state.fieldErrors?.startTime?.[0]}>
          <input id="startTime" name="startTime" type="time" className="field-input" defaultValue="08:00" />
        </Field>

        <Field
          label="Payment source"
          htmlFor="paymentSourceType"
          error={state.fieldErrors?.paymentSourceType?.[0]}
        >
          <select id="paymentSourceType" name="paymentSourceType" className="field-input" defaultValue="PACKAGE">
            {PAYMENT_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Start date" htmlFor="startDate" error={state.fieldErrors?.startDate?.[0]}>
          <input
            id="startDate"
            name="startDate"
            type="date"
            className="field-input"
            defaultValue={initialStartDate}
          />
        </Field>

        <Field label="End date" htmlFor="endDate" hint="Optional" error={state.fieldErrors?.endDate?.[0]}>
          <input id="endDate" name="endDate" type="date" className="field-input" />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" error={state.fieldErrors?.notes?.[0]}>
        <textarea id="notes" name="notes" className="field-textarea" />
      </Field>

      <SubmitButton className="w-full md:w-auto" pendingLabel="Saving...">
        Create rule
      </SubmitButton>
    </form>
  );
}
