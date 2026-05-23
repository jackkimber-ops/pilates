import Link from "next/link";
import { Filter, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { compactList } from "@/lib/utils";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const status = params.status === "ACTIVE" || params.status === "INACTIVE" ? params.status : "ALL";
  const today = new Date();

  const customerWhere: Prisma.CustomerWhereInput = {
    status: status === "ALL" ? undefined : status,
    OR: search
      ? [
          { fullName: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ]
      : undefined,
  };

  const [customers, activeBalanceGroups, unusedSingleGroups] = await Promise.all([
    prisma.customer.findMany({
      where: customerWhere,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        tags: true,
        status: true,
      },
      orderBy: [{ status: "asc" }, { fullName: "asc" }],
    }),
    prisma.customerPackage.groupBy({
      by: ["customerId"],
      where: {
        customer: customerWhere,
        active: true,
        remainingCredits: {
          gt: 0,
        },
        OR: [{ expiryDate: null }, { expiryDate: { gte: today } }],
      },
      _sum: {
        remainingCredits: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.singleClassPurchase.groupBy({
      by: ["customerId"],
      where: {
        customer: customerWhere,
        status: "UNUSED",
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const balanceMap = new Map(
    activeBalanceGroups.map((group) => [
      group.customerId,
      {
        totalCredits: group._sum.remainingCredits ?? 0,
        activePackages: group._count._all,
      },
    ]),
  );

  const unusedSinglesMap = new Map(
    unusedSingleGroups.map((group) => [group.customerId, group._count._all]),
  );

  const customerSummaries = customers.map((customer) => {
    const balanceSummary = balanceMap.get(customer.id);
    const totalCredits = balanceSummary?.totalCredits ?? 0;
    const unusedSingles = unusedSinglesMap.get(customer.id) ?? 0;

    return {
      customer,
      activePackageCount: balanceSummary?.activePackages ?? 0,
      totalCredits,
      unusedSingles,
    };
  });

  const visibleCredits = customerSummaries.reduce((sum, item) => sum + item.totalCredits, 0);
  const activeCount = customerSummaries.filter((item) => item.customer.status === "ACTIVE").length;
  const unusedSingleCount = customerSummaries.reduce((sum, item) => sum + item.unusedSingles, 0);

  return (
    <div className="page-stack">
      <PageHeader
        title="Customers"
        actions={
          <Link href="/customers/new" className={buttonStyles({ size: "lg" })}>
            <Plus className="size-4" />
            Add customer
          </Link>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[0.86fr_1.14fr]">
        <Card variant="tint" className="space-y-5">
          <h2 className="section-title">Overview</h2>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="stat-shell">
              <p className="stat-label">Visible customers</p>
              <p className="metric-number mt-3">{customerSummaries.length}</p>
            </div>
            <div className="stat-shell">
              <p className="stat-label">Active clients</p>
              <p className="metric-number mt-3">{activeCount}</p>
            </div>
            <div className="stat-shell">
              <p className="stat-label">Sessions in view</p>
              <p className="metric-number mt-3">{visibleCredits}</p>
              <p className="metric-caption">{unusedSingleCount} unused one-offs</p>
            </div>
          </div>
        </Card>

        <Card variant="soft" className="space-y-4">
          <div className="section-header">
            <h2 className="section-title">Search</h2>
            <Badge tone="outline">Live</Badge>
          </div>

          <form className="grid gap-3 md:grid-cols-[1fr_190px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                name="q"
                defaultValue={search}
                className="pl-11"
                placeholder="Name, phone, or email"
              />
            </div>
            <div className="relative">
              <Select name="status" defaultValue={status}>
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active only</option>
                <option value="INACTIVE">Inactive only</option>
              </Select>
              <Filter className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            </div>
            <button type="submit" className={buttonStyles({ variant: "secondary" })}>
              Apply
            </button>
          </form>
        </Card>
      </section>

      <Card className="space-y-5 p-0">
        <div className="flex flex-col gap-2 px-6 pt-6 md:flex-row md:items-end md:justify-between">
          <h2 className="section-title">Customers</h2>
        </div>

        {customerSummaries.length ? (
          <div className="space-y-3 px-4 pb-4 md:px-5 md:pb-5">
            {customerSummaries.map(({ customer, activePackageCount, totalCredits, unusedSingles }) => (
              <Link key={customer.id} href={`/customers/${customer.id}`} prefetch={false} className="list-row block">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-3">
                    <div className="chip-row">
                      <Badge tone={customer.status === "ACTIVE" ? "sage" : "neutral"}>
                        {customer.status}
                      </Badge>
                      {customer.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} tone="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <h2 className="font-display text-[1.9rem] leading-none tracking-[-0.04em] text-ink">
                        {customer.fullName}
                      </h2>
                      <p className="text-sm leading-6 text-muted">
                        {compactList([customer.phone ?? null, customer.email ?? null]) ||
                          "No contact details."}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[360px]">
                    <div className="stat-shell">
                      <p className="stat-label">Sessions</p>
                      <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">{totalCredits}</p>
                    </div>
                    <div className="stat-shell">
                      <p className="stat-label">Packages</p>
                      <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">
                        {activePackageCount}
                      </p>
                    </div>
                    <div className="stat-shell">
                      <p className="stat-label">One-offs</p>
                      <p className="mt-2 text-2xl font-display tracking-[-0.04em] text-ink">{unusedSingles}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-6 pb-6">
            <EmptyState
              title="No customers"
              description="Try another search."
              action={
                <Link href="/customers/new" className={buttonStyles({ variant: "tonal", size: "sm" })}>
                  Add customer
                </Link>
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}
