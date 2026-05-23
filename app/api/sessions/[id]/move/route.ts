import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { moveSession } from "@/lib/domain/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { startsAt?: string } | null;
  const { id } = await params;

  if (!body?.startsAt) {
    return NextResponse.json({ error: "New start time is required." }, { status: 400 });
  }

  try {
    const session = await moveSession({
      sessionId: id,
      startsAt: new Date(body.startsAt),
      userId: user.id,
    });

    return NextResponse.json({
      ok: true,
      id: session.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to move the session.",
      },
      { status: 400 },
    );
  }
}
