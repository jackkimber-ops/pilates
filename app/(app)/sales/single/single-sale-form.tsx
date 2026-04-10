"use client";

import { useActionState, useMemo, useState } from "react";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { sellSingleClassAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";

type SingleSaleFormProps = {
  redirectTo: string;
  initialCustomerId?: string;
  initialPurchaseDate: string;
  customers: Array<{ id: string; fullName: string }>;
  classTypes: Array<{
    id: string;
    name: string;
    category: "GROUP" | "PRIVATE";
    defaultSinglePrice: string;
  }>;
};

export function SingleSaleForm({
  redirectTo,
  initialCustomerId,
  initialPurchaseDate,
  customers,
  classTypes,
}: SingleSaleFormProps) {
  const [state, action] = useActionState(sellSingleClassAction, INITIAL_FORM_STATE);
  const [category, setCategory] = useState<"GROUP" | "PRIVATE">("GROUP");
  const [classTypeId, setClassTypeId] = useState(
    classTypes.find((classType) => classType.category === "GROUP")?.id ?? "",
  );

  const filteredClassTypes = useMemo(
    () => classTypes.filter((classType) => classType.category === category),
    [category, classTypes],
  );
  const selectedClassType = filteredClassTypes.find((classType) => classType.id === classTypeId);

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

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Category" error={state.fieldErrors?.category?.[0]}>
          <div className="segmented-control">
            {(["GROUP", "PRIVATE"] as const).map((value) => (
              <label
                key={value}
                className={`segmented-option ${category === value ? "segmented-option-active" : ""}`}
              >
                <input
                  type="radio"
                  name="category"
                  value={value}
                  checked={category === value}
                  onChange={(event) => {
                    const nextCategory = event.target.value as "GROUP" | "PRIVATE";
                    setCategory(nextCategory);
                    setClassTypeId(
                      classTypes.find((classType) => classType.category === nextCategory)?.id ?? "",
                    );
                  }}
                  className="sr-only"
                />
                {value === "GROUP" ? "Group" : "Private"}
              </label>
            ))}
          </div>
        </Field>

        <Field
          label="Specific class type"
          htmlFor="classTypeId"
          hint="Optional"
          error={state.fieldErrors?.classTypeId?.[0]}
        >
          <Select
            id="classTypeId"
            name="classTypeId"
            value={classTypeId}
            onChange={(event) => setClassTypeId(event.target.value)}
          >
            <option value="">Any matching {category.toLowerCase()} class</option>
            {filteredClassTypes.map((classType) => (
              <option key={classType.id} value={classType.id}>
                {classType.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

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
            defaultValue={selectedClassType?.defaultSinglePrice ?? ""}
            key={`${category}-${classTypeId}`}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Payment method" htmlFor="paymentMethod" error={state.fieldErrors?.paymentMethod?.[0]}>
          <Select id="paymentMethod" name="paymentMethod" defaultValue="PROMPTPAY">
            {PAYMENT_METHOD_OPTIONS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Expiry date"
          htmlFor="expiryDate"
          hint="Optional"
          error={state.fieldErrors?.expiryDate?.[0]}
        >
          <Input id="expiryDate" name="expiryDate" type="date" />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" error={state.fieldErrors?.notes?.[0]}>
        <Textarea id="notes" name="notes" placeholder="Optional note" />
      </Field>

      <div className="action-dock">
        <div className="action-dock-panel">
          <SubmitButton className="w-full md:w-auto" size="lg" pendingLabel="Saving...">
            Sell one-off
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
