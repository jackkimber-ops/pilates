import {
  BookingStatus,
  ClassCategory,
  CustomerPackageSourceType,
  CustomerPackageTransactionType,
  CustomerTrialPackageItemTransactionType,
  PaymentSourceType,
  Prisma,
  SessionStatus,
  SingleClassPurchaseStatus,
} from "@prisma/client";
import { ATTENDANCE_PENALTY_RULES } from "@/lib/constants";
import { getNow } from "@/lib/date";
import { logAudit } from "@/lib/audit";
import { recordCustomerPackageTransaction, recordCustomerTrialItemTransaction } from "@/lib/entitlement-ledger";
import { prisma } from "@/lib/prisma";

type TransactionClient = Prisma.TransactionClient;

type SessionWithRelations = Prisma.SessionGetPayload<{
  include: {
    classType: true;
    bookings: true;
  };
}>;

type TrialPackageItemWithRelations = Prisma.CustomerTrialPackageItemGetPayload<{
  include: {
    classType: true;
    customerTrialPackage: {
      include: {
        trialPackageTemplate: true;
      };
    };
    bookings: {
      where: {
        status: {
          not: "CANCELLED";
        };
      };
      select: {
        id: true;
        trialUseConsumed: true;
      };
    };
  };
}>;

const BOOKING_STATUS_LOCK_NAMESPACE = 51_001;
const BOOKING_CREATION_LOCK_NAMESPACE = 51_002;
const PACKAGE_DEDUCTION_LOCK_NAMESPACE = 51_003;
const SINGLE_SELECTION_LOCK_NAMESPACE = 51_004;
const TRIAL_SELECTION_LOCK_NAMESPACE = 51_005;
const BOOKING_TX_MAX_WAIT_MS = 10_000;
const BOOKING_TX_TIMEOUT_MS = 20_000;

function advisoryLockKey(value: string) {
  let hash = 0;

  for (const char of value) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }

  return hash;
}

async function lockResource(tx: TransactionClient, namespace: number, value: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(CAST(${namespace} AS int4), CAST(${advisoryLockKey(value)} AS int4))`;
}

function isTransactionNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";

  return message.toLowerCase().includes("transaction not found");
}

function shouldPenalize(status: BookingStatus, source: PaymentSourceType) {
  if (source === "OVERRIDE") {
    return false;
  }

  if (status === "ATTENDED") {
    return true;
  }

  if (status === "LATE_CANCEL" || status === "NO_SHOW") {
    return ATTENDANCE_PENALTY_RULES[status][source];
  }

  return false;
}

function singlePurchaseExpired(expiryDate: Date | null) {
  return Boolean(expiryDate && expiryDate < getNow());
}

function getTrialReservationCount(item: TrialPackageItemWithRelations) {
  return item.bookings.filter((booking) => !booking.trialUseConsumed).length;
}

async function getSessionForBooking(tx: TransactionClient, sessionId: string) {
  const session = await tx.session.findUnique({
    where: { id: sessionId },
    include: {
      classType: true,
      bookings: true,
    },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  return session;
}

export async function findEligibleCustomerPackages(
  tx: TransactionClient,
  customerId: string,
  classTypeId: string,
  atDate: Date,
) {
  const packages = await tx.customerPackage.findMany({
    where: {
      customerId,
      active: true,
      remainingCredits: {
        gt: 0,
      },
      classTypeId,
      OR: [{ expiryDate: null }, { expiryDate: { gte: atDate } }],
    },
  });

  return packages.sort((left, right) => {
    const leftExpiry = left.expiryDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightExpiry = right.expiryDate?.getTime() ?? Number.POSITIVE_INFINITY;

    if (leftExpiry !== rightExpiry) {
      return leftExpiry - rightExpiry;
    }

    if (left.sourceType !== right.sourceType) {
      return left.sourceType === CustomerPackageSourceType.IMPORTED ? -1 : 1;
    }

    const purchaseDelta = left.purchaseDate.getTime() - right.purchaseDate.getTime();
    if (purchaseDelta !== 0) {
      return purchaseDelta;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

export async function findEligibleSinglePurchases(
  tx: TransactionClient,
  customerId: string,
  category: ClassCategory,
  classTypeId: string,
  atDate: Date,
) {
  const purchases = await tx.singleClassPurchase.findMany({
    where: {
      customerId,
      category,
      status: SingleClassPurchaseStatus.UNUSED,
      AND: [
        {
          OR: [{ expiryDate: null }, { expiryDate: { gte: atDate } }],
        },
        {
          OR: [{ classTypeId: null }, { classTypeId }],
        },
      ],
    },
    orderBy: [{ expiryDate: "asc" }, { purchaseDate: "asc" }, { createdAt: "asc" }],
  });

  const activeReservations = await tx.booking.findMany({
    where: {
      singleClassPurchaseId: {
        in: purchases.map((purchase) => purchase.id),
      },
      status: {
        not: BookingStatus.CANCELLED,
      },
    },
    select: {
      singleClassPurchaseId: true,
    },
  });

  const reservedIds = new Set(
    activeReservations
      .map((reservation) => reservation.singleClassPurchaseId)
      .filter((value): value is string => Boolean(value)),
  );

  return purchases.filter((purchase) => !reservedIds.has(purchase.id));
}

export async function findEligibleTrialPackageItems(
  tx: TransactionClient,
  customerId: string,
  classTypeId: string,
) {
  const items = await tx.customerTrialPackageItem.findMany({
    where: {
      classTypeId,
      remainingQuantity: {
        gt: 0,
      },
      customerTrialPackage: {
        customerId,
        active: true,
      },
    },
    include: {
      classType: true,
      customerTrialPackage: {
        include: {
          trialPackageTemplate: true,
        },
      },
      bookings: {
        where: {
          status: {
            not: BookingStatus.CANCELLED,
          },
        },
        select: {
          id: true,
          trialUseConsumed: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return items
    .filter((item) => item.remainingQuantity - getTrialReservationCount(item) > 0)
    .sort((left, right) => {
      const purchaseDelta =
        left.customerTrialPackage.purchaseDate.getTime() - right.customerTrialPackage.purchaseDate.getTime();

      if (purchaseDelta !== 0) {
        return purchaseDelta;
      }

      const packageDelta =
        left.customerTrialPackage.createdAt.getTime() - right.customerTrialPackage.createdAt.getTime();

      if (packageDelta !== 0) {
        return packageDelta;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });
}

function getActiveBookingCount(session: SessionWithRelations) {
  return session.bookings.filter((booking) => booking.status !== BookingStatus.CANCELLED).length;
}

async function ensureCapacityAvailable(session: SessionWithRelations) {
  if (getActiveBookingCount(session) >= session.capacity) {
    throw new Error("Class is full.");
  }
}

async function ensurePackageAvailability(
  tx: TransactionClient,
  customerId: string,
  classTypeId: string,
  sessionDate: Date,
) {
  const eligiblePackages = await findEligibleCustomerPackages(tx, customerId, classTypeId, sessionDate);

  if (!eligiblePackages.length) {
    throw new Error("No valid package for this class.");
  }
}

async function ensureSingleAvailability(
  tx: TransactionClient,
  input: {
    customerId: string;
    category: ClassCategory;
    classTypeId: string;
    sessionDate: Date;
    singleClassPurchaseId?: string;
  },
) {
  const eligibleSingles = await findEligibleSinglePurchases(
    tx,
    input.customerId,
    input.category,
    input.classTypeId,
    input.sessionDate,
  );

  const matchingSingle =
    eligibleSingles.find((purchase) => purchase.id === input.singleClassPurchaseId) ??
    (input.singleClassPurchaseId ? null : eligibleSingles[0]);

  if (!matchingSingle) {
    throw new Error("No one-off available.");
  }

  return matchingSingle;
}

async function ensureTrialAvailability(
  tx: TransactionClient,
  input: {
    customerId: string;
    classTypeId: string;
    customerTrialPackageItemId?: string;
  },
) {
  const eligibleItems = await findEligibleTrialPackageItems(tx, input.customerId, input.classTypeId);

  const matchingItem =
    eligibleItems.find((item) => item.id === input.customerTrialPackageItemId) ??
    (input.customerTrialPackageItemId ? null : eligibleItems[0]);

  if (!matchingItem) {
    throw new Error("No trial item for this class.");
  }

  return matchingItem;
}

async function deductPackageCredit(tx: TransactionClient, bookingId: string, userId?: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: {
        include: {
          classType: true,
        },
      },
      customerPackage: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found.");
  }

  if (booking.creditDeducted) {
    return booking;
  }

  await lockResource(
    tx,
    PACKAGE_DEDUCTION_LOCK_NAMESPACE,
    `${booking.customerId}:${booking.session.classTypeId}`,
  );

  const eligiblePackages = await findEligibleCustomerPackages(
    tx,
    booking.customerId,
    booking.session.classTypeId,
    booking.session.startsAt,
  );

  const packagesToTry = booking.customerPackageId
    ? [
        ...eligiblePackages.filter((item) => item.id === booking.customerPackageId),
        ...eligiblePackages.filter((item) => item.id !== booking.customerPackageId),
      ]
    : eligiblePackages;

  for (const packageToUse of packagesToTry) {
    const deduction = await tx.customerPackage.updateMany({
      where: {
        id: packageToUse.id,
        active: true,
        remainingCredits: {
          gt: 0,
        },
        OR: [{ expiryDate: null }, { expiryDate: { gte: booking.session.startsAt } }],
      },
      data: {
        remainingCredits: {
          decrement: 1,
        },
      },
    });

    if (deduction.count > 0) {
      const updatedPackage = await tx.customerPackage.findUnique({
        where: { id: packageToUse.id },
      });

      if (!updatedPackage) {
        throw new Error("Package not found after deduction.");
      }

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          creditDeducted: true,
          customerPackageId: packageToUse.id,
          restoredAt: null,
          reversedByUserId: null,
        },
      });

      await recordCustomerPackageTransaction(tx, {
        customerPackageId: packageToUse.id,
        eventType: CustomerPackageTransactionType.USAGE,
        deltaCredits: -1,
        resultingCredits: updatedPackage.remainingCredits,
        reason: "Attendance deduction",
        notes: booking.session.title,
        bookingId: updatedBooking.id,
        sessionId: booking.sessionId,
        createdByUserId: userId,
        details: {
          paymentSourceType: booking.paymentSourceType,
          sessionStartsAt: booking.session.startsAt.toISOString(),
          classTypeId: booking.session.classTypeId,
        },
      });

      return updatedBooking;
    }
  }

  throw new Error("No package credits left.");
}

async function reversePackageCredit(tx: TransactionClient, bookingId: string, userId?: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: {
        include: {
          classType: true,
        },
      },
      customerPackage: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found.");
  }

  if (!booking.creditDeducted || !booking.customerPackageId) {
    return booking;
  }

  const updatedPackage = await tx.customerPackage.update({
    where: { id: booking.customerPackageId },
    data: {
      remainingCredits: {
        increment: 1,
      },
    },
  });

  const updatedBooking = await tx.booking.update({
    where: { id: bookingId },
    data: {
      creditDeducted: false,
    },
  });

  await recordCustomerPackageTransaction(tx, {
    customerPackageId: booking.customerPackageId,
    eventType: CustomerPackageTransactionType.RESTORE,
    deltaCredits: 1,
    resultingCredits: updatedPackage.remainingCredits,
    reason: "Usage restored",
    notes: booking.session.title,
    bookingId: booking.id,
    sessionId: booking.sessionId,
    createdByUserId: userId,
    details: {
      paymentSourceType: booking.paymentSourceType,
      sessionStartsAt: booking.session.startsAt.toISOString(),
      classTypeId: booking.session.classTypeId,
      restoredFromStatus: booking.status,
    },
  });

  return updatedBooking;
}

async function consumeSinglePurchase(tx: TransactionClient, bookingId: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: {
        include: {
          classType: true,
        },
      },
      singleClassPurchase: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found.");
  }

  if (booking.singleUseConsumed) {
    return booking;
  }

  await lockResource(
    tx,
    SINGLE_SELECTION_LOCK_NAMESPACE,
    `${booking.customerId}:${booking.session.classType.category}:${booking.session.classTypeId}`,
  );

  const selectedPurchase =
    booking.singleClassPurchase ??
    (await ensureSingleAvailability(tx, {
      customerId: booking.customerId,
      category: booking.session.classType.category,
      classTypeId: booking.session.classTypeId,
      sessionDate: booking.session.startsAt,
    }));

  if (selectedPurchase.status !== SingleClassPurchaseStatus.UNUSED) {
    throw new Error("One-off is no longer available.");
  }

  if (singlePurchaseExpired(selectedPurchase.expiryDate)) {
    throw new Error("One-off has expired.");
  }

  const consumption = await tx.singleClassPurchase.updateMany({
    where: {
      id: selectedPurchase.id,
      status: SingleClassPurchaseStatus.UNUSED,
    },
    data: {
      status: SingleClassPurchaseStatus.USED,
    },
  });

  if (consumption.count === 0) {
    throw new Error("One-off is no longer available.");
  }

  return tx.booking.update({
    where: { id: bookingId },
    data: {
      singleClassPurchaseId: selectedPurchase.id,
      singleUseConsumed: true,
      restoredAt: null,
      reversedByUserId: null,
    },
  });
}

async function reverseSingleConsumption(tx: TransactionClient, bookingId: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      singleClassPurchase: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found.");
  }

  if (!booking.singleUseConsumed || !booking.singleClassPurchase) {
    return booking;
  }

  await tx.singleClassPurchase.update({
    where: { id: booking.singleClassPurchase.id },
    data: {
      status: singlePurchaseExpired(booking.singleClassPurchase.expiryDate)
        ? SingleClassPurchaseStatus.EXPIRED
        : SingleClassPurchaseStatus.UNUSED,
    },
  });

  return tx.booking.update({
    where: { id: bookingId },
    data: {
      singleUseConsumed: false,
    },
  });
}

async function consumeTrialUsage(tx: TransactionClient, bookingId: string, userId?: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: true,
      customerTrialPackageItem: {
        include: {
          classType: true,
          customerTrialPackage: {
            include: {
              trialPackageTemplate: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    throw new Error("Booking not found.");
  }

  if (booking.trialUseConsumed) {
    return booking;
  }

  await lockResource(
    tx,
    TRIAL_SELECTION_LOCK_NAMESPACE,
    `${booking.customerId}:${booking.session.classTypeId}`,
  );

  const selectedItem =
    booking.customerTrialPackageItem ??
    (await ensureTrialAvailability(tx, {
      customerId: booking.customerId,
      classTypeId: booking.session.classTypeId,
    }));

  if (selectedItem.classTypeId !== booking.session.classTypeId) {
    throw new Error("Trial item does not match this class.");
  }

  const consumption = await tx.customerTrialPackageItem.updateMany({
    where: {
      id: selectedItem.id,
      classTypeId: booking.session.classTypeId,
      remainingQuantity: {
        gt: 0,
      },
      customerTrialPackage: {
        customerId: booking.customerId,
        active: true,
      },
    },
    data: {
      remainingQuantity: {
        decrement: 1,
      },
    },
  });

  if (consumption.count === 0) {
    throw new Error("Trial item is no longer available.");
  }

  const updatedItem = await tx.customerTrialPackageItem.findUnique({
    where: { id: selectedItem.id },
  });

  if (!updatedItem) {
    throw new Error("Trial item not found after deduction.");
  }

  const updatedBooking = await tx.booking.update({
    where: { id: bookingId },
    data: {
      customerTrialPackageId: selectedItem.customerTrialPackageId,
      customerTrialPackageItemId: selectedItem.id,
      trialUseConsumed: true,
      restoredAt: null,
      reversedByUserId: null,
    },
  });

  await recordCustomerTrialItemTransaction(tx, {
    customerTrialPackageItemId: selectedItem.id,
    eventType: CustomerTrialPackageItemTransactionType.USAGE,
    deltaQuantity: -1,
    resultingQuantity: updatedItem.remainingQuantity,
    reason: "Attendance deduction",
    notes: booking.session.title,
    bookingId: updatedBooking.id,
    sessionId: booking.sessionId,
    createdByUserId: userId,
    details: {
      paymentSourceType: booking.paymentSourceType,
      sessionStartsAt: booking.session.startsAt.toISOString(),
      classTypeId: booking.session.classTypeId,
    },
  });

  return updatedBooking;
}

async function reverseTrialConsumption(tx: TransactionClient, bookingId: string, userId?: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new Error("Booking not found.");
  }

  if (!booking.trialUseConsumed || !booking.customerTrialPackageItemId) {
    return booking;
  }

  const bookingWithSession = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      session: true,
    },
  });

  if (!bookingWithSession) {
    throw new Error("Booking not found.");
  }

  const updatedItem = await tx.customerTrialPackageItem.update({
    where: { id: booking.customerTrialPackageItemId },
    data: {
      remainingQuantity: {
        increment: 1,
      },
    },
  });

  const updatedBooking = await tx.booking.update({
    where: { id: bookingId },
    data: {
      trialUseConsumed: false,
    },
  });

  await recordCustomerTrialItemTransaction(tx, {
    customerTrialPackageItemId: booking.customerTrialPackageItemId,
    eventType: CustomerTrialPackageItemTransactionType.RESTORE,
    deltaQuantity: 1,
    resultingQuantity: updatedItem.remainingQuantity,
    reason: "Usage restored",
    notes: bookingWithSession.session.title,
    bookingId: booking.id,
    sessionId: booking.sessionId,
    createdByUserId: userId,
    details: {
      paymentSourceType: booking.paymentSourceType,
      sessionStartsAt: bookingWithSession.session.startsAt.toISOString(),
      classTypeId: bookingWithSession.session.classTypeId,
      restoredFromStatus: booking.status,
    },
  });

  return updatedBooking;
}

export async function createBooking(input: {
  sessionId: string;
  customerId: string;
  paymentSourceType: PaymentSourceType;
  singleClassPurchaseId?: string;
  customerTrialPackageItemId?: string;
  notes?: string;
  recurringBookingRuleId?: string;
  skipEntitlementValidation?: boolean;
  deductPackageOnCreate?: boolean;
  userId?: string;
}) {
  const createBookingTransaction = () =>
    prisma.$transaction(async (tx) => {
      await lockResource(tx, BOOKING_CREATION_LOCK_NAMESPACE, input.sessionId);

      const session = await getSessionForBooking(tx, input.sessionId);

      if (session.status === "CANCELLED") {
        throw new Error("Session is cancelled.");
      }

      const existingBooking = await tx.booking.findUnique({
        where: {
          sessionId_customerId: {
            sessionId: input.sessionId,
            customerId: input.customerId,
          },
        },
      });

      if (existingBooking) {
        throw new Error("Customer already booked.");
      }

      await ensureCapacityAvailable(session);

      if (!input.skipEntitlementValidation) {
        if (input.paymentSourceType === "PACKAGE") {
          await ensurePackageAvailability(
            tx,
            input.customerId,
            session.classTypeId,
            session.startsAt,
          );
        }

        if (input.paymentSourceType === "SINGLE") {
          await lockResource(
            tx,
            SINGLE_SELECTION_LOCK_NAMESPACE,
            `${input.customerId}:${session.classType.category}:${session.classTypeId}`,
          );

          const eligibleSingle = await ensureSingleAvailability(tx, {
            customerId: input.customerId,
            category: session.classType.category,
            classTypeId: session.classTypeId,
            sessionDate: session.startsAt,
            singleClassPurchaseId: input.singleClassPurchaseId,
          });

          return tx.booking.create({
            data: {
              sessionId: input.sessionId,
              customerId: input.customerId,
              paymentSourceType: input.paymentSourceType,
              singleClassPurchaseId: eligibleSingle.id,
              notes: input.notes,
              recurringBookingRuleId: input.recurringBookingRuleId,
            },
          });
        }

        if (input.paymentSourceType === "TRIAL") {
          await lockResource(
            tx,
            TRIAL_SELECTION_LOCK_NAMESPACE,
            `${input.customerId}:${session.classTypeId}`,
          );

          const eligibleTrialItem = await ensureTrialAvailability(tx, {
            customerId: input.customerId,
            classTypeId: session.classTypeId,
            customerTrialPackageItemId: input.customerTrialPackageItemId,
          });

          return tx.booking.create({
            data: {
              sessionId: input.sessionId,
              customerId: input.customerId,
              paymentSourceType: input.paymentSourceType,
              customerTrialPackageId: eligibleTrialItem.customerTrialPackageId,
              customerTrialPackageItemId: eligibleTrialItem.id,
              notes: input.notes,
              recurringBookingRuleId: input.recurringBookingRuleId,
            },
          });
        }
      }

      const createdBooking = await tx.booking.create({
        data: {
          sessionId: input.sessionId,
          customerId: input.customerId,
          paymentSourceType: input.paymentSourceType,
          singleClassPurchaseId:
            input.paymentSourceType === "SINGLE" ? input.singleClassPurchaseId : undefined,
          customerTrialPackageItemId:
            input.paymentSourceType === "TRIAL" ? input.customerTrialPackageItemId : undefined,
          notes: input.notes,
          recurringBookingRuleId: input.recurringBookingRuleId,
        },
      });

      if (input.paymentSourceType === "PACKAGE" && input.deductPackageOnCreate) {
        return deductPackageCredit(tx, createdBooking.id, input.userId);
      }

      return createdBooking;
    },
    {
      maxWait: BOOKING_TX_MAX_WAIT_MS,
      timeout: BOOKING_TX_TIMEOUT_MS,
    });

  let booking;
  try {
    booking = await createBookingTransaction();
  } catch (error) {
    if (!isTransactionNotFoundError(error)) {
      throw error;
    }

    booking = await createBookingTransaction();
  }

  await logAudit({
    userId: input.userId,
    entityType: "Booking",
    entityId: booking.id,
    action: "CREATE_BOOKING",
    details: {
      sessionId: input.sessionId,
      customerId: input.customerId,
      paymentSourceType: input.paymentSourceType,
      recurringBookingRuleId: input.recurringBookingRuleId,
    },
  });

  return booking;
}

export async function reverseBookingUsage(input: {
  bookingId: string;
  targetStatus?: BookingStatus;
  notes?: string;
  userId?: string;
}) {
  const targetStatus = input.targetStatus ?? BookingStatus.BOOKED;

  if (shouldPenalize(targetStatus, PaymentSourceType.PACKAGE)) {
    throw new Error("Choose a non-penalized status when restoring usage.");
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockResource(tx, BOOKING_STATUS_LOCK_NAMESPACE, input.bookingId);

    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found.");
    }

    const restoredSources: PaymentSourceType[] = [];

    if (booking.creditDeducted) {
      await reversePackageCredit(tx, booking.id, input.userId);
      restoredSources.push(PaymentSourceType.PACKAGE);
    }

    if (booking.singleUseConsumed) {
      await reverseSingleConsumption(tx, booking.id);
      restoredSources.push(PaymentSourceType.SINGLE);
    }

    if (booking.trialUseConsumed) {
      await reverseTrialConsumption(tx, booking.id, input.userId);
      restoredSources.push(PaymentSourceType.TRIAL);
    }

    if (!restoredSources.length) {
      throw new Error("Nothing to restore.");
    }

    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: targetStatus,
        notes: input.notes ?? booking.notes,
        restoredAt: getNow(),
        reversedByUserId: input.userId ?? null,
      },
    });

    return {
      booking: updatedBooking,
      restoredSources,
    };
  },
  {
    maxWait: BOOKING_TX_MAX_WAIT_MS,
    timeout: BOOKING_TX_TIMEOUT_MS,
  });

  await logAudit({
    userId: input.userId,
    entityType: "Booking",
    entityId: result.booking.id,
    action: "RESTORE_BOOKING_USAGE",
    details: {
      status: result.booking.status,
      restoredSources: result.restoredSources,
    },
  });

  return result.booking;
}

export async function removeBooking(input: { bookingId: string; userId?: string }) {
  const result = await prisma.$transaction(async (tx) => {
    await lockResource(tx, BOOKING_STATUS_LOCK_NAMESPACE, input.bookingId);

    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found.");
    }

    const restoredSources: PaymentSourceType[] = [];

    if (booking.creditDeducted) {
      await reversePackageCredit(tx, booking.id, input.userId);
      restoredSources.push(PaymentSourceType.PACKAGE);
    }

    if (booking.singleUseConsumed) {
      await reverseSingleConsumption(tx, booking.id);
      restoredSources.push(PaymentSourceType.SINGLE);
    }

    if (booking.trialUseConsumed) {
      await reverseTrialConsumption(tx, booking.id, input.userId);
      restoredSources.push(PaymentSourceType.TRIAL);
    }

    await tx.booking.delete({
      where: { id: booking.id },
    });

    return {
      booking,
      restoredSources,
    };
  },
  {
    maxWait: BOOKING_TX_MAX_WAIT_MS,
    timeout: BOOKING_TX_TIMEOUT_MS,
  });

  await logAudit({
    userId: input.userId,
    entityType: "Booking",
    entityId: result.booking.id,
    action: "REMOVE_BOOKING",
    details: {
      sessionId: result.booking.sessionId,
      customerId: result.booking.customerId,
      paymentSourceType: result.booking.paymentSourceType,
      restoredSources: result.restoredSources,
    },
  });

  return result.booking;
}

export async function updateBookingStatus(input: {
  bookingId: string;
  status: BookingStatus;
  notes?: string;
  skipRestore?: boolean;
  source?: "MANUAL" | "AUTO_ATTENDANCE";
  userId?: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    await lockResource(tx, BOOKING_STATUS_LOCK_NAMESPACE, input.bookingId);

    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      include: {
        session: {
          include: {
            classType: true,
          },
        },
      },
    });

    if (!booking) {
      throw new Error("Booking not found.");
    }

    const previouslyPenalized = shouldPenalize(booking.status, booking.paymentSourceType);
    const nextPenalized = shouldPenalize(input.status, booking.paymentSourceType);
    const hasConsumedPackage = booking.paymentSourceType === "PACKAGE" && booking.creditDeducted;
    const hasConsumedSingle = booking.paymentSourceType === "SINGLE" && booking.singleUseConsumed;
    const hasConsumedTrial = booking.paymentSourceType === "TRIAL" && booking.trialUseConsumed;
    const restoredSources: PaymentSourceType[] = [];

    let workingBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: input.status,
        notes: input.notes ?? booking.notes,
      },
    });

    if (!previouslyPenalized && nextPenalized) {
      if (booking.paymentSourceType === "PACKAGE") {
        workingBooking = await deductPackageCredit(tx, booking.id, input.userId);
      }

      if (booking.paymentSourceType === "SINGLE") {
        workingBooking = await consumeSinglePurchase(tx, booking.id);
      }

      if (booking.paymentSourceType === "TRIAL") {
        workingBooking = await consumeTrialUsage(tx, booking.id, input.userId);
      }
    }

    if (
      !input.skipRestore &&
      (previouslyPenalized || hasConsumedPackage || hasConsumedSingle || hasConsumedTrial) &&
      !nextPenalized
    ) {
      if (hasConsumedPackage) {
        workingBooking = await reversePackageCredit(tx, booking.id, input.userId);
        restoredSources.push(PaymentSourceType.PACKAGE);
      }

      if (hasConsumedSingle) {
        workingBooking = await reverseSingleConsumption(tx, booking.id);
        restoredSources.push(PaymentSourceType.SINGLE);
      }

      if (hasConsumedTrial) {
        workingBooking = await reverseTrialConsumption(tx, booking.id, input.userId);
        restoredSources.push(PaymentSourceType.TRIAL);
      }

      workingBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: input.status,
          notes: input.notes ?? booking.notes,
          restoredAt: getNow(),
          reversedByUserId: input.userId ?? null,
        },
      });
    }

    return {
      booking: workingBooking,
      restoredSources,
    };
  },
  {
    maxWait: BOOKING_TX_MAX_WAIT_MS,
    timeout: BOOKING_TX_TIMEOUT_MS,
  });

  await logAudit({
    userId: input.userId,
    entityType: "Booking",
    entityId: result.booking.id,
    action: "UPDATE_BOOKING_STATUS",
    details: {
      status: input.status,
      restoredSources: result.restoredSources,
      skipRestore: Boolean(input.skipRestore),
      source: input.source ?? "MANUAL",
    },
  });

  return result.booking;
}

export async function autoAttendEndedBookings(input: {
  now?: Date;
  limit?: number;
  userId?: string;
} = {}) {
  const now = input.now ?? getNow();
  const limit = input.limit ?? 100;
  const dueBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.BOOKED,
      session: {
        status: {
          not: SessionStatus.CANCELLED,
        },
        endsAt: {
          lte: now,
        },
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  const result = {
    attended: 0,
    failed: 0,
    completedSessions: 0,
  };

  for (const booking of dueBookings) {
    try {
      await updateBookingStatus({
        bookingId: booking.id,
        status: BookingStatus.ATTENDED,
        source: "AUTO_ATTENDANCE",
        userId: input.userId,
      });
      result.attended += 1;
    } catch (error) {
      result.failed += 1;
      console.warn(
        "Auto-attendance skipped a booking",
        booking.id,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const completedSessions = await prisma.session.updateMany({
    where: {
      status: SessionStatus.SCHEDULED,
      endsAt: {
        lte: now,
      },
    },
    data: {
      status: SessionStatus.COMPLETED,
    },
  });

  result.completedSessions = completedSessions.count;

  return result;
}

export async function cancelBooking(input: { bookingId: string; userId?: string }) {
  return updateBookingStatus({
    bookingId: input.bookingId,
    status: BookingStatus.CANCELLED,
    userId: input.userId,
  });
}

export async function adjustPackageCredits(input: {
  customerPackageId: string;
  deltaCredits: number;
  reason: string;
  notes?: string;
  adjustedByUserId: string;
}) {
  const updatedPackage = await prisma.$transaction(async (tx) => {
    const customerPackage = await tx.customerPackage.findUnique({
      where: { id: input.customerPackageId },
    });

    if (!customerPackage) {
      throw new Error("Package not found.");
    }

    const nextBalance = customerPackage.remainingCredits + input.deltaCredits;
    if (nextBalance < 0) {
      throw new Error("Adjustment would make the package balance negative.");
    }

    const updated = await tx.customerPackage.update({
      where: { id: input.customerPackageId },
      data: {
        remainingCredits: nextBalance,
      },
    });

    const adjustment = await tx.packageAdjustment.create({
      data: {
        customerPackageId: input.customerPackageId,
        deltaCredits: input.deltaCredits,
        reason: input.reason,
        notes: input.notes,
        adjustedByUserId: input.adjustedByUserId,
      },
    });

    await recordCustomerPackageTransaction(tx, {
      customerPackageId: input.customerPackageId,
      eventType: CustomerPackageTransactionType.ADJUSTMENT,
      deltaCredits: input.deltaCredits,
      resultingCredits: updated.remainingCredits,
      reason: input.reason,
      notes: input.notes,
      packageAdjustmentId: adjustment.id,
      createdByUserId: input.adjustedByUserId,
      details: {
        sourceType: customerPackage.sourceType,
        classTypeId: customerPackage.classTypeId,
      },
    });

    return updated;
  },
  {
    maxWait: BOOKING_TX_MAX_WAIT_MS,
    timeout: BOOKING_TX_TIMEOUT_MS,
  });

  await logAudit({
    userId: input.adjustedByUserId,
    entityType: "CustomerPackage",
    entityId: updatedPackage.id,
    action: "ADJUST_PACKAGE_CREDITS",
    details: {
      deltaCredits: input.deltaCredits,
      reason: input.reason,
      notes: input.notes,
    },
  });

  return updatedPackage;
}
