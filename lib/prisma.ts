import { PrismaClient } from "@prisma/client";
import { getServerEnv } from "@/lib/env/server";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

getServerEnv();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
