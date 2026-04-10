import { NextResponse } from "next/server";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      database: "up",
      googleCalendarConfigured: isGoogleCalendarConfigured(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "down",
        error: error instanceof Error ? error.message : "Database unavailable.",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
