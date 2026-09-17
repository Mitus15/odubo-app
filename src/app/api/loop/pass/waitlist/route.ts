import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { recordConsent } from "@/lib/loop/guests";
import { rateLimit } from "@/lib/rateLimit";
import { currentVoterId } from "@/lib/loop/identity/voter";

export const runtime = "nodejs";

/**
 * The waitlist, when every pass is gone. One field, one row: the address
 * joins the guest list with source "waitlist", so the owner's consent export
 * (the Oct 9 reminder, a freed pass) reaches them. Same shape and limits as
 * the pass intent; it writes nothing but an address.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = (body?.email ?? "").trim();
  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 });
  }

  const voterId = await currentVoterId();
  const limiter = await rateLimit({ key: `loop:pass:waitlist:${voterId}`, limit: 6, windowMs: 10 * 60 * 1000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many tries. Give it a minute." }, { status: 429 });
  }

  const event = await getCurrentEvent();
  await recordConsent(event.id, email, "waitlist");
  return NextResponse.json({ ok: true });
}
