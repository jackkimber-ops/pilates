"use client";

import { SubmitButton } from "@/components/forms/submit-button";
import { restoreCancelledSessionUsageAction } from "@/app/(app)/actions";

export function RestoreSessionUsageForm({
  sessionId,
  redirectTo,
}: {
  sessionId: string;
  redirectTo: string;
}) {
  return (
    <form action={restoreCancelledSessionUsageAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <SubmitButton size="sm" variant="secondary" pendingLabel="Restoring...">
        Restore used credits
      </SubmitButton>
    </form>
  );
}
