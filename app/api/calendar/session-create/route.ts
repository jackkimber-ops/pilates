import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { combineDateAndTime, getToday } from "@/lib/date";
import { getSessionCreateOptions } from "@/lib/session-create-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const time = searchParams.get("time");
  const balanceValidFrom =
    date && time ? combineDateAndTime(date, time) : getToday();

  const options = await getSessionCreateOptions({
    balanceValidFrom,
    user,
  });

  return NextResponse.json(options);
}
