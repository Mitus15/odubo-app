import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { sendVerificationEmail } from "@/lib/loop/email";
import { createVerification, hasPassesForEmail, normEmail } from "@/lib/loop/recovery";
import { rateLimit } from "@/lib/rateLimit";

/**
 * "Find my code", step one: prove the inbox.
 *
 * This used to hand the raw pass code to whoever typed the right email, and a
 * button beneath it bound that code to their browser. Knowing a buyer's
 * address was enough to take their night. Now the address only ever receives
 * a six-digit code; nothing is shown until it is typed back (see /verify).
 *
 * The answer is the same whether or not a pass exists for the address, so the
 * page cannot be used to check who bought one. The email is only sent when
 * there is something to recover.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter the email you used at checkout." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const [perIp, perEmail] = await Promise.all([
    rateLimit({ key: `loop:pass:lookup:${ip}`, limit: 8, windowMs: 15 * 60 * 1000 }),
    rateLimit({ key: `loop:otp:send:${normEmail(email)}`, limit: 3, windowMs: 15 * 60 * 1000 }),
  ]);
  if (!perIp.allowed || !perEmail.allowed) {
    return NextResponse.json(
      { error: "Too many tries. Wait a few minutes, or ask at the door." },
      { status: 429 },
    );
  }

  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  if (await hasPassesForEmail(event.id, email)) {
    const code = await createVerification(email, voterId);
    const sent = await sendVerificationEmail(email, code);
    if (!sent.ok) console.error(`[loop:recovery] verification email NOT sent to ${normEmail(email)}`);
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
