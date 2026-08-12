import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { issueForOrder } from "@/lib/loop/event-codes";
import { sendEventCodeEmail } from "@/lib/loop/email";

export const runtime = "nodejs";

/**
 * Mint one event code as if a pass had been bought — the "simulate a purchase"
 * button on /loop/admin, used to test the buy → code → email → redeem path
 * without taking money.
 *
 * This replaces `POST /api/loop/eventbrite/webhook`, which did the same job at a
 * PUBLIC path: it sat outside the `/api/loop/admin/*` prefix that middleware
 * gates, its secret check returned true whenever the env var was unset, and it
 * returned the minted code in the response body. Anyone who found the URL could
 * issue themselves entry to the event. Living under /api/loop/admin/ means
 * middleware requires a valid `ls_admin` session before this runs at all.
 *
 * Simulated orders are prefixed `sim:` so they are distinguishable in the
 * ledger, and they DO count toward the scarcity counter (they carry an
 * order_id) — clear them out before announcing or the public number is wrong.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };

  const suffix = crypto.randomUUID().slice(0, 8);
  const orderId = `sim:${suffix}`;
  const email = body.email?.trim() || `test+${suffix}@loopsoul.ca`;

  const event = await getCurrentEvent();
  const { code, isNew } = await issueForOrder(event.id, orderId, email, Date.now());

  const res = await sendEventCodeEmail(email, code, event.title);

  return NextResponse.json({ ok: true, code, isNew, email, delivered: res.ok });
}
