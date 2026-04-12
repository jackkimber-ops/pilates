import {
  ClassCategory,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = process.env.SEED_ADMIN_DEFAULT_PASSWORD ?? "Pilates123!";
const RESET_ADMIN_PASSWORDS = process.env.SEED_RESET_ADMIN_PASSWORDS === "true";

const CLASS_TYPE_CATALOG = [
  {
    key: "privateReformer",
    name: "Private Reformer",
    category: ClassCategory.PRIVATE,
    defaultSinglePrice: 1_300_000,
    maxCapacity: 1,
    color: "#7b5c71",
  },
  {
    key: "duoReformer",
    name: "Duo Reformer",
    category: ClassCategory.PRIVATE,
    defaultSinglePrice: 1_800_000,
    maxCapacity: 2,
    color: "#9a7566",
  },
  {
    key: "privateMat",
    name: "Private Mat",
    category: ClassCategory.PRIVATE,
    defaultSinglePrice: 900_000,
    maxCapacity: 1,
    color: "#8c8572",
  },
  {
    key: "groupMat",
    name: "Group Mat (Maximum 6)",
    category: ClassCategory.GROUP,
    defaultSinglePrice: 450_000,
    maxCapacity: 6,
    color: "#748679",
  },
] as const;

const PACKAGE_CATALOG = {
  privateReformer: [
    { sessionCount: 10, validityMonths: 3, regularPrice: 13_000_000, packagePrice: 12_100_000 },
    { sessionCount: 20, validityMonths: 6, regularPrice: 26_000_000, packagePrice: 22_400_000 },
    { sessionCount: 40, validityMonths: 12, regularPrice: 52_000_000, packagePrice: 43_200_000 },
    { sessionCount: 60, validityMonths: 24, regularPrice: 78_000_000, packagePrice: 62_400_000 },
  ],
  duoReformer: [
    { sessionCount: 10, validityMonths: 3, regularPrice: 18_000_000, packagePrice: 16_800_000 },
    { sessionCount: 20, validityMonths: 6, regularPrice: 36_000_000, packagePrice: 31_000_000 },
    { sessionCount: 40, validityMonths: 12, regularPrice: 72_000_000, packagePrice: 59_800_000 },
    { sessionCount: 60, validityMonths: 24, regularPrice: 108_000_000, packagePrice: 86_400_000 },
  ],
  privateMat: [
    { sessionCount: 10, validityMonths: 3, regularPrice: 9_000_000, packagePrice: 8_400_000 },
    { sessionCount: 20, validityMonths: 6, regularPrice: 18_000_000, packagePrice: 15_000_000 },
    { sessionCount: 40, validityMonths: 12, regularPrice: 36_000_000, packagePrice: 29_900_000 },
    { sessionCount: 60, validityMonths: 24, regularPrice: 54_000_000, packagePrice: 43_200_000 },
  ],
  groupMat: [
    { sessionCount: 10, validityMonths: 3, regularPrice: 4_500_000, packagePrice: 3_500_000 },
    { sessionCount: 20, validityMonths: 6, regularPrice: 9_000_000, packagePrice: 6_500_000 },
    { sessionCount: 40, validityMonths: 12, regularPrice: 18_000_000, packagePrice: 12_600_000 },
    { sessionCount: 60, validityMonths: 24, regularPrice: 27_000_000, packagePrice: 17_900_000 },
  ],
} as const;

const TRIAL_PACKAGE_CATALOG = [
  {
    name: "Intro Trial A",
    price: 1_700_000,
    notes: "1 x Private Mat / 1 x Private Reformer / 1 x Group Mat (Maximum 6)",
    items: [
      { classTypeKey: "privateMat", quantity: 1 },
      { classTypeKey: "privateReformer", quantity: 1 },
      { classTypeKey: "groupMat", quantity: 1 },
    ],
  },
  {
    name: "Intro Trial B",
    price: 3_000_000,
    notes: "3 x Private Reformer",
    items: [{ classTypeKey: "privateReformer", quantity: 3 }],
  },
] as const;

async function ensureInstructor(fullName: string) {
  const existing = await prisma.instructor.findFirst({
    where: { fullName },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return prisma.instructor.update({
      where: { id: existing.id },
      data: {
        fullName,
        active: true,
      },
    });
  }

  return prisma.instructor.create({
    data: {
      fullName,
      active: true,
    },
  });
}

async function ensureAdminUser(input: {
  name: string;
  email: string;
  instructorId: string;
  passwordHash: string;
}) {
  const existing = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    return prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: UserRole.ADMIN,
        instructorId: input.instructorId,
      },
    });
  }

  return prisma.user.update({
    where: {
      email: input.email,
    },
    data: {
      name: input.name,
      role: UserRole.ADMIN,
      instructorId: input.instructorId,
      ...(RESET_ADMIN_PASSWORDS ? { passwordHash: input.passwordHash } : {}),
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const [phuongInstructor, phoebeInstructor] = await Promise.all([
    ensureInstructor("Phuong"),
    ensureInstructor("Phoebe"),
  ]);

  await Promise.all([
    ensureAdminUser({
      name: "Phuong",
      email: "phuong@reform.local",
      instructorId: phuongInstructor.id,
      passwordHash,
    }),
    ensureAdminUser({
      name: "Phoebe",
      email: "phoebe@reform.local",
      instructorId: phoebeInstructor.id,
      passwordHash,
    }),
  ]);

  const classTypesByKey = {} as Record<
    (typeof CLASS_TYPE_CATALOG)[number]["key"],
    Awaited<ReturnType<typeof prisma.classType.upsert>>
  >;

  for (const classType of CLASS_TYPE_CATALOG) {
    classTypesByKey[classType.key] = await prisma.classType.upsert({
      where: {
        name: classType.name,
      },
      update: {
        category: classType.category,
        durationMinutes: 60,
        defaultSinglePrice: classType.defaultSinglePrice,
        maxCapacity: classType.maxCapacity,
        color: classType.color,
        active: true,
      },
      create: {
        name: classType.name,
        category: classType.category,
        durationMinutes: 60,
        defaultSinglePrice: classType.defaultSinglePrice,
        maxCapacity: classType.maxCapacity,
        color: classType.color,
        active: true,
      },
    });
  }

  let packageTemplateCount = 0;

  for (const [classTypeKey, packageOptions] of Object.entries(PACKAGE_CATALOG)) {
    const classType = classTypesByKey[classTypeKey as keyof typeof classTypesByKey];

    for (const option of packageOptions) {
      await prisma.packageTemplate.upsert({
        where: {
          name: `${classType.name} ${option.sessionCount}`,
        },
        update: {
          classTypeId: classType.id,
          category: classType.category,
          sessionCount: option.sessionCount,
          validityMonths: option.validityMonths,
          regularPrice: option.regularPrice,
          packagePrice: option.packagePrice,
          active: true,
        },
        create: {
          classTypeId: classType.id,
          name: `${classType.name} ${option.sessionCount}`,
          category: classType.category,
          sessionCount: option.sessionCount,
          validityMonths: option.validityMonths,
          regularPrice: option.regularPrice,
          packagePrice: option.packagePrice,
          active: true,
        },
      });

      packageTemplateCount += 1;
    }
  }

  for (const template of TRIAL_PACKAGE_CATALOG) {
    const savedTemplate = await prisma.trialPackageTemplate.upsert({
      where: {
        name: template.name,
      },
      update: {
        price: template.price,
        notes: template.notes,
        active: true,
      },
      create: {
        name: template.name,
        price: template.price,
        notes: template.notes,
        active: true,
      },
    });

    await prisma.trialPackageTemplateItem.deleteMany({
      where: {
        trialPackageTemplateId: savedTemplate.id,
      },
    });

    await prisma.trialPackageTemplateItem.createMany({
      data: template.items.map((item) => ({
        trialPackageTemplateId: savedTemplate.id,
        classTypeId: classTypesByKey[item.classTypeKey].id,
        quantity: item.quantity,
      })),
    });
  }

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.instructor.count(),
    prisma.classType.count(),
    prisma.packageTemplate.count(),
    prisma.trialPackageTemplate.count(),
    prisma.customer.count(),
  ]);

  console.log("Reference seed complete.");
  console.log("Admin emails: phuong@reform.local, phoebe@reform.local");
  if (RESET_ADMIN_PASSWORDS) {
    console.log(`Admin password reset to: ${DEFAULT_PASSWORD}`);
  } else {
    console.log("Admin passwords preserved.");
  }
  console.log(
    `Users: ${counts[0]}, instructors: ${counts[1]}, class types: ${counts[2]}, package templates: ${counts[3]}, trial templates: ${counts[4]}, customers: ${counts[5]}.`,
  );
  console.log(`Configured package templates: ${packageTemplateCount}.`);
  console.log("Demo customers are not seeded by default.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
