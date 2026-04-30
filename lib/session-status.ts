export type SessionStatusValue = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type SessionTemporalState = "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export function getSessionTemporalState(
  session: {
    status: SessionStatusValue;
    startsAt: Date;
    endsAt: Date;
  },
  now = new Date(),
): SessionTemporalState {
  if (session.status === "CANCELLED") {
    return "CANCELLED";
  }

  if (session.status === "COMPLETED" || session.endsAt.getTime() <= now.getTime()) {
    return "COMPLETED";
  }

  if (session.startsAt.getTime() <= now.getTime()) {
    return "IN_PROGRESS";
  }

  return "UPCOMING";
}

export function getEffectiveSessionStatus(
  session: {
    status: SessionStatusValue;
    startsAt?: Date;
    endsAt: Date;
  },
  now = new Date(),
): SessionStatusValue {
  if (session.status !== "SCHEDULED") {
    return session.status;
  }

  return session.endsAt.getTime() <= now.getTime() ? "COMPLETED" : "SCHEDULED";
}
