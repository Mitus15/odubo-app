import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import {
  setEventDetails,
  parseCapacity,
  MIN_CAPACITY,
  MAX_CAPACITY,
  type EventDetails,
} from "@/lib/loop/event-store";

/**
 * Save the admin-editable event details (title, theme, venue, capacity) for the
 * active event. Persisted in D1, so a change shows for every visitor.
 *
 * Gated by the `ls_admin` session cookie in middleware (see admin-auth.ts).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as Partial<EventDetails>;

  // Capacity is rejected loudly rather than silently dropped. setEventDetails
  // ignores an unusable value, which is the right behaviour for a merge but the
  // wrong behaviour for a save button: the admin would see "Saved ✓" while the
  // poster kept printing the old number.
  if (body.capacity !== undefined && parseCapacity(body.capacity) === null) {
    return NextResponse.json(
      { error: `capacity must be a whole number between ${MIN_CAPACITY} and ${MAX_CAPACITY}` },
      { status: 400 },
    );
  }

  const event = await getCurrentEvent();
  await setEventDetails(event.id, body);
  return NextResponse.json({ ok: true });
}
