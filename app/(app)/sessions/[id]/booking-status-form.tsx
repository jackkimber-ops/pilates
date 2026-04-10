"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Select } from "@/components/ui/input";
import { updateBookingStatusAction } from "@/app/(app)/actions";
import { INITIAL_FORM_STATE } from "@/lib/validation";

const STATUS_OPTIONS = ["BOOKED", "ATTENDED", "CANCELLED", "LATE_CANCEL", "NO_SHOW"] as const;

export function BookingStatusForm({
  bookingId,
  redirectTo,
  currentStatus,
}: {
  bookingId: string;
  redirectTo: string;
  currentStatus: string;
}) {
  const [state, action] = useActionState(updateBookingStatusAction, INITIAL_FORM_STATE);

  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <Select name="status" defaultValue={currentStatus} className="h-12">
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status.replaceAll("_", " ")}
          </option>
        ))}
      </Select>

      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>

      <SubmitButton className="w-full sm:w-auto" size="sm" variant="secondary" pendingLabel="Updating...">
        Update status
      </SubmitButton>
    </form>
  );
}
