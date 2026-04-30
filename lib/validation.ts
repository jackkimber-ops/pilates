import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

const checkboxToBoolean = (value: unknown) => value === "on" || value === "true" || value === true;

const optionalString = (max = 5000) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().email("Enter a valid email.").optional(),
);

const requiredId = z.string().trim().min(1, "Select an option.");
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");
const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid time.");
const stringArray = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [value];
  }

  return [];
}, z.array(z.string().trim().min(1)));
const moneyNumber = z.coerce.number().min(0, "Enter an amount.");
const integerNumber = z.coerce.number().int("Enter a whole number.");
const signedIntegerNumber = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");
    return normalized;
  }

  return value;
}, z.coerce.number().int("Enter a whole number."));
const PACKAGE_VALIDITY_BY_SESSION_COUNT = new Map([
  [10, 3],
  [20, 6],
  [40, 12],
  [60, 24],
]);
const REAL_CLASS_TYPE_RULES = new Map([
  ["Private Reformer", { category: "PRIVATE" as const, maxCapacity: 1 }],
  ["Duo Reformer", { category: "PRIVATE" as const, maxCapacity: 2 }],
  ["Private Mat", { category: "PRIVATE" as const, maxCapacity: 1 }],
  ["Group Mat (Maximum 6)", { category: "GROUP" as const, maxCapacity: 6 }],
]);

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

const importedBalanceInputSchema = z
  .object({
    classTypeId: requiredId,
    remainingCredits: integerNumber.min(0, "Enter remaining sessions."),
    originalCredits: z.preprocess(emptyToUndefined, integerNumber.min(0, "Enter original sessions.").optional()),
    expiryDate: z.preprocess(emptyToUndefined, dateString.optional()),
    notes: optionalString(),
  })
  .superRefine((value, context) => {
    if (value.originalCredits !== undefined && value.originalCredits < value.remainingCredits) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["originalCredits"],
        message: "Original sessions cannot be lower than remaining sessions.",
      });
    }
  });

export const customerFormSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.string().optional()),
  fullName: z.string().trim().min(2, "Enter a customer name."),
  phone: optionalString(50),
  email: optionalEmail,
  notes: optionalString(),
  tags: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
      ),
  ),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  importedBalancesJson: z.preprocess(
    (value) => {
      const normalized = emptyToUndefined(value);

      if (normalized === undefined) {
        return [];
      }

      if (typeof normalized !== "string") {
        return normalized;
      }

      try {
        return JSON.parse(normalized);
      } catch {
        return normalized;
      }
    },
    z.array(importedBalanceInputSchema).default([]),
  ),
});

export const instructorFormSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.string().optional()),
  fullName: z.string().trim().min(2, "Enter an instructor name."),
  active: z.preprocess(checkboxToBoolean, z.boolean()),
});

export const classTypeFormSchema = z
  .object({
    id: z.preprocess(emptyToUndefined, z.string().optional()),
    name: z.string().trim().min(2, "Enter a class type name."),
    category: z.enum(["GROUP", "PRIVATE"]),
    durationMinutes: integerNumber.min(60).max(60),
    defaultSinglePrice: moneyNumber,
    maxCapacity: integerNumber.min(1).max(6),
    color: z
      .string()
      .trim()
      .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Enter a valid color."),
    active: z.preprocess(checkboxToBoolean, z.boolean()),
  })
  .superRefine((value, context) => {
    if (value.category === "PRIVATE" && value.maxCapacity > 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxCapacity"],
        message: "Private classes allow up to 2.",
      });
    }

    if (value.category === "GROUP" && value.maxCapacity > 6) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxCapacity"],
        message: "Group classes allow up to 6.",
      });
    }

    const realClassTypeRule = REAL_CLASS_TYPE_RULES.get(value.name);

    if (realClassTypeRule) {
      if (value.category !== realClassTypeRule.category) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["category"],
          message: `${value.name} must stay ${realClassTypeRule.category.toLowerCase()}.`,
        });
      }

      if (value.maxCapacity !== realClassTypeRule.maxCapacity) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maxCapacity"],
          message: `${value.name} must keep a capacity of ${realClassTypeRule.maxCapacity}.`,
        });
      }
    }
  });

export const packageTemplateFormSchema = z
  .object({
    id: z.preprocess(emptyToUndefined, z.string().optional()),
    name: z.string().trim().min(2, "Enter a package name."),
    classTypeId: requiredId,
    sessionCount: integerNumber.refine(
      (value) => PACKAGE_VALIDITY_BY_SESSION_COUNT.has(value),
      "Use 10, 20, 40, or 60.",
    ),
    validityMonths: integerNumber.min(1, "Enter validity."),
    regularPrice: moneyNumber,
    packagePrice: moneyNumber,
    active: z.preprocess(checkboxToBoolean, z.boolean()),
  })
  .superRefine((value, context) => {
    const expectedValidityMonths = PACKAGE_VALIDITY_BY_SESSION_COUNT.get(value.sessionCount);

    if (expectedValidityMonths && value.validityMonths !== expectedValidityMonths) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validityMonths"],
        message: `${value.sessionCount} sessions = ${expectedValidityMonths} months.`,
      });
    }

    if (value.packagePrice > value.regularPrice) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["packagePrice"],
        message: "Package price cannot exceed regular price.",
      });
    }
  });

export const sellPackageSchema = z.object({
  customerId: requiredId,
  packageTemplateId: requiredId,
  purchaseDate: dateString,
  amountPaid: moneyNumber,
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "PROMPTPAY", "OTHER"]),
  notes: optionalString(),
});

export const sellSingleClassSchema = z.object({
  customerId: requiredId,
  category: z.enum(["GROUP", "PRIVATE"]),
  classTypeId: z.preprocess(emptyToUndefined, z.string().optional()),
  purchaseDate: dateString,
  amountPaid: moneyNumber,
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "PROMPTPAY", "OTHER"]),
  expiryDate: z.preprocess(emptyToUndefined, dateString.optional()),
  notes: optionalString(),
});

export const sellTrialPackageSchema = z.object({
  customerId: requiredId,
  trialPackageTemplateId: requiredId,
  purchaseDate: dateString,
  amountPaid: moneyNumber,
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "PROMPTPAY", "OTHER"]),
  notes: optionalString(),
});

export const importedBalanceSchema = z
  .object({
    customerId: requiredId,
    classTypeId: requiredId,
    remainingCredits: integerNumber.min(0, "Enter remaining sessions."),
    originalCredits: z.preprocess(emptyToUndefined, integerNumber.min(0, "Enter original sessions.").optional()),
    expiryDate: z.preprocess(emptyToUndefined, dateString.optional()),
    notes: optionalString(),
  })
  .superRefine((value, context) => {
    if (value.originalCredits !== undefined && value.originalCredits < value.remainingCredits) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["originalCredits"],
        message: "Original sessions cannot be lower than remaining sessions.",
      });
    }
  });

export const sessionFormSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.string().optional()),
  classTypeId: requiredId,
  instructorId: requiredId,
  customerId: z.preprocess(emptyToUndefined, z.string().optional()),
  customerIds: stringArray.default([]),
  title: z.string().trim().min(2, "Enter a title."),
  date: dateString,
  startTime: timeString,
  capacity: integerNumber.min(1).max(6),
  notes: optionalString(),
  syncToGoogle: z.preprocess(checkboxToBoolean, z.boolean()),
  recurringWeekly: z.preprocess(checkboxToBoolean, z.boolean()).default(false),
});

export const bookingFormSchema = z.object({
  sessionId: requiredId,
  customerId: requiredId,
  paymentSourceType: z.enum(["PACKAGE", "SINGLE", "TRIAL", "OVERRIDE"]),
  singleClassPurchaseId: z.preprocess(emptyToUndefined, z.string().optional()),
  customerTrialPackageItemId: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: optionalString(),
});

export const bookingStatusSchema = z.object({
  bookingId: requiredId,
  status: z.enum(["BOOKED", "ATTENDED", "CANCELLED", "LATE_CANCEL", "NO_SHOW"]),
  notes: optionalString(),
});

export const packageAdjustmentSchema = z.object({
  customerPackageId: requiredId,
  deltaCredits: signedIntegerNumber.refine((value) => value !== 0, "Enter a credit change."),
  reason: z.string().trim().min(3, "Enter a reason."),
  notes: optionalString(),
});

export const recurringRuleSchema = z.object({
  customerId: requiredId,
  classTypeId: requiredId,
  instructorId: z.preprocess(emptyToUndefined, z.string().optional()),
  dayOfWeek: z.enum([
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ]),
  startTime: timeString,
  startDate: dateString,
  endDate: z.preprocess(emptyToUndefined, dateString.optional()),
  active: z.preprocess(checkboxToBoolean, z.boolean()),
  paymentSourceType: z.enum(["PACKAGE", "SINGLE", "TRIAL", "OVERRIDE"]).default("PACKAGE"),
  notes: optionalString(),
});

export const recurringGenerationSchema = z.object({
  ruleId: requiredId,
  startDate: dateString,
  endDate: dateString,
});

export const reportRangeSchema = z.object({
  start: dateString,
  end: dateString,
});

export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  entityId?: string;
};

export const INITIAL_FORM_STATE: FormState = {};

export function fromZodError(error: z.ZodError): FormState {
  return {
    ok: false,
    message: "Check the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors,
  };
}
