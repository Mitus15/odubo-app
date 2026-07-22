import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { parseOrderWebhook, webhookSecretOk } from "@/lib/loop/eventbrite";
import { issueForOrder } from "@/lib/loop/event-codes";
import { sendEventCodeEmail } from "@/lib/loop/email";

/**
 * Order webhook — the "buy a ticket → get your unique code" hook.
 *
 * On a completed purchase: mint exactly one unique event code bound to that
 * order (idempotent, so retries don't double-issue) and email it to the buyer.
 * In `mock` mode this is driven by the admin "simulate a purchase" tool with a
 * `{ orderId, email }` body; flip `EVENTBRITE_MODE=live` (+ `EMAIL_MODE=live`)
 * and the same path runs off real Eventbrite orders.
 *
 * Auth: Eventbrite webhooks aren't HMAC-signed, so the endpoint is protected by
 * a shared secret on its URL (`?secret=…`, checked by `webhookSecretOk`). When
 * `EVENTBRITE_WEBHOOK_SECRET` is unset (mock/dev) the check is skipped.
 */
export async function POST(req: Request) {
  if (!webhookSecretOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = await req.text();
  const order = await parseOrderWebhook(raw);
  if (!order) {
    return NextResponse.json({ error: "unrecognised order payload" }, { status: 400 });
  }

  const event = await getCurrentEvent();
  const { code, isNew } = await issueForOrder(event.id, order.orderId, order.email, Date.now());

  let delivered = false;
  if (order.email) {
    const res = await sendEventCodeEmail(order.email, code, event.title);
    delivered = res.ok;
  }

  return NextResponse.json({ ok: true, code, isNew, delivered });
}
