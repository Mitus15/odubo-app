import { NextRequest, NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { attachEmail, countRedeemed, generate, listCodes, lookupCode } from "@/lib/loop/event-codes";
import { grantAlbumForOrder } from "@/lib/loop/album";
import { sendEventCodesEmail } from "@/lib/loop/email";

/**
 * Event codes for the door: list them (with redeemed state) and bulk-generate.
 * Auth: middleware gates /api/loop/admin/*.
 *
 *   POST { count }                    → mint that many door codes
 *   POST { action: "attach", code, email } → put an address on a pass, write
 *        its pre-order, and send the pass email with the ticket QR
 *   POST { action: "resend", code }   → send the pass email again
 *
 * "attach" exists because Shopify sends paid orders with no buyer email until
 * the app is granted Protected Customer Data access. The host reads the
 * address off the order in Shopify and types it here; everything the webhook
 * would have done with it happens now.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function deliver(eventId: string, eventTitle: string, code: string) {
  const pass = await lookupCode(eventId, code);
  if (!pass) return NextResponse.json({ error: "No such code on this volume." }, { status: 404 });
  if (!pass.email) return NextResponse.json({ error: "That pass has no address yet. Attach one first." }, { status: 400 });
  if (pass.orderId && !pass.sim) await grantAlbumForOrder(pass.email, pass.orderId, eventId);
  const res = await sendEventCodesEmail(pass.email, [pass.code], eventTitle);
  return NextResponse.json({ ok: true, delivered: res.ok, email: pass.email, code: pass.code });
}
export async function GET() {
  const event = await getCurrentEvent();
  const [codes, stats] = await Promise.all([
    listCodes(event.id),
    countRedeemed(event.id),
  ]);
  return NextResponse.json({ codes, stats });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { count?: number; action?: string; code?: string; email?: string }
    | null;
  const event = await getCurrentEvent();

  if (body?.action === "attach") {
    const code = (body.code ?? "").trim().toUpperCase();
    const email = (body.email ?? "").trim().toLowerCase();
    if (!code) return NextResponse.json({ error: "Which code?" }, { status: 400 });
    if (!EMAIL.test(email)) return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 });
    if (!(await attachEmail(event.id, code, email))) {
      return NextResponse.json({ error: "No such code on this volume." }, { status: 404 });
    }
    return deliver(event.id, event.title, code);
  }
  if (body?.action === "resend") {
    const code = (body.code ?? "").trim().toUpperCase();
    if (!code) return NextResponse.json({ error: "Which code?" }, { status: 400 });
    return deliver(event.id, event.title, code);
  }

  const count = Math.min(Math.max(Number(body?.count) || 0, 1), 100);
  const created = await generate(event.id, count, Date.now());
  const stats = await countRedeemed(event.id);
  return NextResponse.json({ success: true, created, stats });
}
