import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { removeBooking } from "@/lib/domain/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const booking = await removeBooking({
      bookingId: id,
      userId: user.id,
    });

    revalidatePath("/");
    revalidatePath("/calendar");
    revalidatePath("/customers");
    revalidatePath("/reports");
    revalidatePath(`/sessions/${booking.sessionId}`);
    revalidatePath(`/customers/${booking.customerId}`);

    return NextResponse.json({
      ok: true,
      bookingId: booking.id,
      sessionId: booking.sessionId,
      customerId: booking.customerId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to remove customer.",
      },
      { status: 400 },
    );
  }
}
