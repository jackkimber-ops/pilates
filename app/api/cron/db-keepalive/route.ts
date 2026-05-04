import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "CRON_SECRET is not configured.",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized.",
        timestamp: new Date().toISOString(),
      },
      { status: 401 },
    );
  }

  const users = await prisma.user.count();

  return NextResponse.json({
    ok: true,
    database: "up",
    users,
    timestamp: new Date().toISOString(),
  });
}
