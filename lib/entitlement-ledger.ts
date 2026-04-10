import type {
  CustomerPackageTransactionType,
  CustomerTrialPackageItemTransactionType,
  Prisma,
} from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

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
  return tx.customerPackageTransaction.create({
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
  return tx.customerTrialPackageItemTransaction.create({
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
}
