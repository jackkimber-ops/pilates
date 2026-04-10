import {
  BookingStatus,
  ClassCategory,
  CustomerStatus,
  CustomerPackageSourceType,
  CustomerPackageTransactionType,
  CustomerTrialPackageItemTransactionType,
  PaymentMethod,
  PaymentSourceType,
  PrismaClient,
  SessionStatus,
  SingleClassPurchaseStatus,
  UserRole,
  Weekday,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addMonths, addWeeks, endOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Ho_Chi_Minh";
const DEFAULT_PASSWORD = process.env.SEED_ADMIN_DEFAULT_PASSWORD ?? "Pilates123!";

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

function zonedDate(date: string, time = "00:00") {
  return fromZonedTime(`${date}T${time}:00`, APP_TIMEZONE);
}

function toDateOnly(date: Date) {
  return zonedDate(formatInTimeZone(date, APP_TIMEZONE, "yyyy-MM-dd"));
}

function currentDateString() {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

function shiftDate(base: string, days: number) {
  return formatInTimeZone(addDays(zonedDate(base, "12:00"), days), APP_TIMEZONE, "yyyy-MM-dd");
}

function nextMatchingWeekday(startDate: string, weekday: Weekday) {
  let cursor = zonedDate(startDate, "00:00");

  while (formatInTimeZone(cursor, APP_TIMEZONE, "EEEE").toUpperCase() !== weekday) {
    cursor = addDays(cursor, 1);
  }

  return formatInTimeZone(cursor, APP_TIMEZONE, "yyyy-MM-dd");
}

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const today = currentDateString();
  const nextWednesday = nextMatchingWeekday(shiftDate(today, 1), Weekday.WEDNESDAY);

  await prisma.auditLog.deleteMany();
  await prisma.customerPackageTransaction.deleteMany();
  await prisma.customerTrialPackageItemTransaction.deleteMany();
  await prisma.packageAdjustment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.adminSession.deleteMany();
  await prisma.session.deleteMany();
  await prisma.recurringBookingRule.deleteMany();
  await prisma.customerTrialPackageItem.deleteMany();
  await prisma.customerTrialPackage.deleteMany();
  await prisma.trialPackageTemplateItem.deleteMany();
  await prisma.trialPackageTemplate.deleteMany();
  await prisma.customerPackage.deleteMany();
  await prisma.singleClassPurchase.deleteMany();
  await prisma.packageTemplate.deleteMany();
  await prisma.classType.deleteMany();
  await prisma.instructor.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  const [ownerUser, opsUser] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Phuong",
        email: "phuong@reform.local",
        passwordHash,
        role: UserRole.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        name: "Phoebe",
        email: "phoebe@reform.local",
        passwordHash,
        role: UserRole.ADMIN,
      },
    }),
  ]);

  const [phuongInstructor, phoebeInstructor] = await Promise.all([
    prisma.instructor.create({
      data: {
        fullName: "Phuong",
      },
    }),
    prisma.instructor.create({
      data: {
        fullName: "Phoebe",
      },
    }),
  ]);

  const classTypesByKey: Record<string, Awaited<ReturnType<typeof prisma.classType.create>>> = {};

  for (const classType of CLASS_TYPE_CATALOG) {
    classTypesByKey[classType.key] = await prisma.classType.create({
      data: {
        name: classType.name,
        category: classType.category,
        durationMinutes: 60,
        defaultSinglePrice: classType.defaultSinglePrice,
        maxCapacity: classType.maxCapacity,
        color: classType.color,
      },
    });
  }

  const templates = await Promise.all(
    Object.entries(PACKAGE_CATALOG).flatMap(([classTypeKey, packageOptions]) =>
      packageOptions.map((option) =>
        prisma.packageTemplate.create({
          data: {
            classTypeId: classTypesByKey[classTypeKey as keyof typeof classTypesByKey].id,
            name: `${classTypesByKey[classTypeKey as keyof typeof classTypesByKey].name} ${option.sessionCount}`,
            category: classTypesByKey[classTypeKey as keyof typeof classTypesByKey].category,
            sessionCount: option.sessionCount,
            validityMonths: option.validityMonths,
            regularPrice: option.regularPrice,
            packagePrice: option.packagePrice,
          },
        }),
      ),
    ),
  );

  const templateByName = Object.fromEntries(templates.map((template) => [template.name, template])) as Record<
    string,
    (typeof templates)[number]
  >;

  const trialTemplates = await Promise.all(
    TRIAL_PACKAGE_CATALOG.map((template) =>
      prisma.trialPackageTemplate.create({
        data: {
          name: template.name,
          price: template.price,
          notes: template.notes,
          items: {
            create: template.items.map((item) => ({
              classTypeId: classTypesByKey[item.classTypeKey].id,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: true,
        },
      }),
    ),
  );

  const trialTemplateByName = Object.fromEntries(
    trialTemplates.map((template) => [template.name, template]),
  ) as Record<string, (typeof trialTemplates)[number]>;

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        fullName: "Maya Rivera",
        phone: "081-555-0101",
        email: "maya@example.com",
        notes: "Prefers early classes and a calm mat corner.",
        status: CustomerStatus.ACTIVE,
        tags: ["VIP", "Morning"],
      },
    }),
    prisma.customer.create({
      data: {
        fullName: "Daniel Kim",
        phone: "081-555-0102",
        email: "daniel@example.com",
        notes: "Regular group mat client who likes a mid-week standing spot.",
        status: CustomerStatus.ACTIVE,
        tags: ["Beginner"],
      },
    }),
    prisma.customer.create({
      data: {
        fullName: "Sofia Tan",
        phone: "081-555-0103",
        email: "sofia@example.com",
        notes: "Has knee sensitivity and prefers reformer work.",
        status: CustomerStatus.ACTIVE,
        tags: ["Private"],
      },
    }),
    prisma.customer.create({
      data: {
        fullName: "Ava Patel",
        phone: "081-555-0104",
        email: "ava@example.com",
        notes: "Expired package demo customer.",
        status: CustomerStatus.ACTIVE,
      },
    }),
    prisma.customer.create({
      data: {
        fullName: "Lena Morris",
        phone: "081-555-0105",
        email: "lena@example.com",
        notes: "Inactive sample customer.",
        status: CustomerStatus.INACTIVE,
      },
    }),
    prisma.customer.create({
      data: {
        fullName: "Linh Tran",
        phone: "081-555-0106",
        email: "linh@example.com",
        notes: "New client using Intro Trial A.",
        status: CustomerStatus.ACTIVE,
        tags: ["Trial"],
      },
    }),
    prisma.customer.create({
      data: {
        fullName: "Minh Le",
        phone: "081-555-0107",
        email: "minh@example.com",
        notes: "New client using Intro Trial B.",
        status: CustomerStatus.ACTIVE,
        tags: ["Trial", "Reformer"],
      },
    }),
  ]);

  const [maya, daniel, sofia, ava, , linh, minh] = customers;

  const mayaGroupPackageTemplate = templateByName["Group Mat (Maximum 6) 10"];
  const danielGroupPackageTemplate = templateByName["Group Mat (Maximum 6) 20"];
  const sofiaPrivatePackageTemplate = templateByName["Private Reformer 10"];
  const avaPrivatePackageTemplate = templateByName["Private Mat 20"];

  const mayaGroupPackage = await prisma.customerPackage.create({
    data: {
      customerId: maya.id,
      packageTemplateId: mayaGroupPackageTemplate.id,
      classTypeId: classTypesByKey.groupMat.id,
      sourceType: CustomerPackageSourceType.PACKAGE_SALE,
      category: ClassCategory.GROUP,
      originalCredits: mayaGroupPackageTemplate.sessionCount,
      remainingCredits: 2,
      purchaseDate: zonedDate(shiftDate(today, -50)),
      expiryDate: endOfDay(
        addMonths(zonedDate(shiftDate(today, -50)), mayaGroupPackageTemplate.validityMonths),
      ),
      amountPaid: mayaGroupPackageTemplate.packagePrice,
      paymentMethod: PaymentMethod.PROMPTPAY,
      notes: "Low balance sample package.",
    },
  });

  await prisma.customerPackage.create({
    data: {
      customerId: daniel.id,
      packageTemplateId: danielGroupPackageTemplate.id,
      classTypeId: classTypesByKey.groupMat.id,
      sourceType: CustomerPackageSourceType.PACKAGE_SALE,
      category: ClassCategory.GROUP,
      originalCredits: danielGroupPackageTemplate.sessionCount,
      remainingCredits: 18,
      purchaseDate: zonedDate(shiftDate(today, -10)),
      expiryDate: endOfDay(
        addMonths(zonedDate(shiftDate(today, -10)), danielGroupPackageTemplate.validityMonths),
      ),
      amountPaid: danielGroupPackageTemplate.packagePrice,
      paymentMethod: PaymentMethod.CARD,
      notes: "Recent group mat package sale.",
    },
  });

  await prisma.customerPackage.create({
    data: {
      customerId: sofia.id,
      packageTemplateId: sofiaPrivatePackageTemplate.id,
      classTypeId: classTypesByKey.privateReformer.id,
      sourceType: CustomerPackageSourceType.PACKAGE_SALE,
      category: ClassCategory.PRIVATE,
      originalCredits: sofiaPrivatePackageTemplate.sessionCount,
      remainingCredits: 5,
      purchaseDate: zonedDate(shiftDate(today, -20)),
      expiryDate: endOfDay(
        addMonths(zonedDate(shiftDate(today, -20)), sofiaPrivatePackageTemplate.validityMonths),
      ),
      amountPaid: sofiaPrivatePackageTemplate.packagePrice,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "Private reformer starter pack.",
    },
  });

  await prisma.customerPackage.create({
    data: {
      customerId: ava.id,
      packageTemplateId: avaPrivatePackageTemplate.id,
      classTypeId: classTypesByKey.privateMat.id,
      sourceType: CustomerPackageSourceType.PACKAGE_SALE,
      category: ClassCategory.PRIVATE,
      originalCredits: avaPrivatePackageTemplate.sessionCount,
      remainingCredits: 7,
      purchaseDate: zonedDate(shiftDate(today, -390)),
      expiryDate: endOfDay(
        addMonths(zonedDate(shiftDate(today, -390)), avaPrivatePackageTemplate.validityMonths),
      ),
      amountPaid: avaPrivatePackageTemplate.packagePrice,
      paymentMethod: PaymentMethod.CASH,
      notes: "Expired package for dashboard visibility.",
    },
  });

  await prisma.packageAdjustment.create({
    data: {
      customerPackageId: mayaGroupPackage.id,
      deltaCredits: 1,
      reason: "Make-up session credit after instructor change.",
      adjustedByUserId: ownerUser.id,
    },
  });

  const mayaImportedPrivateMatBalance = await prisma.customerPackage.create({
    data: {
      customerId: maya.id,
      classTypeId: classTypesByKey.privateMat.id,
      sourceType: CustomerPackageSourceType.IMPORTED,
      category: ClassCategory.PRIVATE,
      originalCredits: 8,
      remainingCredits: 1,
      purchaseDate: zonedDate(shiftDate(today, -5)),
      expiryDate: endOfDay(addMonths(zonedDate(today), 2)),
      notes: "Imported from previous system",
    },
  });

  const introTrialATemplate = trialTemplateByName["Intro Trial A"];
  const introTrialBTemplate = trialTemplateByName["Intro Trial B"];

  const linhTrialA = await prisma.customerTrialPackage.create({
    data: {
      customerId: linh.id,
      trialPackageTemplateId: introTrialATemplate.id,
      purchaseDate: zonedDate(shiftDate(today, -7)),
      amountPaid: introTrialATemplate.price,
      paymentMethod: PaymentMethod.PROMPTPAY,
      notes: "Sample partially used intro trial.",
      items: {
        create: [
          {
            classTypeId: classTypesByKey.privateMat.id,
            originalQuantity: 1,
            remainingQuantity: 1,
          },
          {
            classTypeId: classTypesByKey.privateReformer.id,
            originalQuantity: 1,
            remainingQuantity: 0,
          },
          {
            classTypeId: classTypesByKey.groupMat.id,
            originalQuantity: 1,
            remainingQuantity: 1,
          },
        ],
      },
    },
    include: {
      items: true,
    },
  });

  const minhTrialB = await prisma.customerTrialPackage.create({
    data: {
      customerId: minh.id,
      trialPackageTemplateId: introTrialBTemplate.id,
      purchaseDate: zonedDate(shiftDate(today, -4)),
      amountPaid: introTrialBTemplate.price,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "Sample reformer-only intro trial.",
      items: {
        create: [
          {
            classTypeId: classTypesByKey.privateReformer.id,
            originalQuantity: 3,
            remainingQuantity: 2,
          },
        ],
      },
    },
    include: {
      items: true,
    },
  });

  const linhTrialAReformerItem = linhTrialA.items.find((item) => item.classTypeId === classTypesByKey.privateReformer.id);
  const linhTrialAGroupItem = linhTrialA.items.find((item) => item.classTypeId === classTypesByKey.groupMat.id);
  const minhTrialBReformerItem = minhTrialB.items.find((item) => item.classTypeId === classTypesByKey.privateReformer.id);

  const mayaGroupSingle = await prisma.singleClassPurchase.create({
    data: {
      customerId: maya.id,
      category: ClassCategory.GROUP,
      classTypeId: classTypesByKey.groupMat.id,
      purchaseDate: zonedDate(shiftDate(today, -2)),
      amountPaid: classTypesByKey.groupMat.defaultSinglePrice,
      paymentMethod: PaymentMethod.CARD,
      status: SingleClassPurchaseStatus.UNUSED,
      expiryDate: endOfDay(addWeeks(zonedDate(today), 3)),
      notes: "Unused group mat one-off for dashboard.",
    },
  });

  const sofiaDuoSingle = await prisma.singleClassPurchase.create({
    data: {
      customerId: sofia.id,
      category: ClassCategory.PRIVATE,
      classTypeId: classTypesByKey.duoReformer.id,
      purchaseDate: zonedDate(shiftDate(today, -1)),
      amountPaid: classTypesByKey.duoReformer.defaultSinglePrice,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      status: SingleClassPurchaseStatus.UNUSED,
      expiryDate: endOfDay(addWeeks(zonedDate(today), 2)),
      notes: "Booked duo reformer one-off.",
    },
  });

  await prisma.singleClassPurchase.create({
    data: {
      customerId: sofia.id,
      category: ClassCategory.PRIVATE,
      classTypeId: classTypesByKey.privateReformer.id,
      purchaseDate: zonedDate(shiftDate(today, -15)),
      amountPaid: classTypesByKey.privateReformer.defaultSinglePrice,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      status: SingleClassPurchaseStatus.USED,
      expiryDate: endOfDay(addWeeks(zonedDate(today), 1)),
      notes: "Used sample single class.",
    },
  });

  const yesterdayGroupSession = await prisma.session.create({
    data: {
      classTypeId: classTypesByKey.groupMat.id,
      instructorId: phuongInstructor.id,
      title: classTypesByKey.groupMat.name,
      date: toDateOnly(zonedDate(shiftDate(today, -1))),
      startTime: "08:00",
      endTime: "09:00",
      startsAt: zonedDate(shiftDate(today, -1), "08:00"),
      endsAt: zonedDate(shiftDate(today, -1), "09:00"),
      capacity: classTypesByKey.groupMat.maxCapacity,
      status: SessionStatus.COMPLETED,
      notes: "Completed sample group mat session.",
    },
  });

  const todayGroupSession = await prisma.session.create({
    data: {
      classTypeId: classTypesByKey.groupMat.id,
      instructorId: phoebeInstructor.id,
      title: classTypesByKey.groupMat.name,
      date: toDateOnly(zonedDate(today)),
      startTime: "09:00",
      endTime: "10:00",
      startsAt: zonedDate(today, "09:00"),
      endsAt: zonedDate(today, "10:00"),
      capacity: classTypesByKey.groupMat.maxCapacity,
      status: SessionStatus.SCHEDULED,
      notes: "Strong morning group mat class.",
    },
  });

  const todayDuoSession = await prisma.session.create({
    data: {
      classTypeId: classTypesByKey.duoReformer.id,
      instructorId: phuongInstructor.id,
      title: classTypesByKey.duoReformer.name,
      date: toDateOnly(zonedDate(today)),
      startTime: "13:00",
      endTime: "14:00",
      startsAt: zonedDate(today, "13:00"),
      endsAt: zonedDate(today, "14:00"),
      capacity: classTypesByKey.duoReformer.maxCapacity,
      status: SessionStatus.SCHEDULED,
      notes: "Duo reformer sample session.",
    },
  });

  const tomorrowPrivateSession = await prisma.session.create({
    data: {
      classTypeId: classTypesByKey.privateReformer.id,
      instructorId: phuongInstructor.id,
      title: classTypesByKey.privateReformer.name,
      date: toDateOnly(zonedDate(shiftDate(today, 1))),
      startTime: "11:00",
      endTime: "12:00",
      startsAt: zonedDate(shiftDate(today, 1), "11:00"),
      endsAt: zonedDate(shiftDate(today, 1), "12:00"),
      capacity: classTypesByKey.privateReformer.maxCapacity,
      status: SessionStatus.SCHEDULED,
      notes: "Private reformer coaching.",
    },
  });

  const nextWeekStandingSession = await prisma.session.create({
    data: {
      classTypeId: classTypesByKey.groupMat.id,
      instructorId: phoebeInstructor.id,
      title: classTypesByKey.groupMat.name,
      date: toDateOnly(zonedDate(nextWednesday)),
      startTime: "08:00",
      endTime: "09:00",
      startsAt: zonedDate(nextWednesday, "08:00"),
      endsAt: zonedDate(nextWednesday, "09:00"),
      capacity: classTypesByKey.groupMat.maxCapacity,
      status: SessionStatus.SCHEDULED,
      notes: "Recurring demo session.",
    },
  });

  const pastTrialReformerSession = await prisma.session.create({
    data: {
      classTypeId: classTypesByKey.privateReformer.id,
      instructorId: phuongInstructor.id,
      title: classTypesByKey.privateReformer.name,
      date: toDateOnly(zonedDate(shiftDate(today, -3))),
      startTime: "12:00",
      endTime: "13:00",
      startsAt: zonedDate(shiftDate(today, -3), "12:00"),
      endsAt: zonedDate(shiftDate(today, -3), "13:00"),
      capacity: classTypesByKey.privateReformer.maxCapacity,
      status: SessionStatus.COMPLETED,
      notes: "Completed private reformer trial session.",
    },
  });

  const futureTrialGroupSession = await prisma.session.create({
    data: {
      classTypeId: classTypesByKey.groupMat.id,
      instructorId: phoebeInstructor.id,
      title: classTypesByKey.groupMat.name,
      date: toDateOnly(zonedDate(shiftDate(today, 2))),
      startTime: "09:00",
      endTime: "10:00",
      startsAt: zonedDate(shiftDate(today, 2), "09:00"),
      endsAt: zonedDate(shiftDate(today, 2), "10:00"),
      capacity: classTypesByKey.groupMat.maxCapacity,
      status: SessionStatus.SCHEDULED,
      notes: "Upcoming group mat trial session.",
    },
  });

  const futureTrialReformerSession = await prisma.session.create({
    data: {
      classTypeId: classTypesByKey.privateReformer.id,
      instructorId: phuongInstructor.id,
      title: classTypesByKey.privateReformer.name,
      date: toDateOnly(zonedDate(shiftDate(today, 2))),
      startTime: "11:00",
      endTime: "12:00",
      startsAt: zonedDate(shiftDate(today, 2), "11:00"),
      endsAt: zonedDate(shiftDate(today, 2), "12:00"),
      capacity: classTypesByKey.privateReformer.maxCapacity,
      status: SessionStatus.SCHEDULED,
      notes: "Upcoming private reformer trial session.",
    },
  });

  await prisma.booking.create({
    data: {
      sessionId: yesterdayGroupSession.id,
      customerId: maya.id,
      status: BookingStatus.ATTENDED,
      paymentSourceType: PaymentSourceType.PACKAGE,
      customerPackageId: mayaGroupPackage.id,
      creditDeducted: true,
      notes: "Historical attendance.",
    },
  });

  await prisma.booking.create({
    data: {
      sessionId: todayGroupSession.id,
      customerId: daniel.id,
      status: BookingStatus.BOOKED,
      paymentSourceType: PaymentSourceType.PACKAGE,
      notes: "Upcoming group mat booking.",
    },
  });

  await prisma.booking.create({
    data: {
      sessionId: todayGroupSession.id,
      customerId: maya.id,
      status: BookingStatus.BOOKED,
      paymentSourceType: PaymentSourceType.SINGLE,
      singleClassPurchaseId: mayaGroupSingle.id,
      notes: "Upcoming one-off booking.",
    },
  });

  await prisma.booking.create({
    data: {
      sessionId: todayDuoSession.id,
      customerId: sofia.id,
      status: BookingStatus.BOOKED,
      paymentSourceType: PaymentSourceType.SINGLE,
      singleClassPurchaseId: sofiaDuoSingle.id,
      notes: "Duo reformer one-off booking.",
    },
  });

  await prisma.booking.create({
    data: {
      sessionId: tomorrowPrivateSession.id,
      customerId: sofia.id,
      status: BookingStatus.BOOKED,
      paymentSourceType: PaymentSourceType.PACKAGE,
      notes: "Private reformer session backed by package.",
    },
  });

  if (!linhTrialAReformerItem || !linhTrialAGroupItem || !minhTrialBReformerItem) {
    throw new Error("Trial package items were not created correctly.");
  }

  await prisma.booking.create({
    data: {
      sessionId: pastTrialReformerSession.id,
      customerId: linh.id,
      status: BookingStatus.ATTENDED,
      paymentSourceType: PaymentSourceType.TRIAL,
      customerTrialPackageId: linhTrialA.id,
      customerTrialPackageItemId: linhTrialAReformerItem.id,
      trialUseConsumed: true,
      notes: "Historical Intro Trial A reformer attendance.",
    },
  });

  await prisma.booking.create({
    data: {
      sessionId: futureTrialGroupSession.id,
      customerId: linh.id,
      status: BookingStatus.BOOKED,
      paymentSourceType: PaymentSourceType.TRIAL,
      customerTrialPackageId: linhTrialA.id,
      customerTrialPackageItemId: linhTrialAGroupItem.id,
      notes: "Upcoming group mat booking backed by Intro Trial A.",
    },
  });

  await prisma.booking.create({
    data: {
      sessionId: futureTrialReformerSession.id,
      customerId: minh.id,
      status: BookingStatus.BOOKED,
      paymentSourceType: PaymentSourceType.TRIAL,
      customerTrialPackageId: minhTrialB.id,
      customerTrialPackageItemId: minhTrialBReformerItem.id,
      notes: "Upcoming private reformer booking backed by Intro Trial B.",
    },
  });

  const standingRule = await prisma.recurringBookingRule.create({
    data: {
      customerId: daniel.id,
      classTypeId: classTypesByKey.groupMat.id,
      instructorId: phoebeInstructor.id,
      dayOfWeek: Weekday.WEDNESDAY,
      startTime: "08:00",
      startDate: toDateOnly(zonedDate(today)),
      notes: "Every Wednesday morning.",
      paymentSourceType: PaymentSourceType.PACKAGE,
    },
  });

  await prisma.session.update({
    where: { id: nextWeekStandingSession.id },
    data: {
      recurringBookingRuleId: standingRule.id,
    },
  });

  await prisma.booking.create({
    data: {
      sessionId: nextWeekStandingSession.id,
      customerId: daniel.id,
      status: BookingStatus.BOOKED,
      paymentSourceType: PaymentSourceType.PACKAGE,
      recurringBookingRuleId: standingRule.id,
      notes: "Generated from standing booking.",
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: ownerUser.id,
        entityType: "CustomerPackage",
        entityId: mayaGroupPackage.id,
        action: "SELL_PACKAGE",
        details: {
          customerName: maya.fullName,
          packageName: mayaGroupPackageTemplate.name,
        },
      },
      {
        userId: ownerUser.id,
        entityType: "CustomerPackage",
        entityId: mayaImportedPrivateMatBalance.id,
        action: "CREATE_IMPORTED_BALANCE",
        details: {
          customerName: maya.fullName,
          classTypeName: classTypesByKey.privateMat.name,
          remainingCredits: 1,
        },
      },
      {
        userId: opsUser.id,
        entityType: "SingleClassPurchase",
        entityId: mayaGroupSingle.id,
        action: "SELL_SINGLE_CLASS",
        details: {
          customerName: maya.fullName,
          classTypeName: classTypesByKey.groupMat.name,
        },
      },
      {
        userId: ownerUser.id,
        entityType: "CustomerTrialPackage",
        entityId: linhTrialA.id,
        action: "SELL_TRIAL_PACKAGE",
        details: {
          customerName: linh.fullName,
          trialPackageName: introTrialATemplate.name,
        },
      },
      {
        userId: opsUser.id,
        entityType: "CustomerTrialPackage",
        entityId: minhTrialB.id,
        action: "SELL_TRIAL_PACKAGE",
        details: {
          customerName: minh.fullName,
          trialPackageName: introTrialBTemplate.name,
        },
      },
      {
        userId: ownerUser.id,
        entityType: "RecurringBookingRule",
        entityId: standingRule.id,
        action: "CREATE_RECURRING_RULE",
        details: {
          customerName: daniel.fullName,
        },
      },
    ],
  });

  const allCustomerPackages = await prisma.customerPackage.findMany({
    orderBy: {
      createdAt: "asc",
    },
  });

  if (allCustomerPackages.length) {
    await prisma.customerPackageTransaction.createMany({
      data: allCustomerPackages.map((customerPackage) => ({
        customerPackageId: customerPackage.id,
        eventType: CustomerPackageTransactionType.OPENING_SNAPSHOT,
        deltaCredits: 0,
        resultingCredits: customerPackage.remainingCredits,
        reason: "Seed snapshot",
        notes: customerPackage.notes,
        createdAt: customerPackage.createdAt,
      })),
    });
  }

  const allTrialItems = await prisma.customerTrialPackageItem.findMany({
    orderBy: {
      createdAt: "asc",
    },
  });

  if (allTrialItems.length) {
    await prisma.customerTrialPackageItemTransaction.createMany({
      data: allTrialItems.map((item) => ({
        customerTrialPackageItemId: item.id,
        eventType: CustomerTrialPackageItemTransactionType.OPENING_SNAPSHOT,
        deltaQuantity: 0,
        resultingQuantity: item.remainingQuantity,
        reason: "Seed snapshot",
        createdAt: item.createdAt,
      })),
    });
  }

  console.log("Seed complete.");
  console.log("Admin emails: phuong@reform.local, phoebe@reform.local");
  console.log(`Admin password: ${DEFAULT_PASSWORD}`);
  console.log(`Timezone: ${APP_TIMEZONE}`);
  console.log(
    `Seeded ${customers.length} customers, ${templates.length} package templates, ${trialTemplates.length} trial templates, and 8 sample sessions.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
