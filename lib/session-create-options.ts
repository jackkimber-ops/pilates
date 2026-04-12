import { prisma } from "@/lib/prisma";

type SessionCreateUser = {
  id: string;
  name: string;
  instructorId?: string | null;
};

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase();
}

export async function getSessionCreateOptions(input: {
  balanceValidFrom: Date;
  user?: SessionCreateUser | null;
}) {
  const [classTypes, instructors, customers, customerPackageGroups] = await Promise.all([
    prisma.classType.findMany({
      where: {
        active: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        maxCapacity: true,
        durationMinutes: true,
      },
    }),
    prisma.instructor.findMany({
      where: {
        active: true,
      },
      orderBy: {
        fullName: "asc",
      },
      select: {
        id: true,
        fullName: true,
      },
    }),
    prisma.customer.findMany({
      where: {
        status: "ACTIVE",
      },
      orderBy: {
        fullName: "asc",
      },
      select: {
        id: true,
        fullName: true,
      },
    }),
    prisma.customerPackage.groupBy({
      by: ["customerId", "classTypeId", "sourceType"],
      where: {
        active: true,
        remainingCredits: {
          gt: 0,
        },
        OR: [{ expiryDate: null }, { expiryDate: { gte: input.balanceValidFrom } }],
      },
      _sum: {
        remainingCredits: true,
      },
      _min: {
        purchaseDate: true,
      },
      orderBy: {
        _min: {
          purchaseDate: "asc",
        },
      },
    }),
  ]);

  const classTypeNames = new Map(classTypes.map((classType) => [classType.id, classType.name]));

  const packageAvailability = Array.from(
    customerPackageGroups
      .reduce((map, customerPackage) => {
        const key = `${customerPackage.customerId}:${customerPackage.classTypeId}`;
        const existing = map.get(key);
        const remainingCredits = customerPackage._sum.remainingCredits ?? 0;
        const classTypeName = classTypeNames.get(customerPackage.classTypeId) ?? "Balance";

        if (existing) {
          existing.totalRemainingCredits += remainingCredits;
          return map;
        }

        map.set(key, {
          customerId: customerPackage.customerId,
          classTypeId: customerPackage.classTypeId,
          totalRemainingCredits: remainingCredits,
          nextPackageName:
            customerPackage.sourceType === "IMPORTED"
              ? `${classTypeName} imported balance`
              : `${classTypeName} package`,
          nextPackageRemainingCredits: remainingCredits,
          sourceType: customerPackage.sourceType,
        });

        return map;
      }, new Map<
        string,
        {
          customerId: string;
          classTypeId: string;
          totalRemainingCredits: number;
          nextPackageName: string;
          nextPackageRemainingCredits: number;
          sourceType: "PACKAGE_SALE" | "IMPORTED";
        }
      >())
      .values(),
  );

  const defaultInstructor =
    (input.user?.instructorId
      ? instructors.find((instructor) => instructor.id === input.user?.instructorId)
      : undefined) ??
    (input.user?.name
      ? instructors.find(
          (instructor) => normalizeName(instructor.fullName) === normalizeName(input.user!.name),
        )
      : undefined) ??
    instructors[0];

  return {
    classTypes,
    instructors,
    customers,
    packageAvailability,
    defaultInstructorId: defaultInstructor?.id ?? "",
  };
}
