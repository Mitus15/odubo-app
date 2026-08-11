import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { hasRoomAccess } from "@/lib/loop/doors";
import { attendeeForVoter, ensureAttendee } from "@/lib/loop/identity";
import { getSettings, guestView, mySignup, signUp, withdraw } from "@/lib/loop/danceyokey";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Danceyokey, guest side. Deliberately thin: sign up, see your place, withdraw.
 * Fifteen seconds of phone, then it goes back in the pocket.
 *
 * Pass-holders only — a spot on the floor belongs to someone who's in the room
 * (or has a pass for it). Sign-ups work in advance and on the night.
 */
export async function GET() {
  const event = await getCurrentEvent();
  const voterId = await currentVoterId();
  const attendee = await attendeeForVoter(voterId);
  const view = await guestView(event.id, attendee?.id ?? null);
  return NextResponse.json(view, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const event = await getCurrentEvent();
  const voterId = await currentVoterId();
  if (!(await hasRoomAccess(event.id, voterId))) {
    return NextResponse.json(
      { error: "Danceyokey is for pass-holders — redeem your event code first." },
      { status: 403 },
    );
  }

  const settings = await getSettings();
  if (!settings.open) {
    return NextResponse.json({ error: "Sign-ups are closed right now." }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as {
    performers?: string;
    songTitle?: string;
    songArtist?: string;
    note?: string;
  } | null;
  const performers = body?.performers?.trim();
  if (!performers) {
    return NextResponse.json({ error: "Who's dancing? Add at least one name." }, { status: 400 });
  }
  if (!body?.songTitle?.trim()) {
    return NextResponse.json({ error: "Pick your song." }, { status: 400 });
  }

  const limiter = await rateLimit({
    key: `loop:danceyokey:signup:${voterId}`,
    limit: 6,
    windowMs: 30 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Easy — try again in a bit." }, { status: 429 });
  }

  const attendee = await ensureAttendee(voterId);
  const existing = await mySignup(event.id, attendee.id);
  if (existing) {
    return NextResponse.json(
      { error: "You're already on the list for tonight.", signup: existing },
      { status: 409 },
    );
  }

  // Before the night = an advance sign-up; during = in-room. Same list.
  const created = await signUp({
    eventId: event.id,
    attendeeId: attendee.id,
    performers,
    songTitle: body.songTitle.trim(),
    songArtist: body.songArtist?.trim() || null,
    note: body.note?.trim() || null,
    source: event.phase === "live" ? "in-room" : "advance",
  });

  return NextResponse.json({ success: true, signup: created });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const voterId = await currentVoterId();
  const attendee = await attendeeForVoter(voterId);
  if (!attendee) return NextResponse.json({ error: "Not your sign-up" }, { status: 403 });

  const ok = await withdraw(id, attendee.id);
  return ok
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: "Couldn't withdraw that — ask the host." }, { status: 409 });
}
