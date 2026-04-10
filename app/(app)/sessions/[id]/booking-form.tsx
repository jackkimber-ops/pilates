"use client";

import { useActionState, useMemo, useState } from "react";
import { PAYMENT_SOURCE_OPTIONS } from "@/lib/constants";
import { FormMessage } from "@/components/forms/form-message";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Select, Textarea } from "@/components/ui/input";
import { createBookingAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";

type BookingFormProps = {
  sessionId: string;
  redirectTo: string;
  customers: Array<{ id: string; fullName: string }>;
  singlePurchaseOptions: Array<{
    id: string;
    customerId: string;
    label: string;
  }>;
  packageBalanceOptions: Array<{
    customerId: string;
    label: string;
  }>;
  trialPurchaseOptions: Array<{
    id: string;
    customerId: string;
    label: string;
  }>;
};

export function BookingForm({
  sessionId,
  redirectTo,
  customers,
  singlePurchaseOptions,
  packageBalanceOptions,
  trialPurchaseOptions,
}: BookingFormProps) {
  const [state, action] = useActionState(createBookingAction, INITIAL_FORM_STATE);
  const [paymentSourceType, setPaymentSourceType] = useState<"PACKAGE" | "SINGLE" | "TRIAL" | "OVERRIDE">("PACKAGE");
  const [customerId, setCustomerId] = useState("");

  const filteredSingleOptions = useMemo(
    () => singlePurchaseOptions.filter((option) => option.customerId === customerId),
    [customerId, singlePurchaseOptions],
  );
  const filteredPackageBalanceOptions = useMemo(
    () => packageBalanceOptions.filter((option) => option.customerId === customerId),
    [customerId, packageBalanceOptions],
  );
  const filteredTrialOptions = useMemo(
    () => trialPurchaseOptions.filter((option) => option.customerId === customerId),
    [customerId, trialPurchaseOptions],
  );
  const trialSelectionBlocked = paymentSourceType === "TRIAL" && customerId !== "" && filteredTrialOptions.length === 0;
  const packageSelectionBlocked =
    paymentSourceType === "PACKAGE" && customerId !== "" && filteredPackageBalanceOptions.length === 0;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <FormMessage state={state} />

      <Field label="Customer" htmlFor="booking-customer" error={state.fieldErrors?.customerId?.[0]}>
        <Select
          id="booking-customer"
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

      <Field label="Payment source" error={state.fieldErrors?.paymentSourceType?.[0]}>
        <div className="space-y-3">
          <div className="segmented-control">
            {PAYMENT_SOURCE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`segmented-option ${paymentSourceType === option.value ? "segmented-option-active" : ""}`}
              >
                <input
                  type="radio"
                  name="paymentSourceType"
                  value={option.value}
                  checked={paymentSourceType === option.value}
                  onChange={(event) =>
                    setPaymentSourceType(event.target.value as "PACKAGE" | "SINGLE" | "TRIAL" | "OVERRIDE")
                  }
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className="text-sm leading-6 text-muted">
            {paymentSourceType === "PACKAGE"
              ? filteredPackageBalanceOptions.length
                ? filteredPackageBalanceOptions[0]?.label
                : customerId
                  ? "No usable balance for this class."
                  : "Select a customer."
              : PAYMENT_SOURCE_OPTIONS.find((option) => option.value === paymentSourceType)?.description}
          </p>
        </div>
      </Field>

      {paymentSourceType === "SINGLE" ? (
        <Field
          label="One-off purchase"
          htmlFor="singleClassPurchaseId"
          error={state.fieldErrors?.singleClassPurchaseId?.[0]}
        >
          <Select id="singleClassPurchaseId" name="singleClassPurchaseId">
            <option value="">Select unused single purchase</option>
            {filteredSingleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {paymentSourceType === "TRIAL" ? (
        <Field
          label="Trial entitlement"
          htmlFor="customerTrialPackageItemId"
          error={state.fieldErrors?.customerTrialPackageItemId?.[0]}
        >
          <Select id="customerTrialPackageItemId" name="customerTrialPackageItemId">
            <option value="">Use earliest eligible trial entitlement</option>
            {filteredTrialOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="mt-2 text-sm leading-6 text-muted">
            {filteredTrialOptions.length
              ? "Exact class type only."
              : customerId
                ? "No trial item available."
                : "Select a customer."}
          </p>
        </Field>
      ) : null}

      <Field label="Notes" htmlFor="booking-notes" error={state.fieldErrors?.notes?.[0]}>
        <Textarea id="booking-notes" name="notes" placeholder="Optional note" />
      </Field>

      <div className="action-dock">
        <div className="action-dock-panel">
          <SubmitButton
            className="w-full"
            size="lg"
            pendingLabel="Adding..."
            disabled={trialSelectionBlocked || packageSelectionBlocked}
          >
            Add booking
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
