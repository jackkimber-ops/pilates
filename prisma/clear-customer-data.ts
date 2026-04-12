import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const dryRun = process.argv.includes("--dry-run");

const AUDIT_ENTITY_TYPES_TO_CLEAR = [
  "Booking",
  "Customer",
  "CustomerPackage",
  "CustomerTrialPackage",
  "PackageAdjustment",
  "RecurringBookingRule",
  "Session",
  "SingleClassPurchase",
] as const;

async function getCounts() {
  const [
    customers,
    customerPackages,
    customerPackageTransactions,
    singleClassPurchases,
    customerTrialPackages,
    customerTrialPackageItems,
    customerTrialItemTransactions,
    packageAdjustments,
    bookings,
    recurringRules,
    sessions,
    auditLogs,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customerPackage.count(),
    prisma.customerPackageTransaction.count(),
    prisma.singleClassPurchase.count(),
    prisma.customerTrialPackage.count(),
    prisma.customerTrialPackageItem.count(),
    prisma.customerTrialPackageItemTransaction.count(),
    prisma.packageAdjustment.count(),
    prisma.booking.count(),
    prisma.recurringBookingRule.count(),
    prisma.session.count(),
    prisma.auditLog.count({
      where: {
        entityType: {
          in: [...AUDIT_ENTITY_TYPES_TO_CLEAR],
        },
      },
    }),
  ]);

  return {
    customers,
    customerPackages,
    customerPackageTransactions,
    singleClassPurchases,
    customerTrialPackages,
    customerTrialPackageItems,
    customerTrialItemTransactions,
    packageAdjustments,
    bookings,
    recurringRules,
    sessions,
    auditLogs,
  };
}

async function main() {
  const before = await getCounts();

  console.log("Customer data cleanup summary:");
  console.log(JSON.stringify(before, null, 2));

  if (dryRun) {
    console.log("Dry run only. No data was deleted.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({
      where: {
        entityType: {
          in: [...AUDIT_ENTITY_TYPES_TO_CLEAR],
        },
      },
    });

    await tx.customerPackageTransaction.deleteMany();
    await tx.customerTrialPackageItemTransaction.deleteMany();
    await tx.packageAdjustment.deleteMany();
    await tx.booking.deleteMany();
    await tx.session.deleteMany();
    await tx.recurringBookingRule.deleteMany();
    await tx.customerTrialPackageItem.deleteMany();
    await tx.customerTrialPackage.deleteMany();
    await tx.customerPackage.deleteMany();
    await tx.singleClassPurchase.deleteMany();
    await tx.customer.deleteMany();
  });

  const after = await getCounts();

  console.log("Cleanup complete.");
  console.log(JSON.stringify(after, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
