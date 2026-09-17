import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { codesForEmail } from "@/lib/loop/event-codes";
import { deliverPassEmail } from "@/lib/loop/pass/deliver";
import { normEmail } from "@/lib/loop/recovery";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Lost your pass? Type the email you paid with and the pass email is sent
 * again: the ticket, the number, the button that opens your page.
 *
 * Nothing is shown on screen and no digits are typed back. The address only
 * ever RECEIVES; knowing somebody's email gets you nothing but their inbox's
 * mail. The answer is the same whether or not a pass exists for the address,
 * so the page cannot be used to check who bought one.
 *
 * This replaced a six-digit one-time code (2026-09-14 to 2026-09-16). It was
 * safe and it was a second login for people who had just been given one.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter the email you paid with." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const [perIp, perEmail] = await Promise.all([
    rateLimit({ key: `loop:pass:lookup:${ip}`, limit: 8, windowMs: 15 * 60 * 1000 }),
    rateLimit({ key: `loop:pass:resend:${normEmail(email)}`, limit: 3, windowMs: 15 * 60 * 1000 }),
  ]);
  if (!perIp.allowed || !perEmail.allowed) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes, or ask at the door." }, { status: 429 });
  }

  const event = await getCurrentEvent();
  const codes = await codesForEmail(event.id, email);
  if (codes.length > 0) {
    const sent = await deliverPassEmail(event.id, normEmail(email), codes.map((c) => c.code));
    if (!sent.ok) console.error(`[loop:pass] resend NOT sent to ${normEmail(email)}`);
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
