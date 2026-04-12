import { createHash, randomBytes } from "node:crypto";
import { addDays, isBefore } from "date-fns";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE_NAME, SESSION_DURATION_DAYS } from "@/lib/constants";
import { getServerEnv } from "@/lib/env/server";
import { prisma } from "@/lib/prisma";

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getSessionCookieOptions(expiresAt: Date) {
  const env = getServerEnv();

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    priority: "high" as const,
  };
}

async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", getSessionCookieOptions(new Date(0)));
}

export async function createAuthSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const sessionTokenHash = hashSessionToken(token);
  const expiresAt = addDays(new Date(), SESSION_DURATION_DAYS);

  await prisma.adminSession.create({
    data: {
      userId,
      sessionTokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
}

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const sessionTokenHash = hashSessionToken(token);
  const authSession = await prisma.adminSession.findUnique({
    where: {
      sessionTokenHash,
    },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          instructorId: true,
        },
      },
    },
  });

  if (!authSession) {
    return null;
  }

  if (isBefore(authSession.expiresAt, new Date())) {
    await prisma.adminSession.delete({
      where: {
        id: authSession.id,
      },
    });
    return null;
  }

  if (authSession.user.role !== "ADMIN") {
    return null;
  }

  return authSession.user;
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function signInWithPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (!user) {
    return null;
  }

  if (user.role !== "ADMIN") {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  await createAuthSession(user.id);
  return user;
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.adminSession.deleteMany({
      where: {
        sessionTokenHash: hashSessionToken(token),
      },
    });
  }

  await clearSessionCookie();
}
