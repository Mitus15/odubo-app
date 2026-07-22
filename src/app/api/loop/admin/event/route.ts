import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { setEventDetails, type EventDetails } from "@/lib/loop/event-store";

/**
 * Save the admin-editable event details (theme, title/volume, venue) for the
 * active event. Persisted in D1, so a change shows for every visitor.
 *
 * Gated by the `ls_admin` session cookie in middleware (see admin-auth.ts).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as Partial<EventDetails>;
  const event = await getCurrentEvent();
  await setEventDetails(event.id, body);
  return NextResponse.json({ ok: true });
}
