"use client";

import { SubmitButton } from "@/components/forms/submit-button";
import { restoreBookingUsageAction } from "@/app/(app)/actions";

export function RestoreBookingUsageForm({
  bookingId,
  redirectTo,
  targetStatus = "BOOKED",
}: {
  bookingId: string;
  redirectTo: string;
  targetStatus?: "BOOKED" | "CANCELLED";
}) {
  return (
    <form action={restoreBookingUsageAction}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="targetStatus" value={targetStatus} />
      <SubmitButton size="sm" variant="ghost" pendingLabel="Restoring...">
        Restore usage
      </SubmitButton>
    </form>
  );
}
