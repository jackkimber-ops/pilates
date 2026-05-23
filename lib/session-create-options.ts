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
  const [classTypes, instructors, customers, customerPackageGroups, trialItems] = await Promise.all([
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
    prisma.customerTrialPackageItem.findMany({
      where: {
        remainingQuantity: {
          gt: 0,
        },
        customerTrialPackage: {
          active: true,
          customer: {
            status: "ACTIVE",
          },
        },
      },
      select: {
        id: true,
        classTypeId: true,
        originalQuantity: true,
        remainingQuantity: true,
        classType: {
          select: {
            name: true,
          },
        },
        customerTrialPackage: {
          select: {
            customerId: true,
            purchaseDate: true,
            trialPackageTemplate: {
              select: {
                name: true,
              },
            },
          },
        },
        bookings: {
          where: {
            status: {
              not: "CANCELLED",
            },
          },
          select: {
            trialUseConsumed: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
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

  const trialAvailability = trialItems
    .map((item) => {
      const reservedQuantity = item.bookings.filter((booking) => !booking.trialUseConsumed).length;
      const availableQuantity = item.remainingQuantity - reservedQuantity;

      return {
        customerId: item.customerTrialPackage.customerId,
        classTypeId: item.classTypeId,
        customerTrialPackageItemId: item.id,
        templateName: item.customerTrialPackage.trialPackageTemplate.name,
        classTypeName: item.classType.name,
        originalQuantity: item.originalQuantity,
        remainingQuantity: item.remainingQuantity,
        availableQuantity,
      };
    })
    .filter((item) => item.availableQuantity > 0)
    .sort((left, right) => {
      if (left.customerId !== right.customerId) {
        return left.customerId.localeCompare(right.customerId);
      }

      if (left.classTypeName !== right.classTypeName) {
        return left.classTypeName.localeCompare(right.classTypeName);
      }

      return left.templateName.localeCompare(right.templateName);
    });

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
    trialAvailability,
    defaultInstructorId: defaultInstructor?.id ?? "",
  };
}
