import type {
  ClassType,
  CustomerPackage,
  CustomerPackageTransaction,
  CustomerPackageTransactionType,
  CustomerTrialPackageItemTransaction,
  CustomerTrialPackageItemTransactionType,
  PackageTemplate,
} from "@prisma/client";

type CustomerBalanceLike = Pick<CustomerPackage, "sourceType"> & {
  classType?: Pick<ClassType, "name" | "category"> | null;
  packageTemplate?: Pick<PackageTemplate, "name"> | null;
};

export function isImportedBalance(balance: Pick<CustomerPackage, "sourceType">) {
  return balance.sourceType === "IMPORTED";
}

export function getCustomerBalanceLabel(balance: CustomerBalanceLike) {
  if (balance.packageTemplate?.name) {
    return balance.packageTemplate.name;
  }

  return balance.classType?.name ? `${balance.classType.name} imported balance` : "Imported balance";
}

export function getCustomerBalanceSourceLabel(balance: Pick<CustomerPackage, "sourceType">) {
  return balance.sourceType === "IMPORTED" ? "Imported" : "Package";
}

export function getCustomerPackageTransactionLabel(
  transaction: Pick<CustomerPackageTransaction, "eventType" | "deltaCredits">,
) {
  const amount =
    transaction.deltaCredits === 0
      ? "Snapshot"
      : `${transaction.deltaCredits > 0 ? "+" : ""}${transaction.deltaCredits} credit${Math.abs(transaction.deltaCredits) === 1 ? "" : "s"}`;

  const labels: Record<CustomerPackageTransactionType, string> = {
    OPENING_SNAPSHOT: "Opening snapshot",
    PACKAGE_SALE: "Package sold",
    IMPORTED_BALANCE: "Imported balance",
    USAGE: "Used",
    RESTORE: "Restored",
    ADJUSTMENT: "Adjusted",
  };

  return transaction.eventType === "OPENING_SNAPSHOT" ? labels[transaction.eventType] : `${amount} · ${labels[transaction.eventType]}`;
}

export function getCustomerPackageTransactionTone(
  transaction: Pick<CustomerPackageTransaction, "eventType" | "deltaCredits">,
) {
  if (transaction.eventType === "RESTORE") return "sage";
  if (transaction.eventType === "USAGE") return "warm";
  if (transaction.eventType === "ADJUSTMENT") {
    return transaction.deltaCredits >= 0 ? "sage" : "danger";
  }
  return "outline";
}

export function getTrialItemTransactionLabel(
  transaction: Pick<CustomerTrialPackageItemTransaction, "eventType" | "deltaQuantity">,
) {
  const amount =
    transaction.deltaQuantity === 0
      ? "Snapshot"
      : `${transaction.deltaQuantity > 0 ? "+" : ""}${transaction.deltaQuantity} session${Math.abs(transaction.deltaQuantity) === 1 ? "" : "s"}`;

  const labels: Record<CustomerTrialPackageItemTransactionType, string> = {
    OPENING_SNAPSHOT: "Opening snapshot",
    TRIAL_SALE: "Trial sold",
    USAGE: "Used",
    RESTORE: "Restored",
    ADJUSTMENT: "Adjusted",
  };

  return transaction.eventType === "OPENING_SNAPSHOT" ? labels[transaction.eventType] : `${amount} · ${labels[transaction.eventType]}`;
}
