import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/identity/voter";
import { parseScannedCode } from "@/lib/loop/door";
import { claimPassOnDevice } from "@/lib/loop/pass/claim";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * Enter your pass. The code on the ticket IS the login (owner, 2026-09-16):
 * type it on any phone and that phone is yours, with nothing else to prove.
 * Same trust as a paper ticket, and the same binding the email's button does
 * (see lib/loop/pass/claim.ts), so the two ways in can never disagree.
 *
 * Rate limited per IP: the code space is a million, and a gate that can be
 * guessed at is not a gate.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = parseScannedCode(body?.code);
  if (!code) {
    return NextResponse.json({ error: "That doesn't look like a pass. It reads LOOP and four characters." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limiter = await rateLimit({ key: `loop:pass:enter:${ip}`, limit: 20, windowMs: 10 * 60 * 1000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  }

  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  if (voterId === "anonymous") {
    return NextResponse.json({ error: "Open this page in your browser, not a preview, and try again." }, { status: 400 });
  }

  const held = await claimPassOnDevice(event.id, code, voterId);
  if (!held) {
    return NextResponse.json({ error: "We don't know that pass. Check it against your ticket." }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
