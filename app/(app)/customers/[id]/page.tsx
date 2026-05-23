import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CalendarClock,
  CircleDollarSign,
  Mail,
  Phone,
  ReceiptText,
  Repeat2,
  Sparkles,
  TicketPlus,
  WalletCards,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MobileSectionNav } from "@/components/layout/mobile-section-nav";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { CustomerForm } from "@/app/(app)/customers/customer-form";
import { PackageAdjustmentForm } from "@/app/(app)/customers/package-adjustment-form";
import { ImportedBalanceForm } from "@/app/(app)/sales/imported-balance/imported-balance-form";
import {
  getCustomerBalanceLabel,
  getCustomerBalanceSourceLabel,
  getCustomerPackageTransactionLabel,
  getCustomerPackageTransactionTone,
  getTrialItemTransactionLabel,
  isImportedBalance,
} from "@/lib/balances";
import { prisma } from "@/lib/prisma";
import { compactList, formatCurrency } from "@/lib/utils";
import {
  toDateTimeLabel,
  toLongDate,
  toRelativeDayLabel,
  toShortDate,
} from "@/lib/date";

function getBookingStatusTone(status: string) {
  if (status === "ATTENDED") return "sage";
  if (status === "CANCELLED") return "neutral";
  if (status === "NO_SHOW") return "danger";
  if (status === "LATE_CANCEL") return "warm";
  return "plum";
}

function getPaymentSourceTone(source: string) {
  if (source === "PACKAGE") return "sage";
  if (source === "SINGLE") return "warm";
  if (source === "TRIAL") return "plum";
  return "neutral";
}

function getPurchaseStatusTone(status: string) {
  if (status === "USED") return "sage";
  if (status === "UNUSED") return "plum";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

function getCreditHistoryLabel(type: string) {
  if (type === "PACKAGE_PURCHASE") return "Package purchased";
  if (type === "ATTENDED") return "Attended";
  if (type === "CANCELLED") return "Cancelled";
  return "Manual adjustment";
}

function getCreditHistoryTone(change: number) {
  return change > 0 ? "sage" : "warm";
}

function formatCreditChange(change: number) {
  return change > 0 ? `+${change}` : `${change}`;
}

function getCreditHistoryNote(type: string, note?: string | null) {
  if (!note) return null;

  return note.toLowerCase() === getCreditHistoryLabel(type).toLowerCase() ? null : note;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [
    customerCore,
    packages,
    packageTransactions,
    trialPackages,
    trialItems,
    trialTransactions,
    singleClassPurchases,
    bookings,
    recurringRules,
    creditHistory,
    classTypes,
  ] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        notes: true,
        tags: true,
        status: true,
      },
    }),
    prisma.customerPackage.findMany({
      where: {
        customerId: id,
      },
      select: {
        id: true,
        category: true,
        sourceType: true,
        originalCredits: true,
        remainingCredits: true,
        purchaseDate: true,
        expiryDate: true,
        amountPaid: true,
        paymentMethod: true,
        notes: true,
        active: true,
        classType: {
          select: {
            name: true,
            category: true,
          },
        },
        packageTemplate: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        purchaseDate: "desc",
      },
    }),
    prisma.customerPackageTransaction.findMany({
      where: {
        customerPackage: {
          customerId: id,
        },
      },
      select: {
        id: true,
        customerPackageId: true,
        eventType: true,
        deltaCredits: true,
        resultingCredits: true,
        reason: true,
        notes: true,
        createdAt: true,
        createdByUser: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
    prisma.customerTrialPackage.findMany({
      where: {
        customerId: id,
      },
      select: {
        id: true,
        purchaseDate: true,
        amountPaid: true,
        paymentMethod: true,
        notes: true,
        active: true,
        trialPackageTemplate: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        purchaseDate: "desc",
      },
    }),
    prisma.customerTrialPackageItem.findMany({
      where: {
        customerTrialPackage: {
          customerId: id,
        },
      },
      select: {
        id: true,
        customerTrialPackageId: true,
        originalQuantity: true,
        remainingQuantity: true,
        classType: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.customerTrialPackageItemTransaction.findMany({
      where: {
        customerTrialPackageItem: {
          customerTrialPackage: {
            customerId: id,
          },
        },
      },
      select: {
        id: true,
        customerTrialPackageItemId: true,
        eventType: true,
        deltaQuantity: true,
        reason: true,
        notes: true,
        createdAt: true,
        createdByUser: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
    prisma.singleClassPurchase.findMany({
      where: {
        customerId: id,
      },
      select: {
        id: true,
        category: true,
        purchaseDate: true,
        amountPaid: true,
        paymentMethod: true,
        status: true,
        expiryDate: true,
        classType: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        purchaseDate: "desc",
      },
      take: 50,
    }),
    prisma.booking.findMany({
      where: {
        customerId: id,
      },
      select: {
        id: true,
        sessionId: true,
        status: true,
        paymentSourceType: true,
        creditDeducted: true,
        singleUseConsumed: true,
        trialUseConsumed: true,
        restoredAt: true,
        notes: true,
        customerPackage: {
          select: {
            sourceType: true,
            classType: {
              select: {
                name: true,
                category: true,
              },
            },
            packageTemplate: {
              select: {
                name: true,
              },
            },
          },
        },
        singleClassPurchase: {
          select: {
            classType: {
              select: {
                name: true,
              },
            },
          },
        },
        customerTrialPackage: {
          select: {
            trialPackageTemplate: {
              select: {
                name: true,
              },
            },
          },
        },
        customerTrialPackageItem: {
          select: {
            classType: {
              select: {
                name: true,
              },
            },
          },
        },
        session: {
          select: {
            title: true,
            startsAt: true,
            status: true,
            instructor: {
              select: {
                fullName: true,
              },
            },
            classType: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
    prisma.recurringBookingRule.findMany({
      where: {
        customerId: id,
      },
      select: {
        id: true,
        active: true,
        paymentSourceType: true,
        dayOfWeek: true,
        startTime: true,
        classType: {
          select: {
            name: true,
            category: true,
          },
        },
        instructor: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.customerCreditHistory.findMany({
      where: {
        customerId: id,
      },
      select: {
        id: true,
        change: true,
        type: true,
        note: true,
        createdAt: true,
        classType: {
          select: {
            name: true,
          },
        },
        relatedSession: {
          select: {
            startsAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
    prisma.classType.findMany({
      where: {
        active: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  if (!customerCore) {
    notFound();
  }

  const transactionsByPackageId = packageTransactions.reduce(
    (map, transaction) => {
      const existing = map.get(transaction.customerPackageId);
      if (existing) {
        existing.push(transaction);
      } else {
        map.set(transaction.customerPackageId, [transaction]);
      }

      return map;
    },
    new Map<string, typeof packageTransactions>(),
  );

  const itemsByTrialPackageId = trialItems.reduce(
    (map, item) => {
      const existing = map.get(item.customerTrialPackageId);
      if (existing) {
        existing.push(item);
      } else {
        map.set(item.customerTrialPackageId, [item]);
      }

      return map;
    },
    new Map<string, typeof trialItems>(),
  );

  const transactionsByTrialItemId = trialTransactions.reduce(
    (map, transaction) => {
      const existing = map.get(transaction.customerTrialPackageItemId);
      if (existing) {
        existing.push(transaction);
      } else {
        map.set(transaction.customerTrialPackageItemId, [transaction]);
      }

      return map;
    },
    new Map<string, typeof trialTransactions>(),
  );

  const customer = {
    ...customerCore,
    packages: packages.map((customerPackage) => ({
      ...customerPackage,
      transactions: transactionsByPackageId.get(customerPackage.id) ?? [],
    })),
    trialPackages: trialPackages.map((trialPackage) => ({
      ...trialPackage,
      items: (itemsByTrialPackageId.get(trialPackage.id) ?? []).map((item) => ({
        ...item,
        transactions: transactionsByTrialItemId.get(item.id) ?? [],
      })),
    })),
    singleClassPurchases,
    bookings,
    recurringRules,
    creditHistory,
  };

  const paymentHistory = [
    ...customer.packages
      .filter((customerPackage) => !isImportedBalance(customerPackage) && customerPackage.paymentMethod)
      .map((customerPackage) => ({
      id: customerPackage.id,
      date: customerPackage.purchaseDate,
      label: getCustomerBalanceLabel(customerPackage),
      type: "Package",
      amount: customerPackage.amountPaid.toString(),
      method: customerPackage.paymentMethod ?? "OTHER",
    })),
    ...customer.singleClassPurchases.map((purchase) => ({
      id: purchase.id,
      date: purchase.purchaseDate,
      label: purchase.classType?.name ?? `${purchase.category} one-off`,
      type: "One-off",
      amount: purchase.amountPaid.toString(),
      method: purchase.paymentMethod,
    })),
    ...customer.trialPackages.map((trialPackage) => ({
      id: trialPackage.id,
      date: trialPackage.purchaseDate,
      label: trialPackage.trialPackageTemplate.name,
      type: "Trial",
      amount: trialPackage.amountPaid.toString(),
      method: trialPackage.paymentMethod,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const attendanceHistory = customer.bookings.filter((booking) => booking.status !== "BOOKED");
  const activePackages = customer.packages.filter(
    (customerPackage) =>
      customerPackage.active &&
      customerPackage.remainingCredits > 0 &&
      (!customerPackage.expiryDate || customerPackage.expiryDate >= new Date()),
  );
  const importedBalanceCount = customer.packages.filter((customerPackage) => isImportedBalance(customerPackage)).length;
  const totalCredits = activePackages.reduce(
    (sum, customerPackage) => sum + customerPackage.remainingCredits,
    0,
  );
  const unusedSingles = customer.singleClassPurchases.filter(
    (purchase) => purchase.status === "UNUSED",
  ).length;
  const activeTrials = customer.trialPackages.filter(
    (trialPackage) =>
      trialPackage.active && trialPackage.items.some((item) => item.remainingQuantity > 0),
  );
  const remainingTrialEntitlements = activeTrials.reduce(
    (sum, trialPackage) =>
      sum + trialPackage.items.reduce((trialSum, item) => trialSum + item.remainingQuantity, 0),
    0,
  );
  const trialEntitlements = customer.trialPackages.flatMap((trialPackage) =>
    trialPackage.items.map((item) => ({
      id: item.id,
      packageName: trialPackage.trialPackageTemplate.name,
      purchaseDate: trialPackage.purchaseDate,
      active: trialPackage.active,
      classTypeName: item.classType.name,
      originalQuantity: item.originalQuantity,
      remainingQuantity: item.remainingQuantity,
      usedQuantity: item.originalQuantity - item.remainingQuantity,
    })),
  );
  const attendedCount = customer.bookings.filter((booking) => booking.status === "ATTENDED").length;
  const nextBooking =
    [...customer.bookings]
      .filter((booking) => booking.status === "BOOKED" && booking.session.status !== "CANCELLED")
      .sort((a, b) => a.session.startsAt.getTime() - b.session.startsAt.getTime())[0] ?? null;
  const latestPayment = paymentHistory[0] ?? null;
  const balanceSourceCount = customer.packages.length + trialEntitlements.length;
  const packageCountLabel = `${balanceSourceCount} source${balanceSourceCount === 1 ? "" : "s"}`;
  const importedCountLabel = `${importedBalanceCount} imported`;
  const oneOffCountLabel = `${customer.singleClassPurchases.length} one-off${customer.singleClassPurchases.length === 1 ? "" : "s"}`;
  const trialCountLabel = `${customer.trialPackages.length} trial${customer.trialPackages.length === 1 ? "" : "s"}`;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Customer"
        title={customer.fullName}
        description={
          compactList([customer.phone ?? null, customer.email ?? null]) ||
          "No contact details."
        }
        actions={
          <>
            <Link
              href={`/sales/package?customerId=${customer.id}`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              <CircleDollarSign className="size-4" />
              Sell package
            </Link>
            <Link
              href={`/sales/single?customerId=${customer.id}`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              <TicketPlus className="size-4" />
              Sell one-off
            </Link>
            <Link
              href={`/sales/imported-balance?customerId=${customer.id}`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              Add imported balance
            </Link>
            <Link
              href={`/sales/trial?customerId=${customer.id}`}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              <Sparkles className="size-4" />
              Sell trial
            </Link>
            <Link href={`/recurring?customerId=${customer.id}`} className={buttonStyles({ size: "sm" })}>
              <Repeat2 className="size-4" />
              Recurring
            </Link>
          </>
        }
      />

      <MobileSectionNav
        items={[
          { href: "#summary", label: "Summary" },
          { href: "#balances", label: "Balances" },
          { href: "#trials", label: "Trials" },
          { href: "#profile", label: "Profile" },
          { href: "#credit-history", label: "History" },
          { href: "#bookings", label: "Bookings" },
          { href: "#payments", label: "Payments" },
        ]}
      />

      <Card id="summary" variant="tint" className="scroll-mt-28 overflow-hidden p-0">
        <div className="grid gap-6 px-6 py-6 md:px-8 md:py-8 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-5">
            <div className="chip-row">
              <Badge tone={customer.status === "ACTIVE" ? "sage" : "neutral"}>{customer.status}</Badge>
              {customer.tags.map((tag) => (
                <Badge key={tag} tone="outline">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="space-y-3">
              <h2 className="section-title">{customer.fullName}</h2>
              <p className="max-w-2xl text-base leading-7 text-muted">
                {customer.notes ||
                  "No notes."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface-inset rounded-[24px] p-4">
                <p className="section-kicker">Contact</p>
                <div className="mt-3 space-y-3">
                  <p className="inline-flex items-center gap-2 text-sm leading-6 text-ink">
                    <Phone className="size-4 text-accent-strong" />
                    {customer.phone || "No phone recorded"}
                  </p>
                  <p className="inline-flex items-center gap-2 text-sm leading-6 text-ink">
                    <Mail className="size-4 text-accent-strong" />
                    {customer.email || "No email recorded"}
                  </p>
                </div>
              </div>

              <div className="surface-inset rounded-[24px] p-4">
                <p className="section-kicker">Relationship</p>
                <div className="mt-3 space-y-3 text-sm leading-6 text-ink">
                  <p>{packageCountLabel}</p>
                  <p>{importedCountLabel}</p>
                  <p>{trialCountLabel}</p>
                  <p>{oneOffCountLabel}</p>
                  <p>{attendedCount} attended visit{attendedCount === 1 ? "" : "s"}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="list-row-quiet">
                <p className="section-kicker">Next booking</p>
                {nextBooking ? (
                  <>
                    <p className="mt-3 font-semibold text-ink">{nextBooking.session.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {compactList([
                        toDateTimeLabel(nextBooking.session.startsAt),
                        nextBooking.session.instructor.fullName,
                        nextBooking.session.classType.name,
                      ])}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-muted">
                    No upcoming booking.
                  </p>
                )}
              </div>

              <div className="list-row-quiet">
                <p className="section-kicker">Latest payment</p>
                {latestPayment ? (
                  <>
                    <p className="mt-3 font-semibold text-ink">{latestPayment.label}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {compactList([
                        formatCurrency(latestPayment.amount),
                        latestPayment.method.replaceAll("_", " "),
                        toLongDate(latestPayment.date),
                      ])}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-muted">
                    No payment yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="stat-shell">
              <p className="stat-label">Sessions remaining</p>
              <p className="metric-number mt-3">{totalCredits}</p>
            </div>
            <div className="stat-shell">
              <p className="stat-label">Active balances</p>
              <p className="metric-number mt-3">{activePackages.length}</p>
            </div>
            <div className="stat-shell">
              <p className="stat-label">Unused one-offs</p>
              <p className="metric-number mt-3">{unusedSingles}</p>
            </div>
            <div className="stat-shell">
              <p className="stat-label">Trial sessions</p>
              <p className="metric-number mt-3">{remainingTrialEntitlements}</p>
            </div>

            <div className="surface-inset rounded-[24px] p-4 sm:col-span-2">
              <div className="section-header">
                <div className="space-y-2">
                  <p className="section-kicker">Actions</p>
                  <h3 className="font-display text-[1.4rem] leading-none tracking-[-0.04em] text-ink">Actions</h3>
                </div>
                <CalendarClock className="size-4 text-accent-strong" />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Link
                  href={`/sales/package?customerId=${customer.id}`}
                  className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full" })}
                >
                  Sell package
                </Link>
                <Link
                  href={`/sales/single?customerId=${customer.id}`}
                  className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full" })}
                >
                  Sell one-off
                </Link>
                <Link
                  href={`/sales/imported-balance?customerId=${customer.id}`}
                  className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full" })}
                >
                  Add balance
                </Link>
                <Link
                  href={`/sales/trial?customerId=${customer.id}`}
                  className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full" })}
                >
                  Sell trial
                </Link>
                <Link
                  href={`/recurring?customerId=${customer.id}`}
                  className={buttonStyles({ size: "sm", className: "w-full" })}
                >
                  Recurring
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="action-dock">
        <div className="action-dock-panel">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              href={`/sales/package?customerId=${customer.id}`}
              className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full" })}
            >
              <CircleDollarSign className="size-4" />
              Sell package
            </Link>
            <Link
              href={`/sales/single?customerId=${customer.id}`}
              className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full" })}
            >
              <TicketPlus className="size-4" />
              Sell one-off
            </Link>
            <Link
              href={`/sales/imported-balance?customerId=${customer.id}`}
              className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full" })}
            >
              Add balance
            </Link>
            <Link
              href={`/sales/trial?customerId=${customer.id}`}
              className={buttonStyles({ variant: "secondary", size: "sm", className: "w-full" })}
            >
              <Sparkles className="size-4" />
              Sell trial
            </Link>
            <Link
              href={`/recurring?customerId=${customer.id}`}
              className={buttonStyles({ size: "sm", className: "w-full" })}
            >
              <Repeat2 className="size-4" />
              Recurring
            </Link>
          </div>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.04fr_0.96fr]">
        <Card id="balances" className="scroll-mt-28 space-y-5">
          <div className="section-header">
            <div className="space-y-2">
              <p className="section-kicker">Balances</p>
              <h2 className="section-title">Balances</h2>
            </div>
            <Badge tone="outline">{packageCountLabel}</Badge>
          </div>

          <div className="space-y-4">
            {customer.packages.length ? (
              customer.packages.map((customerPackage) => (
                <div key={customerPackage.id} className="list-row space-y-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="chip-row">
                        <Badge tone={customerPackage.category === "GROUP" ? "plum" : "warm"}>
                          {customerPackage.category}
                        </Badge>
                        <Badge tone={isImportedBalance(customerPackage) ? "outline" : "sage"}>
                          {getCustomerBalanceSourceLabel(customerPackage)}
                        </Badge>
                        <Badge
                          tone={
                            customerPackage.expiryDate
                              ? customerPackage.expiryDate >= new Date()
                                ? "sage"
                                : "neutral"
                              : "outline"
                          }
                        >
                          {customerPackage.expiryDate
                            ? customerPackage.expiryDate >= new Date()
                              ? "ACTIVE"
                              : "EXPIRED"
                            : "NO EXPIRY"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-display text-[1.7rem] leading-none tracking-[-0.04em] text-ink">
                          {getCustomerBalanceLabel(customerPackage)}
                        </h3>
                        <p className="text-sm leading-6 text-muted">
                          {compactList([
                            `${customerPackage.remainingCredits}/${customerPackage.originalCredits} sessions`,
                            !isImportedBalance(customerPackage)
                              ? `Paid ${formatCurrency(customerPackage.amountPaid.toString())}`
                              : null,
                            customerPackage.paymentMethod?.replaceAll("_", " "),
                          ])}
                        </p>
                        <p className="text-sm leading-6 text-muted">
                          {compactList([
                            isImportedBalance(customerPackage)
                              ? `Imported ${toShortDate(customerPackage.purchaseDate)}`
                              : `Purchased ${toShortDate(customerPackage.purchaseDate)}`,
                            customerPackage.expiryDate
                              ? `Expires ${toRelativeDayLabel(customerPackage.expiryDate)}`
                              : "No expiry",
                          ])}
                        </p>
                        {customerPackage.notes ? (
                          <p className="text-sm leading-6 text-muted">{customerPackage.notes}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[260px]">
                      <div className="stat-shell">
                        <p className="stat-label">Sessions left</p>
                        <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">
                          {customerPackage.remainingCredits}
                        </p>
                      </div>
                      <div className="stat-shell">
                        <p className="stat-label">Package size</p>
                        <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">
                          {customerPackage.originalCredits}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-3">
                      <p className="section-kicker">Balance history</p>
                      {customerPackage.transactions.length ? (
                        customerPackage.transactions.map((transaction) => (
                          <div key={transaction.id} className="list-row-quiet">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-semibold text-ink">
                                {getCustomerPackageTransactionLabel(transaction)}
                              </p>
                              <Badge tone={getCustomerPackageTransactionTone(transaction)}>
                                {transaction.resultingCredits} left
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-muted">{transaction.reason}</p>
                            {transaction.notes ? (
                              <p className="mt-1 text-sm leading-6 text-muted">{transaction.notes}</p>
                            ) : null}
                            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                              {compactList([
                                toDateTimeLabel(transaction.createdAt),
                                transaction.createdByUser?.name ?? null,
                              ])}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state">No balance history yet.</div>
                      )}
                    </div>

                    <div className="surface-inset rounded-[24px] p-4">
                      <p className="section-kicker">Manual adjustment</p>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        Add or remove credits with a reason so package history stays clear.
                      </p>
                      <div className="mt-4">
                        <PackageAdjustmentForm
                          customerPackageId={customerPackage.id}
                          redirectTo={`/customers/${customer.id}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : !trialEntitlements.length ? (
              <EmptyState
                title="No balances yet"
                action={
                  <Link
                    href={`/sales/imported-balance?customerId=${customer.id}`}
                    className={buttonStyles({ variant: "tonal", size: "sm" })}
                  >
                    Add balance
                  </Link>
                }
              />
            ) : null}

            {trialEntitlements.length ? (
              <div className="list-row space-y-4">
                <div className="section-header">
                  <div className="space-y-1.5">
                    <p className="section-kicker">Trial</p>
                    <h3 className="font-display text-[1.45rem] leading-none tracking-[-0.04em] text-ink">
                      Trial entitlements
                    </h3>
                  </div>
                  <Badge tone="plum">{remainingTrialEntitlements} left</Badge>
                </div>

                <div className="grid gap-3">
                  {trialEntitlements.map((entitlement) => (
                    <div key={entitlement.id} className="surface-inset rounded-[22px] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="chip-row">
                            <Badge tone={entitlement.active ? "plum" : "neutral"}>
                              {entitlement.active ? "ACTIVE" : "INACTIVE"}
                            </Badge>
                            <Badge tone="outline">Trial</Badge>
                          </div>
                          <p className="mt-3 font-semibold text-ink">{entitlement.classTypeName}</p>
                          <p className="mt-1 text-sm leading-6 text-muted">
                            {compactList([
                              entitlement.packageName,
                              `Purchased ${toShortDate(entitlement.purchaseDate)}`,
                            ])}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-2xl leading-none tracking-[-0.04em] text-ink">
                            {entitlement.remainingQuantity}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                            of {entitlement.originalQuantity} left
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted">
                        Used {entitlement.usedQuantity}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Sheet
          className="scroll-mt-28"
          eyebrow="Client profile"
          title="Details"
          footer={
            <Link
              href={`/recurring?customerId=${customer.id}`}
              className={buttonStyles({ size: "sm", className: "w-full sm:w-auto" })}
            >
              <Repeat2 className="size-4" />
              Recurring
            </Link>
          }
        >
          <div id="profile" className="scroll-mt-28 space-y-6">
            <div className="surface-inset rounded-[24px] p-4">
              <p className="section-kicker">Profile</p>
            </div>

            <CustomerForm
              redirectTo={`/customers/${customer.id}`}
              initialValues={{
                id: customer.id,
                fullName: customer.fullName,
                phone: customer.phone,
                email: customer.email,
                notes: customer.notes,
                tags: customer.tags,
                status: customer.status,
              }}
            />
          </div>

          <div className="soft-divider" />

          <div className="space-y-3">
            <div className="section-header">
              <div className="space-y-2">
                <p className="section-kicker">Imported</p>
                <h3 className="font-display text-[1.5rem] leading-none tracking-[-0.04em] text-ink">
                  Add balance
                </h3>
              </div>
            </div>

            <ImportedBalanceForm
              redirectTo={`/customers/${customer.id}`}
              initialCustomerId={customer.id}
              customers={[{ id: customer.id, fullName: customer.fullName }]}
              classTypes={classTypes}
            />
          </div>

          <div className="soft-divider" />

          <div className="space-y-3">
              <div className="section-header">
                <div className="space-y-2">
                <p className="section-kicker">Recurring</p>
                <h3 className="font-display text-[1.5rem] leading-none tracking-[-0.04em] text-ink">
                  Recurring
                </h3>
              </div>
              <Badge tone="outline">{customer.recurringRules.length}</Badge>
            </div>

            {customer.recurringRules.length ? (
              customer.recurringRules.map((rule) => (
                <div key={rule.id} className="list-row-quiet">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="chip-row">
                        <Badge tone={rule.active ? "sage" : "neutral"}>
                          {rule.active ? "ACTIVE" : "INACTIVE"}
                        </Badge>
                        <Badge tone={rule.classType.category === "GROUP" ? "plum" : "warm"}>
                          {rule.classType.category}
                        </Badge>
                        <Badge tone="outline">{rule.paymentSourceType}</Badge>
                      </div>
                      <div>
                        <p className="font-semibold text-ink">{rule.classType.name}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {compactList([
                            rule.dayOfWeek.replaceAll("_", " "),
                            rule.startTime,
                            rule.instructor?.fullName ?? "No instructor assigned",
                          ])}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No recurring rules yet.</div>
            )}
          </div>
        </Sheet>
      </section>

      <Card id="credit-history" variant="soft" className="scroll-mt-28 space-y-4">
        <div className="section-header">
          <div className="space-y-2">
            <p className="section-kicker">History</p>
            <h2 className="section-title">Credit history</h2>
          </div>
          <Badge tone="outline">Last 50</Badge>
        </div>

        <div className="space-y-3">
          {customer.creditHistory.length ? (
            customer.creditHistory.map((entry) => {
              const note = getCreditHistoryNote(entry.type, entry.note);

              return (
                <div key={entry.id} className="list-row-quiet">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{getCreditHistoryLabel(entry.type)}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {compactList([
                          entry.classType.name,
                          entry.relatedSession ? toDateTimeLabel(entry.relatedSession.startsAt) : null,
                          note,
                        ])}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                        {toShortDate(entry.createdAt)}
                      </p>
                    </div>
                    <Badge tone={getCreditHistoryTone(entry.change)} className="shrink-0">
                      {formatCreditChange(entry.change)}
                    </Badge>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">No history yet.</div>
          )}
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <Card id="trials" className="scroll-mt-28 space-y-4">
          <div className="section-header">
            <div className="space-y-2">
              <p className="section-kicker">Trials</p>
              <h2 className="section-title">Trial packages</h2>
            </div>
            <Badge tone="outline">{trialCountLabel}</Badge>
          </div>

          <div className="space-y-4">
            {customer.trialPackages.length ? (
              customer.trialPackages.map((trialPackage) => (
                <div key={trialPackage.id} className="list-row space-y-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="chip-row">
                        <Badge
                          tone={
                            trialPackage.active && trialPackage.items.some((item) => item.remainingQuantity > 0)
                              ? "plum"
                              : "neutral"
                          }
                        >
                          {trialPackage.active ? "ACTIVE" : "INACTIVE"}
                        </Badge>
                        <Badge tone="outline">
                          {trialPackage.items.reduce((sum, item) => sum + item.remainingQuantity, 0)} remaining
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-display text-[1.7rem] leading-none tracking-[-0.04em] text-ink">
                          {trialPackage.trialPackageTemplate.name}
                        </h3>
                        <p className="text-sm leading-6 text-muted">
                          {compactList([
                            `Purchased ${toShortDate(trialPackage.purchaseDate)}`,
                            formatCurrency(trialPackage.amountPaid.toString()),
                            trialPackage.paymentMethod.replaceAll("_", " "),
                          ])}
                        </p>
                        {trialPackage.notes ? (
                          <p className="text-sm leading-6 text-muted">{trialPackage.notes}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="stat-shell lg:min-w-[190px]">
                      <p className="stat-label">Trial items left</p>
                      <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">
                        {trialPackage.items.reduce((sum, item) => sum + item.remainingQuantity, 0)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {trialPackage.items.map((item) => (
                      <div key={item.id} className="surface-inset rounded-[22px] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink">{item.classType.name}</p>
                            <p className="mt-1 text-sm leading-6 text-muted">
                              {item.remainingQuantity} / {item.originalQuantity} remaining
                            </p>
                          </div>
                          <Badge tone={item.remainingQuantity > 0 ? "plum" : "neutral"}>
                            Used {item.originalQuantity - item.remainingQuantity}
                          </Badge>
                        </div>

                        {item.transactions.length ? (
                          <div className="mt-3 space-y-2">
                            {item.transactions.map((transaction) => (
                              <div key={transaction.id} className="list-row-quiet">
                                <p className="font-semibold text-ink">
                                  {getTrialItemTransactionLabel(transaction)}
                                </p>
                                <p className="mt-1 text-sm leading-6 text-muted">
                                  {transaction.reason}
                                </p>
                                {transaction.notes ? (
                                  <p className="mt-1 text-sm leading-6 text-muted">{transaction.notes}</p>
                                ) : null}
                                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                                  {compactList([
                                    toDateTimeLabel(transaction.createdAt),
                                    transaction.createdByUser?.name ?? null,
                                  ])}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-muted">
                            No history yet.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No trial packages yet"
                action={
                  <Link
                    href={`/sales/trial?customerId=${customer.id}`}
                    className={buttonStyles({ variant: "tonal", size: "sm" })}
                  >
                    Sell trial
                  </Link>
                }
              />
            )}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="section-header">
            <div className="space-y-2">
              <p className="section-kicker">One-offs</p>
              <h2 className="section-title">One-offs</h2>
            </div>
            <Badge tone="outline">{oneOffCountLabel}</Badge>
          </div>

          <div className="space-y-3">
            {customer.singleClassPurchases.length ? (
              customer.singleClassPurchases.map((purchase) => (
                <div key={purchase.id} className="list-row-quiet">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="chip-row">
                        <Badge tone={purchase.category === "GROUP" ? "plum" : "warm"}>
                          {purchase.category}
                        </Badge>
                        <Badge tone={getPurchaseStatusTone(purchase.status)}>{purchase.status}</Badge>
                      </div>
                      <p className="mt-3 font-semibold text-ink">
                        {purchase.classType?.name ?? `${purchase.category} one-off`}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {compactList([
                          formatCurrency(purchase.amountPaid.toString()),
                          purchase.paymentMethod.replaceAll("_", " "),
                          purchase.expiryDate ? `Expires ${toShortDate(purchase.expiryDate)}` : "No expiry",
                        ])}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No one-offs yet"
                action={
                  <Link
                    href={`/sales/single?customerId=${customer.id}`}
                    className={buttonStyles({ variant: "tonal", size: "sm" })}
                  >
                    Sell one-off
                  </Link>
                }
              />
            )}
          </div>
        </Card>

        <Card id="bookings" variant="soft" className="scroll-mt-28 space-y-4">
          <div className="section-header">
            <div className="space-y-2">
              <p className="section-kicker">Booking history</p>
              <h2 className="section-title">Bookings</h2>
            </div>
            <WalletCards className="size-5 text-accent-strong" />
          </div>

          <div className="space-y-3">
            {customer.bookings.length ? (
              customer.bookings.map((booking) => (
                <Link key={booking.id} href={`/sessions/${booking.sessionId}`} className="list-row-quiet block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="chip-row">
                        <Badge tone={getBookingStatusTone(booking.status)}>{booking.status}</Badge>
                        <Badge tone={getPaymentSourceTone(booking.paymentSourceType)}>
                          {booking.paymentSourceType}
                        </Badge>
                        {booking.restoredAt &&
                        !booking.creditDeducted &&
                        !booking.singleUseConsumed &&
                        !booking.trialUseConsumed ? <Badge tone="outline">Restored</Badge> : null}
                      </div>
                      <div>
                        <p className="font-semibold text-ink">{booking.session.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {compactList([
                            toDateTimeLabel(booking.session.startsAt),
                            booking.session.instructor.fullName,
                            booking.session.classType.name,
                            booking.paymentSourceType === "TRIAL"
                              ? booking.customerTrialPackage?.trialPackageTemplate.name ?? "Trial package"
                              : null,
                          ])}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">No bookings yet.</div>
            )}
          </div>
        </Card>
      </section>

      <section id="payments" className="scroll-mt-28 grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
        <Card className="space-y-4">
          <div className="section-header">
            <div className="space-y-2">
              <p className="section-kicker">Payments</p>
              <h2 className="section-title">Payments</h2>
            </div>
            <ReceiptText className="size-5 text-accent-strong" />
          </div>

          <div className="space-y-3">
            {paymentHistory.length ? (
              paymentHistory.map((payment) => (
                <div key={payment.id} className="list-row-quiet">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{payment.label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {compactList([payment.type, payment.method.replaceAll("_", " ")])}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-ink">{formatCurrency(payment.amount)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                        {toLongDate(payment.date)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No payments yet.</div>
            )}
          </div>
        </Card>

        <Card variant="soft" className="space-y-4">
          <div className="section-header">
            <div className="space-y-2">
              <p className="section-kicker">Attendance history</p>
              <h2 className="section-title">Attendance</h2>
            </div>
            <Badge tone="outline">{attendanceHistory.length}</Badge>
          </div>

          <div className="space-y-3">
            {attendanceHistory.length ? (
              attendanceHistory.map((booking) => (
                <div key={booking.id} className="list-row-quiet">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="chip-row">
                        <Badge tone={getBookingStatusTone(booking.status)}>{booking.status}</Badge>
                        <Badge tone={getPaymentSourceTone(booking.paymentSourceType)}>
                          {booking.paymentSourceType}
                        </Badge>
                        {booking.restoredAt &&
                        !booking.creditDeducted &&
                        !booking.singleUseConsumed &&
                        !booking.trialUseConsumed ? <Badge tone="outline">Restored</Badge> : null}
                      </div>
                      <p className="mt-3 font-semibold text-ink">{booking.session.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {compactList([
                          toDateTimeLabel(booking.session.startsAt),
                          booking.session.instructor.fullName,
                          booking.paymentSourceType === "TRIAL"
                            ? booking.customerTrialPackageItem?.classType.name ?? "Trial entitlement"
                            : null,
                        ])}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No attendance yet.</div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
