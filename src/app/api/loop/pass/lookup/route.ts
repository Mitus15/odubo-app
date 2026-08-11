import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { codesForEmail } from "@/lib/loop/event-codes";
import { rateLimit } from "@/lib/rateLimit";

/**
 * "Find my code" — the buyer's recovery path when the confirmation email never
 * lands. With no verified sending domain, email delivery to strangers can't be
 * trusted, so entry must not depend on it.
 *
 * A code is entry to the room, so this is rate-limited hard per IP: an attacker
 * would have to guess a real buyer's exact address, and gets few attempts.
 * Codes already redeemed are shown as such (helps the door, gives an attacker
 * nothing usable).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter the email you used at checkout." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limiter = await rateLimit({
    key: `loop:pass:lookup:${ip}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Too many lookups. Wait a few minutes, or ask at the door." },
      { status: 429 },
    );
  }

  const event = await getCurrentEvent();
  const codes = await codesForEmail(event.id, email);
  return NextResponse.json({ codes }, { headers: { "Cache-Control": "private, no-store" } });
}
