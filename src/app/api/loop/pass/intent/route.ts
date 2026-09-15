import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { getPassSettings } from "@/lib/loop/pass/settings";
import { checkoutUrlWithIntent, createIntent } from "@/lib/loop/passIntent";
import { recordConsent } from "@/lib/loop/guests";
import { rateLimit } from "@/lib/rateLimit";
import { currentVoterId } from "@/lib/loop/identity/voter";

export const runtime = "nodejs";

/**
 * "Where should we send your pass?" — the one field Shopify Basic makes
 * necessary. Records the address, then hands back the checkout link with it
 * prefilled, so the buyer types it once and Shopify's own email field arrives
 * filled in.
 *
 * Public by design: it is a step in buying a ticket, not a gate. It writes
 * nothing but an address and a token, and it never blocks the sale — the
 * caller falls back to the plain checkout link if this fails.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: string; consent?: boolean } | null;
  const email = (body?.email ?? "").trim();
  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 });
  }

  const voterId = await currentVoterId();
  const limiter = await rateLimit({ key: `loop:pass:intent:${voterId}`, limit: 12, windowMs: 10 * 60 * 1000 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many tries. Give it a minute." }, { status: 429 });
  }

  const [event, settings] = await Promise.all([getCurrentEvent(), getPassSettings()]);
  if (!settings.checkoutUrl) {
    return NextResponse.json({ error: "Checkout is not configured yet." }, { status: 503 });
  }

  const token = await createIntent(event.id, email);
  // Express, opt-in, recorded with the moment it was given. Never assumed.
  if (body?.consent === true) await recordConsent(event.id, email, "pass-sheet");
  return NextResponse.json({ ok: true, checkoutUrl: checkoutUrlWithIntent(settings.checkoutUrl, email, token) });
}
