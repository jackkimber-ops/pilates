import { expect, test, type Locator, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const adminEmail = "phuong@reform.local";
const adminPassword = "Pilates123!";
const runId = Date.now().toString().slice(-8);

const qaCustomer = {
  name: `QA UAT ${runId}`,
  email: `qa.uat.${runId}@example.com`,
  phone: `081-77${runId.slice(-4)}`,
};

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function nextUtcWeekday(from: Date, weekday: number) {
  const next = new Date(from);

  while (next.getUTCDay() !== weekday) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const recurringBaseDate = nextUtcWeekday(
  addUtcDays(new Date(Date.UTC(2026, 5, 5)), Number(runId.slice(-3)) % 21),
  5,
);
const recurringEndDate = addUtcDays(recurringBaseDate, 7);

const titles = {
  duo: `QA Duo ${runId}`,
  trial: `QA Trial ${runId}`,
  group: `QA Group ${runId}`,
  cancel: `QA Cancel ${runId}`,
};

const schedule = {
  duoDate: toIsoDate(recurringBaseDate),
  duoStart: "15:00",
  trialDate: toIsoDate(recurringBaseDate),
  trialStart: "12:00",
  groupDate: toIsoDate(recurringBaseDate),
  groupStart: "16:00",
  cancelDate: toIsoDate(addUtcDays(recurringBaseDate, -6)),
  cancelStart: "18:00",
};

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

function mobileNav(page: Page) {
  return page
    .locator("nav")
    .filter({ hasText: "Home" })
    .filter({ hasText: "Clients" })
    .filter({ hasText: "Schedule" })
    .filter({ hasText: "Package" })
    .last();
}

async function openMoreMenu(page: Page) {
  const nav = mobileNav(page);
  await nav.getByRole("button", { name: "More" }).click();
  await expect(nav.getByRole("menu")).toBeVisible();
  return nav.getByRole("menu");
}

async function customerIdByEmail(email: string) {
  const customer = await prisma.customer.findUnique({ where: { email } });
  expect(customer, `Expected customer ${email} to exist in the database.`).not.toBeNull();
  return customer!.id;
}

async function sessionIdByTitle(title: string) {
  const session = await prisma.session.findFirst({
    where: { title },
    orderBy: { createdAt: "desc" },
  });

  expect(session, `Expected session ${title} to exist in the database.`).not.toBeNull();
  return session!.id;
}

async function findSessionIdByTitle(title: string) {
  const session = await prisma.session.findFirst({
    where: { title },
    orderBy: { createdAt: "desc" },
  });

  return session?.id ?? null;
}

async function findRecurringRuleIdForCustomer(customerId: string) {
  const rule = await prisma.recurringBookingRule.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });

  return rule?.id ?? null;
}

async function packageForCustomer(email: string) {
  const customer = await prisma.customer.findUnique({
    where: { email },
    include: {
      packages: {
        include: {
          packageTemplate: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  expect(customer).not.toBeNull();
  return customer!.packages[0];
}

async function oneOffForCustomer(email: string) {
  const customer = await prisma.customer.findUnique({
    where: { email },
    include: {
      singleClassPurchases: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  expect(customer).not.toBeNull();
  return customer!.singleClassPurchases[0];
}

async function fillSessionForm(page: Page, input: {
  classType: string;
  instructor: string;
  customer?: string;
  title: string;
  date: string;
  startTime: string;
  notes: string;
}) {
  await page.getByLabel("Class type").selectOption({ label: input.classType });
  if (input.customer) {
    await page.getByLabel("Customer").selectOption({ label: input.customer });
  }
  await page.getByLabel("Instructor").selectOption({ label: input.instructor });
  await page.getByLabel("Title").fill(input.title);
  await page.getByLabel("Date").fill(input.date);
  await page.getByLabel("Start time").fill(input.startTime);
  await page.getByLabel("Notes").fill(input.notes);
}

async function rosterCard(page: Page, customerName: string): Promise<Locator> {
  return page.locator(".session-booking-card").filter({ hasText: customerName }).first();
}

async function choosePaymentSource(
  page: Page,
  label: "Package" | "One-off" | "Trial" | "Override",
) {
  await page
    .locator(".segmented-option")
    .filter({ hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("auth, protected routes, and shell navigation stay usable", async ({ page }) => {
  await page.goto("/customers");
  await expect(page).toHaveURL(/\/login\?next=%2Fcustomers$/);

  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();

  await login(page);

  await mobileNav(page).getByRole("link", { name: "Clients" }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();

  await mobileNav(page).getByRole("link", { name: "Schedule" }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();

  await mobileNav(page).getByRole("link", { name: "Package" }).click();
  await expect(page).toHaveURL(/\/sales\/package$/);
  await expect(page.getByRole("button", { name: "Sell package" })).toBeVisible();

  let menu = await openMoreMenu(page);
  await menu.getByRole("menuitem", { name: /Reports/i }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();

  menu = await openMoreMenu(page);
  await menu.getByRole("menuitem", { name: /Recurring/i }).click();
  await expect(page).toHaveURL(/\/recurring$/);
  await expect(page.getByRole("button", { name: "Create rule" })).toBeVisible();

  menu = await openMoreMenu(page);
  await menu.getByRole("menuitem", { name: /Catalog/i }).click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByRole("link", { name: /Class types/i })).toBeVisible();

  await mobileNav(page).getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);

  menu = await openMoreMenu(page);
  await menu.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/login(?:\?next=%2Fcalendar)?$/);
});

test("customers, sales, sessions, bookings, attendance, recurring, reports, and catalog flows work end to end", async ({
  page,
}) => {
  await login(page);

  await page.goto("/customers/new");
  await page.getByLabel("Full name").fill(qaCustomer.name);
  await page.getByLabel("Phone").fill(qaCustomer.phone);
  await page.getByLabel("Email").fill(qaCustomer.email);
  await page.getByLabel("Tags").fill("QA, UAT");
  await page.getByLabel("Notes").fill("Created during Playwright UAT.");
  await page.getByRole("button", { name: "Create customer" }).click();

  await expect(page).toHaveURL(/\/customers$/);
  await page.getByPlaceholder("Name, phone, or email").fill(qaCustomer.email);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("link", { name: new RegExp(qaCustomer.name) })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(qaCustomer.name) }).click();

  await expect(page).toHaveURL(/\/customers\/.+/);
  await expect(page.getByRole("heading", { name: qaCustomer.name }).first()).toBeVisible();

  await page.getByLabel("Notes").fill("Updated during Playwright UAT.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Updated during Playwright UAT.").first()).toBeVisible();

  await page.getByRole("link", { name: "Sell package" }).first().click();
  await expect(page).toHaveURL(/\/sales\/package\?customerId=/);
  await page.getByLabel("Package template").selectOption({ label: "Duo Reformer 10" });
  await expect(page.getByLabel("Amount paid")).toHaveValue("16800000");
  await page.getByLabel("Notes").fill("Package sold during Playwright UAT.");
  await page.getByRole("button", { name: "Sell package" }).click();

  await expect(page.getByText("Duo Reformer 10").first()).toBeVisible();
  await expect(page.getByText(/Expires/i).first()).toBeVisible();

  await page.getByLabel("Change").fill("1");
  await page.getByLabel("Reason").fill("QA bonus adjustment");
  await page.getByRole("button", { name: "Adjust balance" }).click();
  await expect(page.getByText("QA bonus adjustment")).toBeVisible();
  await expect(page.getByText(/^11$/).first()).toBeVisible();

  await expect
    .poll(async () => {
      const customerPackage = await packageForCustomer(qaCustomer.email);
      return {
        remainingCredits: customerPackage?.remainingCredits ?? null,
        name: customerPackage?.packageTemplate?.name ?? null,
      };
    })
    .toEqual({ remainingCredits: 11, name: "Duo Reformer 10" });

  await page.getByRole("link", { name: "Sell one-off" }).first().click();
  await expect(page).toHaveURL(/\/sales\/single\?customerId=/);
  await expect(page.getByLabel("Amount paid")).toHaveValue("450000");
  await page.getByLabel("Notes").fill("One-off sold during Playwright UAT.");
  await page.getByRole("button", { name: "Sell one-off" }).click();
  await expect(page.getByText("Group Mat (Maximum 6)").nth(1)).toBeVisible();
  await expect(page.getByText("UNUSED", { exact: true })).toBeVisible();

  await expect
    .poll(async () => {
      const purchase = await oneOffForCustomer(qaCustomer.email);
      return purchase?.status ?? null;
    })
    .toBe("UNUSED");

  await page.getByRole("link", { name: "Sell trial" }).first().click();
  await expect(page).toHaveURL(/\/sales\/trial\?customerId=/);
  await expect(page.getByText("Customer already has history")).toBeVisible();
  await page.getByLabel("Trial package").selectOption({ label: "Intro Trial A" });
  await expect(page.getByLabel("Amount paid")).toHaveValue("1700000");
  await page.getByLabel("Notes").fill("Intro trial sold during Playwright UAT.");
  await page.getByRole("button", { name: "Sell trial" }).click();
  await expect(page.getByText("Intro Trial A").first()).toBeVisible();
  await expect(page.getByText("Private Reformer").first()).toBeVisible();

  await page.goto("/sessions/new");
  await fillSessionForm(page, {
    classType: "Group Mat (Maximum 6)",
    customer: "Daniel Kim",
    instructor: "Phoebe",
    title: titles.trial,
    date: schedule.trialDate,
    startTime: schedule.trialStart,
    notes: "Trial entitlement session during Playwright UAT.",
  });
  await page.getByRole("button", { name: "Create and book" }).click();

  await expect.poll(async () => findSessionIdByTitle(titles.trial)).not.toBeNull();
  const trialSessionId = await sessionIdByTitle(titles.trial);

  await page.goto(`/sessions/${trialSessionId}`);
  await page.getByLabel("Customer").selectOption({ label: qaCustomer.name });
  await choosePaymentSource(page, "Trial");
  await page.getByRole("button", { name: "Add booking" }).click();
  await expect
    .poll(async () => {
      const booking = await prisma.booking.findFirst({
        where: {
          sessionId: trialSessionId,
          customer: {
            email: qaCustomer.email,
          },
        },
      });

      return booking?.paymentSourceType ?? null;
    })
    .toBe("TRIAL");

  await page.goto(`/sessions/${trialSessionId}`);
  const trialCard = await rosterCard(page, qaCustomer.name);
  await expect(trialCard).toContainText("TRIAL");
  await trialCard.getByRole("combobox").selectOption("ATTENDED");
  await trialCard.getByRole("button", { name: "Update status" }).click();

  await expect
    .poll(async () => {
      const booking = await prisma.booking.findFirst({
        where: {
          sessionId: trialSessionId,
          customer: {
            email: qaCustomer.email,
          },
        },
      });

      const trial = await prisma.customerTrialPackage.findFirst({
        where: {
          customer: {
            email: qaCustomer.email,
          },
          trialPackageTemplate: {
            name: "Intro Trial A",
          },
        },
        include: {
          items: {
            include: {
              classType: true,
            },
          },
        },
      });

      const groupItem = trial?.items.find((item) => item.classType.name === "Group Mat (Maximum 6)");

      return {
        paymentSourceType: booking?.paymentSourceType ?? null,
        trialUseConsumed: booking?.trialUseConsumed ?? false,
        remainingGroupTrials: groupItem?.remainingQuantity ?? null,
      };
    })
    .toEqual({
      paymentSourceType: "TRIAL",
      trialUseConsumed: true,
      remainingGroupTrials: 0,
    });

  await page.goto(`/sessions/${trialSessionId}`);
  await expect(trialCard).toContainText("Trial used");

  await page.goto("/sessions/new");
  await fillSessionForm(page, {
    classType: "Duo Reformer",
    customer: qaCustomer.name,
    instructor: "Phuong",
    title: titles.duo,
    date: schedule.duoDate,
    startTime: schedule.duoStart,
    notes: "Created during Playwright UAT.",
  });
  await page.getByRole("button", { name: "Create and book" }).click();

  await expect.poll(async () => findSessionIdByTitle(titles.duo)).not.toBeNull();
  const duoSessionId = await sessionIdByTitle(titles.duo);

  await page.goto(`/sessions/${duoSessionId}`);
  await expect(page).toHaveURL(new RegExp(`/sessions/${duoSessionId}$`));
  await expect(page.getByRole("heading", { name: titles.duo }).first()).toBeVisible();
  await expect(page.getByLabel("Date")).toHaveValue(schedule.duoDate);

  await page.locator("#notes").click();
  await page.locator("#notes").press("Control+A");
  await page.locator("#notes").press("Backspace");
  await page.locator("#notes").type("Edited during Playwright UAT.");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect
    .poll(async () => {
      const session = await prisma.session.findUnique({ where: { id: duoSessionId } });
      return {
        date: session?.date.toISOString().slice(0, 10) ?? null,
        notes: session?.notes ?? null,
      };
    })
    .toEqual({
      date: schedule.duoDate,
      notes: "Edited during Playwright UAT.",
    });

  await page.goto(`/sessions/${duoSessionId}`);
  await expect(page.getByLabel("Date")).toHaveValue(schedule.duoDate);

  await expect
    .poll(async () => {
      const booking = await prisma.booking.findFirst({
        where: {
          sessionId: duoSessionId,
          customer: {
            email: qaCustomer.email,
          },
        },
      });

      return booking?.paymentSourceType ?? null;
    })
    .toBe("PACKAGE");

  await page.goto(`/sessions/${duoSessionId}`);

  const qaRosterCard = await rosterCard(page, qaCustomer.name);
  await expect(qaRosterCard).toContainText("PACKAGE");
  await expect(qaRosterCard).toContainText("BOOKED");
  await expect(qaRosterCard).toContainText("Credit deducted");

  await qaRosterCard.getByRole("combobox").selectOption("ATTENDED");
  await qaRosterCard.getByRole("button", { name: "Update status" }).click();
  await expect
    .poll(async () => {
      const booking = await prisma.booking.findFirst({
        where: {
          sessionId: duoSessionId,
          customer: {
            email: qaCustomer.email,
          },
        },
      });

      return {
        status: booking?.status ?? null,
        creditDeducted: booking?.creditDeducted ?? false,
      };
    })
    .toEqual({ status: "ATTENDED", creditDeducted: true });

  await page.goto(`/sessions/${duoSessionId}`);
  await expect(qaRosterCard).toContainText("ATTENDED");
  await expect(qaRosterCard).toContainText("Credit deducted");

  await expect
    .poll(async () => {
      const customerPackage = await packageForCustomer(qaCustomer.email);
      const booking = await prisma.booking.findFirst({
        where: {
          customer: { email: qaCustomer.email },
          session: { title: titles.duo },
        },
      });

      return {
        remainingCredits: customerPackage?.remainingCredits ?? null,
        creditDeducted: booking?.creditDeducted ?? false,
      };
    })
    .toEqual({ remainingCredits: 10, creditDeducted: true });

  await qaRosterCard.getByRole("combobox").selectOption("NO_SHOW");
  await qaRosterCard.getByRole("button", { name: "Update status" }).click();
  await expect
    .poll(async () => {
      const booking = await prisma.booking.findFirst({
        where: {
          sessionId: duoSessionId,
          customer: {
            email: qaCustomer.email,
          },
        },
      });

      return booking?.status ?? null;
    })
    .toBe("NO_SHOW");

  await page.goto(`/sessions/${duoSessionId}`);
  await expect(qaRosterCard).toContainText("NO SHOW");

  await expect
    .poll(async () => {
      const customerPackage = await packageForCustomer(qaCustomer.email);
      const booking = await prisma.booking.findFirst({
        where: {
          customer: { email: qaCustomer.email },
          session: { title: titles.duo },
        },
      });

      return {
        remainingCredits: customerPackage?.remainingCredits ?? null,
        creditDeducted: booking?.creditDeducted ?? false,
      };
    })
    .toEqual({ remainingCredits: 10, creditDeducted: true });

  await qaRosterCard.getByRole("button", { name: "Restore usage" }).click();
  await expect
    .poll(async () => {
      const booking = await prisma.booking.findFirst({
        where: {
          sessionId: duoSessionId,
          customer: {
            email: qaCustomer.email,
          },
        },
      });

      const customerPackage = await packageForCustomer(qaCustomer.email);

      return {
        status: booking?.status ?? null,
        creditDeducted: booking?.creditDeducted ?? false,
        remainingCredits: customerPackage?.remainingCredits ?? null,
      };
    })
    .toEqual({ status: "BOOKED", creditDeducted: false, remainingCredits: 11 });

  await page.goto(`/sessions/${duoSessionId}`);
  await expect(qaRosterCard).toContainText("BOOKED");
  await expect(qaRosterCard).toContainText("Restored");

  await page.getByLabel("Customer").selectOption({ label: "Daniel Kim" });
  await choosePaymentSource(page, "Override");
  await page.getByPlaceholder("Optional note").fill("Override booking during UAT.");
  await page.getByRole("button", { name: "Add booking" }).click();
  await expect
    .poll(async () => {
      const booking = await prisma.booking.findFirst({
        where: {
          sessionId: duoSessionId,
          customer: {
            fullName: "Daniel Kim",
          },
        },
      });

      return booking?.paymentSourceType ?? null;
    })
    .toBe("OVERRIDE");

  await page.goto(`/sessions/${duoSessionId}`);
  const danielCard = await rosterCard(page, "Daniel Kim");
  await expect(danielCard).toContainText("OVERRIDE");

  await page.getByLabel("Customer").selectOption({ label: "Maya Rivera" });
  await choosePaymentSource(page, "Override");
  await page.getByRole("button", { name: "Add booking" }).click();
  await expect(page.getByText("Class is full.")).toBeVisible();

  await danielCard.getByRole("combobox").selectOption("CANCELLED");
  await danielCard.getByRole("button", { name: "Update status" }).click();
  await expect
    .poll(async () => {
      const booking = await prisma.booking.findFirst({
        where: {
          sessionId: duoSessionId,
          customer: {
            fullName: "Daniel Kim",
          },
        },
      });

      return booking?.status ?? null;
    })
    .toBe("CANCELLED");

  await page.goto(`/sessions/${duoSessionId}`);
  await expect(danielCard).toContainText("CANCELLED");

  await page.goto("/sessions/new");
  await fillSessionForm(page, {
    classType: "Group Mat (Maximum 6)",
    customer: "Daniel Kim",
    instructor: "Phoebe",
    title: titles.group,
    date: schedule.groupDate,
    startTime: schedule.groupStart,
    notes: "Group session for one-off testing.",
  });
  await page.getByRole("button", { name: "Create and book" }).click();
  await expect.poll(async () => findSessionIdByTitle(titles.group)).not.toBeNull();
  const groupSessionId = await sessionIdByTitle(titles.group);
  await page.goto(`/sessions/${groupSessionId}`);
  await expect(page.getByRole("heading", { name: titles.group }).first()).toBeVisible();

  await page.getByLabel("Customer").selectOption({ label: qaCustomer.name });
  await choosePaymentSource(page, "One-off");
  await page.getByRole("button", { name: "Add booking" }).click();
  await expect
    .poll(async () => {
      const booking = await prisma.booking.findFirst({
        where: {
          sessionId: groupSessionId,
          customer: {
            email: qaCustomer.email,
          },
        },
      });

      return booking?.paymentSourceType ?? null;
    })
    .toBe("SINGLE");

  await page.goto(`/sessions/${groupSessionId}`);

  const oneOffCard = await rosterCard(page, qaCustomer.name);
  await expect(oneOffCard).toContainText("SINGLE");
  await expect(oneOffCard).toContainText("BOOKED");

  await oneOffCard.getByRole("combobox").selectOption("ATTENDED");
  await oneOffCard.getByRole("button", { name: "Update status" }).click();
  await expect
    .poll(async () => {
      const booking = await prisma.booking.findFirst({
        where: {
          sessionId: groupSessionId,
          customer: {
            email: qaCustomer.email,
          },
        },
      });

      return {
        status: booking?.status ?? null,
        singleUseConsumed: booking?.singleUseConsumed ?? false,
      };
    })
    .toEqual({ status: "ATTENDED", singleUseConsumed: true });

  await page.goto(`/sessions/${groupSessionId}`);
  await expect(oneOffCard).toContainText("One-off used");

  await expect
    .poll(async () => {
      const purchase = await oneOffForCustomer(qaCustomer.email);
      const customerPackage = await packageForCustomer(qaCustomer.email);
      return {
        singleStatus: purchase?.status ?? null,
        remainingCredits: customerPackage?.remainingCredits ?? null,
      };
    })
    .toEqual({ singleStatus: "USED", remainingCredits: 11 });

  await page.goto("/sessions/new");
  await fillSessionForm(page, {
    classType: "Private Reformer",
    customer: "Sofia Tan",
    instructor: "Phuong",
    title: `${titles.group} Conflict`,
    date: schedule.groupDate,
    startTime: schedule.groupStart,
    notes: "Should be blocked by overlap.",
  });
  await page.getByRole("button", { name: "Create and book" }).click();
  await expect.poll(async () => findSessionIdByTitle(`${titles.group} Conflict`)).toBeNull();

  await fillSessionForm(page, {
    classType: "Group Mat (Maximum 6)",
    customer: "Daniel Kim",
    instructor: "Phoebe",
    title: `${titles.group} Follow-up`,
    date: schedule.groupDate,
    startTime: "17:00",
    notes: "Should not allow a reused one-off.",
  });
  await page.getByRole("button", { name: "Create and book" }).click();
  await expect.poll(async () => findSessionIdByTitle(`${titles.group} Follow-up`)).not.toBeNull();
  await page.goto(`/sessions/${await sessionIdByTitle(`${titles.group} Follow-up`)}`);
  await expect(page.getByRole("heading", { name: `${titles.group} Follow-up` }).first()).toBeVisible();
  await page.getByLabel("Customer").selectOption({ label: qaCustomer.name });
  await choosePaymentSource(page, "One-off");
  await page.getByRole("button", { name: "Add booking" }).click();
  await expect(page.getByText("No one-off available.")).toBeVisible();

  await page.goto("/sessions/new");
  await fillSessionForm(page, {
    classType: "Private Reformer",
    customer: "Sofia Tan",
    instructor: "Phuong",
    title: titles.cancel,
    date: schedule.cancelDate,
    startTime: schedule.cancelStart,
    notes: "To validate cancelling a session.",
  });
  await page.getByRole("button", { name: "Create and book" }).click();
  await expect.poll(async () => findSessionIdByTitle(titles.cancel)).not.toBeNull();
  await page.goto(`/sessions/${await sessionIdByTitle(titles.cancel)}`);
  await page.getByRole("button", { name: "Cancel and restore" }).click();
  await expect(page).toHaveURL(/\/calendar$/);

  const cancelledSessionId = await sessionIdByTitle(titles.cancel);
  await expect
    .poll(async () => {
      const session = await prisma.session.findUnique({ where: { id: cancelledSessionId } });
      const customerPackage = await packageForCustomer("sofia@example.com");

      return {
        status: session?.status ?? null,
        remainingCredits: customerPackage?.remainingCredits ?? null,
      };
    })
    .toEqual({ status: "CANCELLED", remainingCredits: 5 });

  const customerId = await customerIdByEmail(qaCustomer.email);

  await page.goto(`/recurring?customerId=${customerId}`);
  await page.getByLabel("Class type").selectOption({ label: "Duo Reformer" });
  await page.getByLabel("Instructor").selectOption({ label: "Phuong" });
  await page.getByLabel("Day of week").selectOption("FRIDAY");
  await page.getByLabel("Start time").fill("19:00");
  await page.getByLabel("Payment source").selectOption("PACKAGE");
  await page.getByLabel("Start date").fill(toIsoDate(recurringBaseDate));
  await page.getByLabel("End date").fill(toIsoDate(recurringEndDate));
  await page.getByLabel("Notes").fill("Recurring rule from Playwright UAT.");
  await page.getByRole("button", { name: "Create rule" }).click();
  await expect(page.getByRole("heading", { name: qaCustomer.name })).toBeVisible();

  await expect.poll(async () => findRecurringRuleIdForCustomer(customerId)).not.toBeNull();
  const recurringRuleId = await findRecurringRuleIdForCustomer(customerId);

  await page.goto(`/recurring?customerId=${customerId}`);
  await page.getByRole("button", { name: "Generate" }).first().click();
  await expect
    .poll(async () => {
      if (!recurringRuleId) {
        return 0;
      }

      return prisma.session.count({
        where: {
          recurringBookingRuleId: recurringRuleId,
        },
      });
    })
    .toBe(2);

  await page.getByRole("button", { name: "Pause" }).first().click();
  await expect(page.getByText("INACTIVE")).toBeVisible();
  await page.getByRole("button", { name: "Reactivate" }).first().click();
  await expect(page.getByText("ACTIVE").first()).toBeVisible();

  await expect
    .poll(async () => {
      const sessions = await prisma.session.findMany({
        where: {
          recurringBookingRuleId: recurringRuleId ?? undefined,
          title: "Duo Reformer",
        },
      });

      return sessions.length;
    })
    .toBeGreaterThanOrEqual(2);

  await page.goto("/reports");
  await expect(page.getByText(qaCustomer.name).first()).toBeVisible();
  await page.locator('input[name="start"]').fill("2025-01-01");
  await page.locator('input[name="end"]').fill("2025-01-31");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("No sessions in this range.")).toBeVisible();
  await expect(page.getByText("No package sales in this range.")).toBeVisible();

  await page.goto("/catalog");
  await page.getByRole("link", { name: /Class types/i }).click();
  await expect(page).toHaveURL(/\/catalog\/class-types$/);
  await page.getByRole("link", { name: "Edit" }).first().click();
  await Promise.all([
    page.waitForURL(/\/catalog\/class-types$/),
    page.getByRole("button", { name: "Save class type" }).click(),
  ]);

  await page.goto("/catalog/instructors");
  await page.getByRole("link", { name: "Edit" }).first().click();
  await Promise.all([
    page.waitForURL(/\/catalog\/instructors$/),
    page.getByRole("button", { name: "Save instructor" }).click(),
  ]);

  await page.goto("/catalog/package-templates");
  await page.getByRole("link", { name: "Edit" }).first().click();
  await Promise.all([
    page.waitForURL(/\/catalog\/package-templates$/),
    page.getByRole("button", { name: "Save template" }).click(),
  ]);

  const menu = await openMoreMenu(page);
  await menu.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
