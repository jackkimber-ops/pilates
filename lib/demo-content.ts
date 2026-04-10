export type DemoCustomer = {
  id: string;
  fullName: string;
  initials: string;
  status: "Active" | "Inactive";
  tags: string[];
  phone: string;
  email: string;
  credits: number;
  packages: number;
  oneOffs: number;
  lastVisit: string;
  nextBooking: string;
  note: string;
};

export type DemoSession = {
  id: string;
  title: string;
  category: "Group" | "Private";
  instructor: string;
  start: string;
  end: string;
  bookings: string;
  tone: "plum" | "sage" | "cream";
  status: "Scheduled" | "Standing";
};

export const demoCustomers: DemoCustomer[] = [
  {
    id: "serena-lim",
    fullName: "Serena Lim",
    initials: "SL",
    status: "Active",
    tags: ["Morning", "VIP"],
    phone: "081-555-0121",
    email: "serena@reformstudio.co",
    credits: 3,
    packages: 1,
    oneOffs: 1,
    lastVisit: "Yesterday",
    nextBooking: "Thu, 8:00 AM",
    note: "Prefers the front reformer and appreciates a quick text if the morning flow moves later.",
  },
  {
    id: "natalie-vo",
    fullName: "Natalie Vo",
    initials: "NV",
    status: "Active",
    tags: ["Private"],
    phone: "081-555-0132",
    email: "natalie@reformstudio.co",
    credits: 8,
    packages: 2,
    oneOffs: 0,
    lastVisit: "Mon, 6:30 PM",
    nextBooking: "Fri, 11:00 AM",
    note: "Usually books private reformer sessions around lunch and wants a calmer spot after work.",
  },
  {
    id: "clara-patel",
    fullName: "Clara Patel",
    initials: "CP",
    status: "Active",
    tags: ["Starter"],
    phone: "081-555-0164",
    email: "clara@reformstudio.co",
    credits: 1,
    packages: 1,
    oneOffs: 0,
    lastVisit: "Last week",
    nextBooking: "No upcoming session",
    note: "Newer client, responds well to softer cues and likes a little extra setup guidance.",
  },
  {
    id: "amelia-ross",
    fullName: "Amelia Ross",
    initials: "AR",
    status: "Inactive",
    tags: ["Follow-up"],
    phone: "081-555-0190",
    email: "amelia@reformstudio.co",
    credits: 0,
    packages: 0,
    oneOffs: 0,
    lastVisit: "2 months ago",
    nextBooking: "None",
    note: "Paused after travel. Worth checking in before the next package launch.",
  },
];

export const demoSessions: DemoSession[] = [
  {
    id: "reformer-flow-wed",
    title: "Reformer Flow",
    category: "Group",
    instructor: "Aya Morgan",
    start: "8:00 AM",
    end: "9:00 AM",
    bookings: "5 / 6 booked",
    tone: "plum",
    status: "Standing",
  },
  {
    id: "core-reset-wed",
    title: "Core Reset",
    category: "Group",
    instructor: "Phoebe",
    start: "10:30 AM",
    end: "11:30 AM",
    bookings: "4 / 6 booked",
    tone: "sage",
    status: "Scheduled",
  },
  {
    id: "private-reformer-wed",
    title: "Private Reformer",
    category: "Private",
    instructor: "Phuong",
    start: "1:00 PM",
    end: "2:00 PM",
    bookings: "1 / 1 booked",
    tone: "cream",
    status: "Scheduled",
  },
];

export const dashboardMetrics = [
  {
    label: "Sessions today",
    value: "6",
    caption: "A calm, full day across one shared room.",
  },
  {
    label: "Low-credit clients",
    value: "3",
    caption: "Customers who need a package follow-up soon.",
  },
  {
    label: "Unused one-offs",
    value: "4",
    caption: "Single-class purchases still available to place.",
  },
];

export const dashboardQuickActions = [
  { href: "/calendar", label: "Calendar", description: "Schedule" },
  { href: "/customers", label: "Browse customers", description: "Scan balances, notes, and attendance at a glance." },
  { href: "/sales/package", label: "Sell package", description: "Use the soft sheet flow for package sales." },
  { href: "/sessions/reformer-flow-wed", label: "Open session drawer", description: "Check a premium drawer pattern for attendance controls." },
];

export const customerPackages = [
  {
    name: "Group 10",
    category: "Group",
    creditsRemaining: 3,
    originalCredits: 10,
    purchaseDate: "Mar 02, 2026",
    expiryDate: "Mar 02, 2027",
    amount: "3.500.000 ₫",
  },
  {
    name: "Private 10",
    category: "Private",
    creditsRemaining: 6,
    originalCredits: 10,
    purchaseDate: "Jan 14, 2026",
    expiryDate: "Jan 14, 2027",
    amount: "12.100.000 ₫",
  },
];

export const customerPayments = [
  { label: "Group 10 package", date: "Mar 02, 2026", amount: "3.500.000 ₫", method: "Card" },
  { label: "Single reformer class", date: "Apr 04, 2026", amount: "1.300.000 ₫", method: "QR transfer" },
  { label: "Private 10 package", date: "Jan 14, 2026", amount: "12.100.000 ₫", method: "Bank transfer" },
];

export const customerVisits = [
  { title: "Reformer Flow", status: "Attended", source: "Package", date: "Tue, Apr 07 · 8:00 AM" },
  { title: "Core Reset", status: "Booked", source: "Package", date: "Thu, Apr 09 · 10:30 AM" },
  { title: "Private Reformer", status: "Late cancel", source: "One-off", date: "Fri, Apr 03 · 1:00 PM" },
];

export const calendarDays = [
  { label: "Wed", date: "09", active: true },
  { label: "Thu", date: "10", active: false },
  { label: "Fri", date: "11", active: false },
  { label: "Sat", date: "12", active: false },
  { label: "Sun", date: "13", active: false },
];

export const sellPackageOptions = [
  { name: "Group 10", detail: "10 credits · group", price: "3.500.000 ₫" },
  { name: "Group 20", detail: "20 credits · group", price: "6.500.000 ₫" },
  { name: "Private 10", detail: "10 credits · private", price: "12.100.000 ₫" },
];

export const singleClassOptions = [
  {
    name: "Any Group Class",
    detail: "Open one-off · group category",
    price: "450.000 ₫",
    category: "Group",
  },
  {
    name: "Reformer Flow",
    detail: "Specific one-off · group class type",
    price: "450.000 ₫",
    category: "Group",
  },
  {
    name: "Private Reformer",
    detail: "Specific one-off · private class type",
    price: "1.300.000 ₫",
    category: "Private",
  },
];

export function getDemoCustomer(id: string) {
  return demoCustomers.find((customer) => customer.id === id) ?? demoCustomers[0];
}

export function getDemoSession(id: string) {
  return demoSessions.find((session) => session.id === id) ?? demoSessions[0];
}
