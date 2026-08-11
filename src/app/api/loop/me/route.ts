import { NextRequest, NextResponse } from "next/server";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { isHolder } from "@/lib/loop/event-codes";
import {
  attendeeForVoter,
  claimIdentity,
  creditedUids,
  ensureAttendee,
} from "@/lib/loop/identity";
import { rateLimit } from "@/lib/rateLimit";

/** Who this device is, what they've attended, what they've shot. */
export async function GET() {
  const voterId = await currentVoterId();
  const attendee = await attendeeForVoter(voterId);
  if (!attendee) {
    return NextResponse.json({ attendee: null }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const event = await getCurrentEvent();
  const [shots, holder] = await Promise.all([
    creditedUids(attendee.id, event.id),
    isHolder(event.id, voterId),
  ]);
  return NextResponse.json(
    { attendee, shotsThisEvent: shots.length, holder },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** "This is me" — claim a display name and the checkout email. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    displayName?: string | null;
    email?: string | null;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const email = body.email?.trim() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  }

  const voterId = await currentVoterId();
  if (voterId === "anonymous") {
    return NextResponse.json({ error: "No device identity yet." }, { status: 400 });
  }

  // Claiming an email re-points this device at whoever owns it, so it gets the
  // same throttle as the code lookup.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limiter = await rateLimit({ key: `loop:me:claim:${ip}`, limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many tries — wait a few minutes." }, { status: 429 });
  }

  await ensureAttendee(voterId);
  const attendee = await claimIdentity(voterId, body.displayName ?? null, email);
  return NextResponse.json({ success: true, attendee });
}
