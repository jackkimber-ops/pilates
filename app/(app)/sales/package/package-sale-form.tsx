"use client";

import { useActionState, useState } from "react";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { sellPackageAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";
import { formatCurrency } from "@/lib/utils";

type PackageSaleFormProps = {
  redirectTo: string;
  initialCustomerId?: string;
  initialPurchaseDate: string;
  customers: Array<{ id: string; fullName: string }>;
  templates: Array<{
    id: string;
    name: string;
    category: string;
    sessionCount: number;
    validityMonths: number;
    regularPrice: string;
    packagePrice: string;
  }>;
};

export function PackageSaleForm({
  redirectTo,
  initialCustomerId,
  initialPurchaseDate,
  customers,
  templates,
}: PackageSaleFormProps) {
  const [state, action] = useActionState(sellPackageAction, INITIAL_FORM_STATE);
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];

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

      <Field
        label="Package template"
        htmlFor="packageTemplateId"
        error={state.fieldErrors?.packageTemplateId?.[0]}
      >
        <Select
          id="packageTemplateId"
          name="packageTemplateId"
          value={selectedTemplateId}
          onChange={(event) => setSelectedTemplateId(event.target.value)}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Select>
      </Field>

      {selectedTemplate ? (
        <div className="surface-inset rounded-[24px] p-4">
          <p className="section-kicker">Package</p>
          <div className="mt-3 space-y-2">
            <p className="font-semibold text-ink">{selectedTemplate.name}</p>
            <p className="text-sm leading-6 text-muted">
              {selectedTemplate.sessionCount} sessions / {selectedTemplate.validityMonths} months /{" "}
              {selectedTemplate.category === "GROUP" ? "Group" : "Private"}
            </p>
            <p className="text-sm leading-6 text-muted">
              Regular {formatCurrency(selectedTemplate.regularPrice)} / Package{" "}
              {formatCurrency(selectedTemplate.packagePrice)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Purchase date" htmlFor="purchaseDate" error={state.fieldErrors?.purchaseDate?.[0]}>
          <Input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            defaultValue={initialPurchaseDate}
          />
        </Field>

        <Field label="Amount paid" htmlFor="amountPaid" error={state.fieldErrors?.amountPaid?.[0]}>
          <Input
            id="amountPaid"
            name="amountPaid"
            type="number"
            step="0.01"
            defaultValue={selectedTemplate?.packagePrice ?? ""}
            key={selectedTemplateId}
          />
        </Field>
      </div>

      <Field label="Payment method" htmlFor="paymentMethod" error={state.fieldErrors?.paymentMethod?.[0]}>
        <Select id="paymentMethod" name="paymentMethod" defaultValue="PROMPTPAY">
          {PAYMENT_METHOD_OPTIONS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Notes" htmlFor="notes" error={state.fieldErrors?.notes?.[0]}>
        <Textarea id="notes" name="notes" placeholder="Optional note" />
      </Field>

      <div className="action-dock">
        <div className="action-dock-panel">
          <SubmitButton className="w-full md:w-auto" size="lg" pendingLabel="Saving...">
            Sell package
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
