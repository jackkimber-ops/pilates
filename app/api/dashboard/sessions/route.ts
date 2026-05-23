import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardLiveSessions } from "@/lib/dashboard-live-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getDashboardLiveSessions());
}
