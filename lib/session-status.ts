export type SessionStatusValue = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export function getEffectiveSessionStatus(
  session: {
    status: SessionStatusValue;
    endsAt: Date;
  },
  now = new Date(),
): SessionStatusValue {
  if (session.status !== "SCHEDULED") {
    return session.status;
  }

  return session.endsAt.getTime() <= now.getTime() ? "COMPLETED" : "SCHEDULED";
}
