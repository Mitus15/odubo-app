import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/anthem-server";
import { checkVerification, recoverForVerifiedOwner } from "@/lib/loop/recovery";
import { rateLimit } from "@/lib/rateLimit";

/**
 * "Find my code", step two: the six digits come back, this device becomes the
 * buyer's. Every pass bought with the address is held here from now on, and
 * any of them sitting on a stranger's phone is taken back.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: string; code?: string } | null;
  const email = body?.email?.trim();
  const code = body?.code?.replace(/\D/g, "");
  if (!email || !code || code.length !== 6) {
    return NextResponse.json({ error: "Enter the six digits from the email." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limiter = await rateLimit({ key: `loop:otp:verify:${ip}`, limit: 12, windowMs: 15 * 60 * 1000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  }

  const outcome = await checkVerification(email, code);
  if (outcome !== "ok") {
    const message =
      outcome === "wrong"
        ? "That's not the code. Check the email and try again."
        : outcome === "burned"
          ? "Too many wrong tries. Ask for a new code."
          : "That code has expired. Ask for a new one.";
    return NextResponse.json({ error: message, outcome }, { status: 400 });
  }

  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  if (voterId === "anonymous") {
    return NextResponse.json({ error: "Open this page in your browser, not a preview, and try again." }, { status: 400 });
  }

  const result = await recoverForVerifiedOwner(event.id, email, voterId);
  return NextResponse.json(
    { ok: true, codes: result.codes, taken: result.taken, evicted: result.evicted },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
