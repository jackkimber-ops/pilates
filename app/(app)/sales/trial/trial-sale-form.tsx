"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { sellTrialPackageAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";
import { formatCurrency } from "@/lib/utils";

type TrialSaleFormProps = {
  redirectTo: string;
  initialCustomerId?: string;
  initialPurchaseDate: string;
  customers: Array<{
    id: string;
    fullName: string;
    historyCounts: {
      bookings: number;
      packages: number;
      oneOffs: number;
      trials: number;
    };
  }>;
  templates: Array<{
    id: string;
    name: string;
    price: string;
    items: Array<{
      classTypeId: string;
      classTypeName: string;
      quantity: number;
    }>;
    notes?: string | null;
  }>;
};

export function TrialSaleForm({
  redirectTo,
  initialCustomerId,
  initialPurchaseDate,
  customers,
  templates,
}: TrialSaleFormProps) {
  const [state, action] = useActionState(sellTrialPackageAction, INITIAL_FORM_STATE);
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const customerHasPriorActivity = selectedCustomer
    ? Object.values(selectedCustomer.historyCounts).some((count) => count > 0)
    : false;

  const customerWarning = useMemo(() => {
    if (!selectedCustomer || !customerHasPriorActivity) {
      return null;
    }

    const details = [];

    if (selectedCustomer.historyCounts.bookings > 0) {
      details.push(`${selectedCustomer.historyCounts.bookings} booking${selectedCustomer.historyCounts.bookings === 1 ? "" : "s"}`);
    }

    if (selectedCustomer.historyCounts.packages > 0) {
      details.push(`${selectedCustomer.historyCounts.packages} package sale${selectedCustomer.historyCounts.packages === 1 ? "" : "s"}`);
    }

    if (selectedCustomer.historyCounts.oneOffs > 0) {
      details.push(`${selectedCustomer.historyCounts.oneOffs} one-off${selectedCustomer.historyCounts.oneOffs === 1 ? "" : "s"}`);
    }

    if (selectedCustomer.historyCounts.trials > 0) {
      details.push(`${selectedCustomer.historyCounts.trials} prior trial${selectedCustomer.historyCounts.trials === 1 ? "" : "s"}`);
    }

    return details.join(" / ");
  }, [customerHasPriorActivity, selectedCustomer]);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <FormMessage state={state} />

      <Field label="Customer" htmlFor="customerId" error={state.fieldErrors?.customerId?.[0]}>
        <Select
          id="customerId"
          name="customerId"
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.fullName}
            </option>
          ))}
        </Select>
      </Field>

      {customerWarning ? (
        <div className="rounded-[24px] bg-warm-soft/90 px-4 py-4 text-sm leading-6 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warm" />
            <div>
              <p className="font-semibold text-ink">Customer already has history</p>
              <p className="mt-1 text-muted">{customerWarning}</p>
            </div>
          </div>
        </div>
      ) : null}

      <Field
        label="Trial package"
        htmlFor="trialPackageTemplateId"
        error={state.fieldErrors?.trialPackageTemplateId?.[0]}
      >
        <Select
          id="trialPackageTemplateId"
          name="trialPackageTemplateId"
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
            <div className="section-header">
              <div className="space-y-2">
              <p className="section-kicker">Included</p>
              <h3 className="font-display text-[1.35rem] leading-none tracking-[-0.04em] text-ink">
                {selectedTemplate.name}
              </h3>
            </div>
            <Badge tone="plum">{formatCurrency(selectedTemplate.price)}</Badge>
          </div>

          <div className="mt-4 space-y-2.5">
            {selectedTemplate.items.map((item) => (
              <div key={item.classTypeId} className="list-row-quiet">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink">{item.classTypeName}</p>
                  <p className="text-sm font-semibold text-muted">
                    {item.quantity} session{item.quantity === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {selectedTemplate.notes ? (
            <p className="mt-4 text-sm leading-6 text-muted">{selectedTemplate.notes}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Purchase date" htmlFor="purchaseDate" error={state.fieldErrors?.purchaseDate?.[0]}>
          <Input id="purchaseDate" name="purchaseDate" type="date" defaultValue={initialPurchaseDate} />
        </Field>

        <Field label="Amount paid" htmlFor="amountPaid" error={state.fieldErrors?.amountPaid?.[0]}>
          <Input
            id="amountPaid"
            name="amountPaid"
            type="number"
            step="0.01"
            defaultValue={selectedTemplate?.price ?? ""}
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
            Sell trial
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
