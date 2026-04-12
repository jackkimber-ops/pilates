import type { BookingStatus, PaymentMethod, PaymentSourceType, Weekday } from "@prisma/client";

export const APP_NAME = "Re:Form";
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Ho_Chi_Minh";
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Secure-reform_admin_session" : "reform_admin_session";
export const SESSION_DURATION_DAYS = 30;
export const CLASS_DURATION_MINUTES = 60;
export const LOW_CREDIT_THRESHOLD = 3;
export const DEFAULT_RECURRING_GENERATION_DAYS = 56;
export const DEFAULT_WEEKLY_RECURRING_OCCURRENCES = 10;
export const DEFAULT_REPORT_RANGE_DAYS = 30;

export const PAYMENT_METHOD_OPTIONS: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "PROMPTPAY", label: "QR transfer" },
  { value: "OTHER", label: "Other" },
];

export const PAYMENT_SOURCE_OPTIONS: {
  value: PaymentSourceType;
  label: string;
  description: string;
}[] = [
  {
    value: "PACKAGE",
    label: "Package",
    description: "Use a package.",
  },
  {
    value: "SINGLE",
    label: "One-off",
    description: "Use a one-off.",
  },
  {
    value: "TRIAL",
    label: "Trial",
    description: "Use a trial item.",
  },
  {
    value: "OVERRIDE",
    label: "Override",
    description: "No package or one-off.",
  },
];

export const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: "SUNDAY", label: "Sunday" },
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
];

export const STATUS_BADGE_STYLES: Record<string, string> = {
  ACTIVE: "bg-sage-soft/92 text-sage",
  INACTIVE: "bg-panel-muted/88 text-muted",
  BOOKED: "bg-accent-soft/88 text-accent-strong",
  ATTENDED: "bg-sage-soft/92 text-sage",
  CANCELLED: "bg-panel-muted/88 text-muted",
  LATE_CANCEL: "bg-warm-soft/92 text-warm",
  NO_SHOW: "bg-danger-soft/92 text-danger",
  UNUSED: "bg-accent-soft/88 text-accent-strong",
  USED: "bg-sage-soft/92 text-sage",
  EXPIRED: "bg-panel-muted/88 text-muted",
  SCHEDULED: "bg-accent-soft/88 text-accent-strong",
  COMPLETED: "bg-sage-soft/92 text-sage",
  GROUP: "bg-accent-soft/88 text-accent-strong",
  PRIVATE: "bg-warm-soft/92 text-warm",
  PACKAGE: "bg-sage-soft/92 text-sage",
  SINGLE: "bg-warm-soft/92 text-warm",
  TRIAL: "bg-accent-soft/88 text-accent-strong",
  OVERRIDE: "bg-panel-muted/88 text-muted",
};

export const PENALIZED_STATUSES = new Set<BookingStatus>(["ATTENDED", "LATE_CANCEL", "NO_SHOW"]);

export const ATTENDANCE_PENALTY_RULES = {
  ATTENDED: {
    PACKAGE: true,
    SINGLE: true,
    TRIAL: true,
  },
  LATE_CANCEL: {
    PACKAGE: true,
    SINGLE: true,
    TRIAL: true,
  },
  NO_SHOW: {
    PACKAGE: true,
    SINGLE: true,
    TRIAL: true,
  },
} as const satisfies Record<
  "ATTENDED" | "LATE_CANCEL" | "NO_SHOW",
  Record<"PACKAGE" | "SINGLE" | "TRIAL", boolean>
>;
