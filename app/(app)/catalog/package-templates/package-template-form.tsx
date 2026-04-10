"use client";

import { useActionState, useMemo, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, Select } from "@/components/ui/input";
import { upsertPackageTemplateAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";
import { formatCurrency } from "@/lib/utils";

const SESSION_OPTIONS = [
  { value: 10, label: "10 sessions", validityMonths: 3 },
  { value: 20, label: "20 sessions", validityMonths: 6 },
  { value: 40, label: "40 sessions", validityMonths: 12 },
  { value: 60, label: "60 sessions", validityMonths: 24 },
] as const;

export function PackageTemplateForm({
  redirectTo,
  classTypes,
  initialValues,
}: {
  redirectTo: string;
  classTypes: Array<{
    id: string;
    name: string;
    category: "GROUP" | "PRIVATE";
  }>;
  initialValues?: {
    id?: string;
    name?: string;
    classTypeId?: string;
    sessionCount?: number;
    validityMonths?: number;
    regularPrice?: string;
    packagePrice?: string;
    active?: boolean;
  };
}) {
  const [state, action] = useActionState(upsertPackageTemplateAction, INITIAL_FORM_STATE);
  const [classTypeId, setClassTypeId] = useState(initialValues?.classTypeId ?? classTypes[0]?.id ?? "");
  const [sessionCount, setSessionCount] = useState(initialValues?.sessionCount ?? 10);

  const selectedClassType =
    classTypes.find((classType) => classType.id === classTypeId) ?? classTypes[0] ?? null;
  const selectedSessionOption =
    SESSION_OPTIONS.find((option) => option.value === sessionCount) ?? SESSION_OPTIONS[0];
  const generatedName = selectedClassType ? `${selectedClassType.name} ${sessionCount}` : "";

  const savingsPreview = useMemo(() => {
    const regularPrice = Number(initialValues?.regularPrice ?? 0);
    const packagePrice = Number(initialValues?.packagePrice ?? 0);

    if (!regularPrice || !packagePrice || packagePrice >= regularPrice) {
      return null;
    }

    return formatCurrency(regularPrice - packagePrice);
  }, [initialValues?.packagePrice, initialValues?.regularPrice]);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}

      <FormMessage state={state} />

      <div className="surface-inset rounded-[24px] p-4">
        <p className="section-kicker">Name</p>
        <p className="mt-2 text-sm leading-6 text-muted">Name is based on class type and session count.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Class type" htmlFor="classTypeId" error={state.fieldErrors?.classTypeId?.[0]}>
          <Select
            id="classTypeId"
            name="classTypeId"
            value={classTypeId}
            onChange={(event) => setClassTypeId(event.target.value)}
          >
            {classTypes.map((classType) => (
              <option key={classType.id} value={classType.id}>
                {classType.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Session count" htmlFor="sessionCount" error={state.fieldErrors?.sessionCount?.[0]}>
          <Select
            id="sessionCount"
            name="sessionCount"
            value={String(sessionCount)}
            onChange={(event) => setSessionCount(Number(event.target.value))}
          >
            {SESSION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <Field label="Package name" htmlFor="name" error={state.fieldErrors?.name?.[0]}>
          <Input id="name" name="name" value={generatedName} readOnly />
        </Field>

        <Field label="Validity (months)" htmlFor="validityMonths" error={state.fieldErrors?.validityMonths?.[0]}>
          <Input
            id="validityMonths"
            name="validityMonths"
            type="number"
            value={selectedSessionOption.validityMonths}
            readOnly
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Regular price" htmlFor="regularPrice" error={state.fieldErrors?.regularPrice?.[0]}>
          <Input
            id="regularPrice"
            name="regularPrice"
            type="number"
            step="0.01"
            defaultValue={initialValues?.regularPrice ?? "0"}
          />
        </Field>

        <Field label="Package price" htmlFor="packagePrice" error={state.fieldErrors?.packagePrice?.[0]}>
          <Input
            id="packagePrice"
            name="packagePrice"
            type="number"
            step="0.01"
            defaultValue={initialValues?.packagePrice ?? "0"}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="list-row-quiet">
          <p className="section-kicker">Type</p>
          <p className="mt-3 font-semibold text-ink">
            {selectedClassType?.category === "GROUP" ? "Group" : "Private"}
          </p>
        </div>
        <div className="list-row-quiet">
          <p className="section-kicker">Savings</p>
          <p className="mt-3 font-semibold text-ink">{savingsPreview ?? "-"}</p>
        </div>
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
        {initialValues?.id ? "Save template" : "Create template"}
      </SubmitButton>
    </form>
  );
}
