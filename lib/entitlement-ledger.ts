import type {
  CreditHistoryType,
  CustomerPackageTransactionType,
  CustomerTrialPackageItemTransactionType,
  Prisma,
} from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

function getPackageHistoryType(eventType: CustomerPackageTransactionType): CreditHistoryType {
  if (eventType === "PACKAGE_SALE") {
    return "PACKAGE_PURCHASE";
  }

  if (eventType === "USAGE") {
    return "ATTENDED";
  }

  if (eventType === "RESTORE") {
    return "CANCELLED";
  }

  return "MANUAL_ADJUSTMENT";
}

function getTrialHistoryType(eventType: CustomerTrialPackageItemTransactionType): CreditHistoryType {
  if (eventType === "TRIAL_SALE") {
    return "PACKAGE_PURCHASE";
  }

  if (eventType === "USAGE") {
    return "ATTENDED";
  }

  if (eventType === "RESTORE") {
    return "CANCELLED";
  }

  return "MANUAL_ADJUSTMENT";
}

function getPackageHistoryNote(input: {
  eventType: CustomerPackageTransactionType;
  reason: string;
  notes?: string | null;
}) {
  if (input.eventType === "PACKAGE_SALE") {
    return input.notes ?? "Package purchased";
  }

  if (input.eventType === "IMPORTED_BALANCE") {
    return input.notes ?? "Imported balance";
  }

  if (input.eventType === "USAGE") {
    return input.notes ?? "Attended";
  }

  if (input.eventType === "RESTORE") {
    return input.notes ?? "Session cancelled";
  }

  return input.notes ?? input.reason;
}

function getTrialHistoryNote(input: {
  eventType: CustomerTrialPackageItemTransactionType;
  reason: string;
  notes?: string | null;
}) {
  if (input.eventType === "TRIAL_SALE") {
    return input.notes ?? "Trial package purchased";
  }

  if (input.eventType === "USAGE") {
    return input.notes ?? "Attended";
  }

  if (input.eventType === "RESTORE") {
    return input.notes ?? "Session cancelled";
  }

  return input.notes ?? input.reason;
}

export async function recordCustomerPackageTransaction(
  tx: TransactionClient,
  input: {
    customerPackageId: string;
    eventType: CustomerPackageTransactionType;
    deltaCredits: number;
    resultingCredits: number;
    reason: string;
    notes?: string | null;
    details?: Prisma.InputJsonValue;
    bookingId?: string | null;
    sessionId?: string | null;
    packageAdjustmentId?: string | null;
    createdByUserId?: string | null;
    createdAt?: Date;
  },
) {
  const transaction = await tx.customerPackageTransaction.create({
    data: {
      customerPackageId: input.customerPackageId,
      eventType: input.eventType,
      deltaCredits: input.deltaCredits,
      resultingCredits: input.resultingCredits,
      reason: input.reason,
      notes: input.notes ?? undefined,
      details: input.details,
      bookingId: input.bookingId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      packageAdjustmentId: input.packageAdjustmentId ?? undefined,
      createdByUserId: input.createdByUserId ?? undefined,
      createdAt: input.createdAt,
    },
  });

  if (input.deltaCredits !== 0) {
    const customerPackage = await tx.customerPackage.findUnique({
      where: {
        id: input.customerPackageId,
      },
      select: {
        customerId: true,
        classTypeId: true,
      },
    });

    if (customerPackage) {
      await tx.customerCreditHistory.create({
        data: {
          customerId: customerPackage.customerId,
          classTypeId: customerPackage.classTypeId,
          change: input.deltaCredits,
          type: getPackageHistoryType(input.eventType),
          note: getPackageHistoryNote(input),
          relatedSessionId: input.sessionId ?? undefined,
          relatedBookingId: input.bookingId ?? undefined,
          customerPackageTransactionId: transaction.id,
          createdAt: input.createdAt,
        },
      });
    }
  }

  return transaction;
}

export async function recordCustomerTrialItemTransaction(
  tx: TransactionClient,
  input: {
    customerTrialPackageItemId: string;
    eventType: CustomerTrialPackageItemTransactionType;
    deltaQuantity: number;
    resultingQuantity: number;
    reason: string;
    notes?: string | null;
    details?: Prisma.InputJsonValue;
    bookingId?: string | null;
    sessionId?: string | null;
    createdByUserId?: string | null;
    createdAt?: Date;
  },
) {
  const transaction = await tx.customerTrialPackageItemTransaction.create({
    data: {
      customerTrialPackageItemId: input.customerTrialPackageItemId,
      eventType: input.eventType,
      deltaQuantity: input.deltaQuantity,
      resultingQuantity: input.resultingQuantity,
      reason: input.reason,
      notes: input.notes ?? undefined,
      details: input.details,
      bookingId: input.bookingId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      createdByUserId: input.createdByUserId ?? undefined,
      createdAt: input.createdAt,
    },
  });

  if (input.deltaQuantity !== 0) {
    const trialItem = await tx.customerTrialPackageItem.findUnique({
      where: {
        id: input.customerTrialPackageItemId,
      },
      select: {
        classTypeId: true,
        customerTrialPackage: {
          select: {
            customerId: true,
          },
        },
      },
    });

    if (trialItem) {
      await tx.customerCreditHistory.create({
        data: {
          customerId: trialItem.customerTrialPackage.customerId,
          classTypeId: trialItem.classTypeId,
          change: input.deltaQuantity,
          type: getTrialHistoryType(input.eventType),
          note: getTrialHistoryNote(input),
          relatedSessionId: input.sessionId ?? undefined,
          relatedBookingId: input.bookingId ?? undefined,
          customerTrialPackageItemTransactionId: transaction.id,
          createdAt: input.createdAt,
        },
      });
    }
  }

  return transaction;
}
