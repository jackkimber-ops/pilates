"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  BookingStatus,
  CustomerPackageSourceType,
  CustomerPackageTransactionType,
  CustomerTrialPackageItemTransactionType,
  Prisma,
} from "@prisma/client";
import { requireUser, signOut } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { calculateExpiryDate, combineDateAndTime } from "@/lib/date";
import { recordCustomerPackageTransaction, recordCustomerTrialItemTransaction } from "@/lib/entitlement-ledger";
import {
  adjustPackageCredits,
  createBooking,
  reverseBookingUsage,
  updateBookingStatus,
} from "@/lib/domain/bookings";
import { createRecurringRule, generateRecurringBookings, toggleRecurringRule } from "@/lib/domain/recurring";
import {
  cancelSession,
  createSession,
  restoreCancelledSessionUsage,
  updateSession,
} from "@/lib/domain/sessions";
import { prisma } from "@/lib/prisma";
import {
  bookingFormSchema,
  bookingStatusSchema,
  classTypeFormSchema,
  customerFormSchema,
  fromZodError,
  importedBalanceSchema,
  INITIAL_FORM_STATE,
  instructorFormSchema,
  packageAdjustmentSchema,
  packageTemplateFormSchema,
  recurringGenerationSchema,
  recurringRuleSchema,
  sellPackageSchema,
  sellTrialPackageSchema,
  sellSingleClassSchema,
  sessionFormSchema,
  type FormState,
} from "@/lib/validation";

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function actionError(error: unknown): FormState {
  if (isRedirectError(error)) {
    throw error;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return {
      ok: false,
      message: "Database error. Try again.",
    };
  }

  return {
    ok: false,
    message: error instanceof Error ? error.message : "Something went wrong.",
  };
}

function getRedirectTo(formData: FormData, fallback: string) {
  const redirectTo = formData.get("redirectTo");

  if (typeof redirectTo !== "string" || !redirectTo.startsWith("/")) {
    return fallback;
  }

  return redirectTo;
}

function revalidateCorePaths() {
  [
    "/",
    "/customers",
    "/calendar",
    "/sales/package",
    "/sales/imported-balance",
    "/sales/trial",
    "/sales/single",
    "/catalog/class-types",
    "/catalog/package-templates",
    "/catalog/instructors",
    "/recurring",
    "/reports",
  ].forEach((path) => revalidatePath(path));
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}

export async function upsertCustomerAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = customerFormSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const customer = await prisma.$transaction(async (tx) => {
      const customerData = {
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        email: parsed.data.email,
        notes: parsed.data.notes,
        tags: parsed.data.tags,
        status: parsed.data.status,
      };

      const savedCustomer = parsed.data.id
        ? await tx.customer.update({
            where: { id: parsed.data.id },
            data: customerData,
          })
        : await tx.customer.create({
            data: customerData,
          });

      if (!parsed.data.id && parsed.data.importedBalancesJson.length) {
        const classTypes = await tx.classType.findMany({
          where: {
            id: {
              in: parsed.data.importedBalancesJson.map((balance) => balance.classTypeId),
            },
          },
          select: {
            id: true,
            category: true,
          },
        });

        const classTypeById = new Map(classTypes.map((classType) => [classType.id, classType]));

        for (const importedBalance of parsed.data.importedBalancesJson) {
          const classType = classTypeById.get(importedBalance.classTypeId);

          if (!classType) {
            throw new Error("Class type not found.");
          }

          const createdBalance = await tx.customerPackage.create({
            data: {
              customerId: savedCustomer.id,
              classTypeId: importedBalance.classTypeId,
              sourceType: CustomerPackageSourceType.IMPORTED,
              category: classType.category,
              originalCredits: importedBalance.originalCredits ?? importedBalance.remainingCredits,
              remainingCredits: importedBalance.remainingCredits,
              purchaseDate: new Date(),
              expiryDate: importedBalance.expiryDate
                ? combineDateAndTime(importedBalance.expiryDate, "23:59")
                : null,
              notes: importedBalance.notes ?? "Imported from previous system",
            },
          });

          await recordCustomerPackageTransaction(tx, {
            customerPackageId: createdBalance.id,
            eventType: CustomerPackageTransactionType.IMPORTED_BALANCE,
            deltaCredits: importedBalance.remainingCredits,
            resultingCredits: createdBalance.remainingCredits,
            reason: "Imported opening balance",
            notes: importedBalance.notes ?? "Imported from previous system",
            createdByUserId: user.id,
            createdAt: createdBalance.createdAt,
            details: {
              classTypeId: importedBalance.classTypeId,
              originalCredits: importedBalance.originalCredits ?? importedBalance.remainingCredits,
            },
          });
        }
      }

      return savedCustomer;
    });

    await logAudit({
      userId: user.id,
      entityType: "Customer",
      entityId: customer.id,
      action: parsed.data.id ? "UPDATE_CUSTOMER" : "CREATE_CUSTOMER",
      details:
        !parsed.data.id && parsed.data.importedBalancesJson.length
          ? {
              importedBalances: parsed.data.importedBalancesJson.map((balance) => ({
                classTypeId: balance.classTypeId,
                remainingCredits: balance.remainingCredits,
                originalCredits: balance.originalCredits ?? balance.remainingCredits,
              })),
            }
          : undefined,
    });

    revalidateCorePaths();
    revalidatePath(`/customers/${customer.id}`);
    redirect(getRedirectTo(formData, `/customers/${customer.id}`));
  } catch (error) {
    return actionError(error);
  }
}

export async function addImportedBalanceAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = importedBalanceSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const balance = await prisma.$transaction(async (tx) => {
      const classType = await tx.classType.findUnique({
        where: {
          id: parsed.data.classTypeId,
        },
        select: {
          id: true,
          category: true,
        },
      });

      if (!classType) {
        throw new Error("Class type not found.");
      }

      const createdBalance = await tx.customerPackage.create({
        data: {
          customerId: parsed.data.customerId,
          classTypeId: parsed.data.classTypeId,
          sourceType: CustomerPackageSourceType.IMPORTED,
          category: classType.category,
          originalCredits: parsed.data.originalCredits ?? parsed.data.remainingCredits,
          remainingCredits: parsed.data.remainingCredits,
          purchaseDate: new Date(),
          expiryDate: parsed.data.expiryDate
            ? combineDateAndTime(parsed.data.expiryDate, "23:59")
            : null,
          notes: parsed.data.notes ?? "Imported from previous system",
        },
      });

      await recordCustomerPackageTransaction(tx, {
        customerPackageId: createdBalance.id,
        eventType: CustomerPackageTransactionType.IMPORTED_BALANCE,
        deltaCredits: parsed.data.remainingCredits,
        resultingCredits: createdBalance.remainingCredits,
        reason: "Imported opening balance",
        notes: parsed.data.notes ?? "Imported from previous system",
        createdByUserId: user.id,
        createdAt: createdBalance.createdAt,
        details: {
          classTypeId: parsed.data.classTypeId,
          originalCredits: parsed.data.originalCredits ?? parsed.data.remainingCredits,
        },
      });

      return createdBalance;
    });

    await logAudit({
      userId: user.id,
      entityType: "CustomerPackage",
      entityId: balance.id,
      action: "CREATE_IMPORTED_BALANCE",
      details: {
        customerId: parsed.data.customerId,
        classTypeId: parsed.data.classTypeId,
        remainingCredits: parsed.data.remainingCredits,
        originalCredits: parsed.data.originalCredits ?? parsed.data.remainingCredits,
      },
    });

    revalidateCorePaths();
    revalidatePath(`/customers/${parsed.data.customerId}`);
    redirect(getRedirectTo(formData, `/customers/${parsed.data.customerId}`));
  } catch (error) {
    return actionError(error);
  }
}

export async function upsertInstructorAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = instructorFormSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const instructor = parsed.data.id
      ? await prisma.instructor.update({
          where: { id: parsed.data.id },
          data: parsed.data,
        })
      : await prisma.instructor.create({
          data: parsed.data,
        });

    await logAudit({
      userId: user.id,
      entityType: "Instructor",
      entityId: instructor.id,
      action: parsed.data.id ? "UPDATE_INSTRUCTOR" : "CREATE_INSTRUCTOR",
    });

    revalidateCorePaths();
    redirect(getRedirectTo(formData, "/catalog/instructors"));
  } catch (error) {
    return actionError(error);
  }
}

export async function upsertClassTypeAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = classTypeFormSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const classType = parsed.data.id
      ? await prisma.classType.update({
          where: { id: parsed.data.id },
          data: parsed.data,
        })
      : await prisma.classType.create({
          data: parsed.data,
        });

    await logAudit({
      userId: user.id,
      entityType: "ClassType",
      entityId: classType.id,
      action: parsed.data.id ? "UPDATE_CLASS_TYPE" : "CREATE_CLASS_TYPE",
    });

    revalidateCorePaths();
    redirect(getRedirectTo(formData, "/catalog/class-types"));
  } catch (error) {
    return actionError(error);
  }
}

export async function upsertPackageTemplateAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = packageTemplateFormSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const classType = await prisma.classType.findUnique({
      where: { id: parsed.data.classTypeId },
      select: {
        category: true,
      },
    });

    if (!classType) {
      throw new Error("Class type not found.");
    }

    const packageTemplateData = {
      name: parsed.data.name,
      classTypeId: parsed.data.classTypeId,
      category: classType.category,
      sessionCount: parsed.data.sessionCount,
      validityMonths: parsed.data.validityMonths,
      regularPrice: parsed.data.regularPrice,
      packagePrice: parsed.data.packagePrice,
      active: parsed.data.active,
    };

    const packageTemplate = parsed.data.id
      ? await prisma.packageTemplate.update({
          where: { id: parsed.data.id },
          data: packageTemplateData,
        })
      : await prisma.packageTemplate.create({
          data: packageTemplateData,
        });

    await logAudit({
      userId: user.id,
      entityType: "PackageTemplate",
      entityId: packageTemplate.id,
      action: parsed.data.id ? "UPDATE_PACKAGE_TEMPLATE" : "CREATE_PACKAGE_TEMPLATE",
    });

    revalidateCorePaths();
    redirect(getRedirectTo(formData, "/catalog/package-templates"));
  } catch (error) {
    return actionError(error);
  }
}

export async function sellPackageAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = sellPackageSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const packageTemplate = await prisma.packageTemplate.findUnique({
      where: { id: parsed.data.packageTemplateId },
    });

    if (!packageTemplate) {
      throw new Error("Package template not found.");
    }

    const customerPackage = await prisma.$transaction(async (tx) => {
      const createdPackage = await tx.customerPackage.create({
        data: {
          customerId: parsed.data.customerId,
          packageTemplateId: parsed.data.packageTemplateId,
          classTypeId: packageTemplate.classTypeId,
          sourceType: CustomerPackageSourceType.PACKAGE_SALE,
          category: packageTemplate.category,
          originalCredits: packageTemplate.sessionCount,
          remainingCredits: packageTemplate.sessionCount,
          purchaseDate: combineDateAndTime(parsed.data.purchaseDate, "00:00"),
          expiryDate: calculateExpiryDate(parsed.data.purchaseDate, packageTemplate.validityMonths),
          amountPaid: parsed.data.amountPaid,
          paymentMethod: parsed.data.paymentMethod,
          notes: parsed.data.notes,
        },
      });

      await recordCustomerPackageTransaction(tx, {
        customerPackageId: createdPackage.id,
        eventType: CustomerPackageTransactionType.PACKAGE_SALE,
        deltaCredits: packageTemplate.sessionCount,
        resultingCredits: createdPackage.remainingCredits,
        reason: "Package sold",
        notes: parsed.data.notes,
        createdByUserId: user.id,
        createdAt: createdPackage.createdAt,
        details: {
          packageTemplateId: parsed.data.packageTemplateId,
          classTypeId: packageTemplate.classTypeId,
          validityMonths: packageTemplate.validityMonths,
          amountPaid: parsed.data.amountPaid,
        },
      });

      return createdPackage;
    });

    await logAudit({
      userId: user.id,
      entityType: "CustomerPackage",
      entityId: customerPackage.id,
      action: "SELL_PACKAGE",
      details: {
        customerId: parsed.data.customerId,
        packageTemplateId: parsed.data.packageTemplateId,
      },
    });

    revalidateCorePaths();
    revalidatePath(`/customers/${parsed.data.customerId}`);
    redirect(getRedirectTo(formData, `/customers/${parsed.data.customerId}`));
  } catch (error) {
    return actionError(error);
  }
}

export async function sellSingleClassAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = sellSingleClassSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    if (parsed.data.classTypeId) {
      const classType = await prisma.classType.findUnique({
        where: { id: parsed.data.classTypeId },
      });

      if (!classType) {
        throw new Error("Class type not found.");
      }

      if (classType.category !== parsed.data.category) {
        throw new Error("Selected class type does not match the one-off category.");
      }
    }

    const purchase = await prisma.singleClassPurchase.create({
      data: {
        customerId: parsed.data.customerId,
        category: parsed.data.category,
        classTypeId: parsed.data.classTypeId,
        purchaseDate: combineDateAndTime(parsed.data.purchaseDate, "00:00"),
        amountPaid: parsed.data.amountPaid,
        paymentMethod: parsed.data.paymentMethod,
        expiryDate: parsed.data.expiryDate
          ? combineDateAndTime(parsed.data.expiryDate, "23:59")
          : undefined,
        notes: parsed.data.notes,
      },
    });

    await logAudit({
      userId: user.id,
      entityType: "SingleClassPurchase",
      entityId: purchase.id,
      action: "SELL_SINGLE_CLASS",
      details: {
        customerId: parsed.data.customerId,
        category: parsed.data.category,
        classTypeId: parsed.data.classTypeId,
      },
    });

    revalidateCorePaths();
    revalidatePath(`/customers/${parsed.data.customerId}`);
    redirect(getRedirectTo(formData, `/customers/${parsed.data.customerId}`));
  } catch (error) {
    return actionError(error);
  }
}

export async function sellTrialPackageAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = sellTrialPackageSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const template = await prisma.trialPackageTemplate.findUnique({
      where: { id: parsed.data.trialPackageTemplateId },
      include: {
        items: true,
      },
    });

    if (!template || !template.active) {
      throw new Error("Trial package template not found.");
    }

    if (!template.items.length) {
      throw new Error("This trial package template has no included entitlements.");
    }

    const trialPackage = await prisma.$transaction(async (tx) => {
      const createdPackage = await tx.customerTrialPackage.create({
        data: {
          customerId: parsed.data.customerId,
          trialPackageTemplateId: parsed.data.trialPackageTemplateId,
          purchaseDate: combineDateAndTime(parsed.data.purchaseDate, "00:00"),
          amountPaid: parsed.data.amountPaid,
          paymentMethod: parsed.data.paymentMethod,
          notes: parsed.data.notes,
          items: {
            create: template.items.map((item) => ({
              classTypeId: item.classTypeId,
              originalQuantity: item.quantity,
              remainingQuantity: item.quantity,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      for (const item of createdPackage.items) {
        await recordCustomerTrialItemTransaction(tx, {
          customerTrialPackageItemId: item.id,
          eventType: CustomerTrialPackageItemTransactionType.TRIAL_SALE,
          deltaQuantity: item.originalQuantity,
          resultingQuantity: item.remainingQuantity,
          reason: "Trial package sold",
          notes: parsed.data.notes,
          createdByUserId: user.id,
          createdAt: item.createdAt,
          details: {
            trialPackageTemplateId: parsed.data.trialPackageTemplateId,
            customerTrialPackageId: createdPackage.id,
            classTypeId: item.classTypeId,
            amountPaid: parsed.data.amountPaid,
          },
        });
      }

      return createdPackage;
    });

    await logAudit({
      userId: user.id,
      entityType: "CustomerTrialPackage",
      entityId: trialPackage.id,
      action: "SELL_TRIAL_PACKAGE",
      details: {
        customerId: parsed.data.customerId,
        trialPackageTemplateId: parsed.data.trialPackageTemplateId,
      },
    });

    revalidateCorePaths();
    revalidatePath(`/customers/${parsed.data.customerId}`);
    redirect(getRedirectTo(formData, `/customers/${parsed.data.customerId}`));
  } catch (error) {
    return actionError(error);
  }
}

export async function saveSessionAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = sessionFormSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const classType = await prisma.classType.findUnique({
      where: { id: parsed.data.classTypeId },
    });

    if (!classType) {
      throw new Error("Class type not found.");
    }

    if (parsed.data.capacity > classType.maxCapacity) {
      throw new Error(`Capacity cannot exceed ${classType.maxCapacity} for this class type.`);
    }

    let session;

    if (parsed.data.id) {
      session = await updateSession({
        sessionId: parsed.data.id,
        classTypeId: parsed.data.classTypeId,
        instructorId: parsed.data.instructorId,
        title: parsed.data.title,
        date: parsed.data.date,
        startTime: parsed.data.startTime,
        capacity: parsed.data.capacity,
        notes: parsed.data.notes,
        syncToGoogle: parsed.data.syncToGoogle,
        userId: user.id,
      });
    } else {
      if (!parsed.data.customerId) {
        return {
          ok: false,
          message: "Select a customer.",
          fieldErrors: {
            customerId: ["Select a customer."],
          },
        };
      }

      const availableBalance = await prisma.customerPackage.findFirst({
        where: {
          customerId: parsed.data.customerId,
          classTypeId: parsed.data.classTypeId,
          active: true,
          remainingCredits: {
            gt: 0,
          },
          OR: [
            {
              expiryDate: null,
            },
            {
              expiryDate: {
                gte: combineDateAndTime(parsed.data.date, parsed.data.startTime),
              },
            },
          ],
        },
        select: {
          id: true,
        },
      });

      if (!availableBalance) {
        return {
          ok: false,
          message: "No active balance for this class.",
          fieldErrors: {
            customerId: ["Matching balance required."],
          },
        };
      }

      session = await createSession({
        classTypeId: parsed.data.classTypeId,
        instructorId: parsed.data.instructorId,
        title: parsed.data.title,
        date: parsed.data.date,
        startTime: parsed.data.startTime,
        capacity: parsed.data.capacity,
        notes: parsed.data.notes,
        syncToGoogle: false,
        userId: user.id,
      });

      try {
        await createBooking({
          sessionId: session.id,
          customerId: parsed.data.customerId,
          paymentSourceType: "PACKAGE",
          deductPackageOnCreate: true,
          userId: user.id,
        });

        if (parsed.data.syncToGoogle) {
          await updateSession({
            sessionId: session.id,
            classTypeId: parsed.data.classTypeId,
            instructorId: parsed.data.instructorId,
            title: parsed.data.title,
            date: parsed.data.date,
            startTime: parsed.data.startTime,
            capacity: parsed.data.capacity,
            notes: parsed.data.notes,
            syncToGoogle: true,
            userId: user.id,
          });
        }
      } catch (bookingError) {
        await prisma.session.delete({
          where: {
            id: session.id,
          },
        });

        throw bookingError;
      }
    }

    revalidateCorePaths();
    revalidatePath(`/sessions/${session.id}`);
    if (parsed.data.customerId) {
      revalidatePath(`/customers/${parsed.data.customerId}`);
    }
    redirect(getRedirectTo(formData, `/sessions/${session.id}`));
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelSessionAction(formData: FormData) {
  const user = await requireUser();
  const sessionId = formData.get("sessionId");

  if (typeof sessionId !== "string" || !sessionId) {
    throw new Error("Session id is required.");
  }

  await cancelSession({
    sessionId,
    restoreConsumedBookings: formData.get("restoreConsumedBookings") !== "false",
    userId: user.id,
  });

  revalidateCorePaths();
  revalidatePath(`/sessions/${sessionId}`);
  redirect(getRedirectTo(formData, "/calendar"));
}

export async function restoreBookingUsageAction(formData: FormData) {
  const user = await requireUser();
  const bookingId = formData.get("bookingId");
  const targetStatus = formData.get("targetStatus");

  if (typeof bookingId !== "string" || !bookingId) {
    throw new Error("Booking id is required.");
  }

  await reverseBookingUsage({
    bookingId,
    targetStatus: typeof targetStatus === "string" && targetStatus ? (targetStatus as BookingStatus) : BookingStatus.BOOKED,
    userId: user.id,
  });

  revalidateCorePaths();
  redirect(getRedirectTo(formData, "/calendar"));
}

export async function restoreCancelledSessionUsageAction(formData: FormData) {
  const user = await requireUser();
  const sessionId = formData.get("sessionId");

  if (typeof sessionId !== "string" || !sessionId) {
    throw new Error("Session id is required.");
  }

  await restoreCancelledSessionUsage({
    sessionId,
    userId: user.id,
  });

  revalidateCorePaths();
  revalidatePath(`/sessions/${sessionId}`);
  redirect(getRedirectTo(formData, `/sessions/${sessionId}`));
}

export async function createBookingAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = bookingFormSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const booking = await createBooking({
      sessionId: parsed.data.sessionId,
      customerId: parsed.data.customerId,
      paymentSourceType: parsed.data.paymentSourceType,
      singleClassPurchaseId: parsed.data.singleClassPurchaseId,
      customerTrialPackageItemId: parsed.data.customerTrialPackageItemId,
      notes: parsed.data.notes,
      userId: user.id,
    });

    revalidateCorePaths();
    revalidatePath(`/sessions/${booking.sessionId}`);
    revalidatePath(`/customers/${booking.customerId}`);
    redirect(getRedirectTo(formData, `/sessions/${booking.sessionId}`));
  } catch (error) {
    return actionError(error);
  }
}

export async function updateBookingStatusAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = bookingStatusSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const booking = await updateBookingStatus({
      bookingId: parsed.data.bookingId,
      status: parsed.data.status as BookingStatus,
      notes: parsed.data.notes,
      userId: user.id,
    });

    revalidateCorePaths();
    revalidatePath(`/sessions/${booking.sessionId}`);
    revalidatePath(`/customers/${booking.customerId}`);
    redirect(getRedirectTo(formData, `/sessions/${booking.sessionId}`));
  } catch (error) {
    return actionError(error);
  }
}

export async function adjustPackageCreditsAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = packageAdjustmentSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const updatedPackage = await adjustPackageCredits({
      customerPackageId: parsed.data.customerPackageId,
      deltaCredits: parsed.data.deltaCredits,
      reason: parsed.data.reason,
      notes: parsed.data.notes,
      adjustedByUserId: user.id,
    });

    revalidateCorePaths();
    revalidatePath(`/customers/${updatedPackage.customerId}`);
    redirect(getRedirectTo(formData, `/customers/${updatedPackage.customerId}`));
  } catch (error) {
    return actionError(error);
  }
}

export async function createRecurringRuleAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = recurringRuleSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const rule = await createRecurringRule({
      customerId: parsed.data.customerId,
      classTypeId: parsed.data.classTypeId,
      instructorId: parsed.data.instructorId,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      active: parsed.data.active,
      paymentSourceType: parsed.data.paymentSourceType,
      notes: parsed.data.notes,
      userId: user.id,
    });

    revalidateCorePaths();
    revalidatePath(`/customers/${rule.customerId}`);
    redirect(getRedirectTo(formData, "/recurring"));
  } catch (error) {
    return actionError(error);
  }
}

export async function generateRecurringBookingsAction(
  _: FormState = INITIAL_FORM_STATE,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = recurringGenerationSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  try {
    const result = await generateRecurringBookings({
      ruleId: parsed.data.ruleId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      userId: user.id,
    });

    revalidateCorePaths();

    return {
      ok: true,
      message: `Generated ${result.createdCount} sessions. Conflicts: ${result.conflicts.length}. Already existing: ${result.existing.length}.`,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleRecurringRuleAction(formData: FormData) {
  const user = await requireUser();
  const ruleId = formData.get("ruleId");
  const active = formData.get("active") === "true";

  if (typeof ruleId !== "string" || !ruleId) {
    throw new Error("Recurring rule id is required.");
  }

  await toggleRecurringRule({
    ruleId,
    active,
    userId: user.id,
  });

  revalidateCorePaths();
  redirect(getRedirectTo(formData, "/recurring"));
}
