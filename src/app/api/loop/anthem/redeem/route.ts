import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { canSuggest, redeem } from "@/lib/loop/event-codes";
import { ensureAttendee, recordAttendance } from "@/lib/loop/identity";

/**
 * Redeem an event code to unlock the room. Binds the code to the current
 * anonymous voter (ls_voter), marking them a pass-holder, and — since this is
 * the one moment we know a real person is arriving — creates their attendee
 * record and logs the attendance. Zero forms: a name and email can be claimed
 * later (see docs/decisions/loop-identity-and-danceyokey.md).
 */
export async function POST(req: Request) {
  const { code } = (await req.json()) as { code?: string };
  if (!code || !code.trim()) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }

  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  const result = await redeem(event.id, code, voterId);

  if (!result.ok) {
    const status = result.reason === "used" ? 409 : 404;
    const error = result.reason === "used" ? "that code is already used" : "unknown code";
    return NextResponse.json({ error }, { status });
  }

  // Identity is best-effort: a failure here must never cost someone entry.
  try {
    const attendee = await ensureAttendee(voterId);
    await recordAttendance(event.id, attendee.id, code.trim().toUpperCase());
  } catch (e) {
    console.error("[loop:identity] attendance not recorded:", e);
  }

  return NextResponse.json({ ok: true, canSuggest: await canSuggest(event.id, voterId) });
}
