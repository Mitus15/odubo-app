import { NextResponse } from "next/server";
import { getCurrentEvent } from "@/lib/loop/hub";
import { issueForOrder } from "@/lib/loop/event-codes";
import { sendEventCodesEmail } from "@/lib/loop/email";
import {
  parseShopifyOrder,
  passMatcherConfigured,
  passUnitOrderIds,
  verifyShopifyHmac,
} from "@/lib/loop/pass";

// node crypto for the HMAC check.
export const runtime = "nodejs";

/**
 * Shopify pass webhook — "buy a pass on Shopify → get your event code(s)".
 *
 * Register in Shopify Admin (Settings → Notifications → Webhooks):
 *   Topic:  Order payment   (orders/paid — fires once the money is in)
 *   URL:    https://<site>/api/loop/pass/webhook
 *   Format: JSON
 *
 * Every pass in the order mints one code (a 2-pass order = 2 codes, one per
 * guest) against a stable per-unit order id, so Shopify's retries can never
 * double-issue. All codes go out in a single email. Non-pass orders and
 * unpaid states are acknowledged with 200 so Shopify doesn't retry them.
 *
 * Auth: Shopify signs every webhook with SHOPIFY_WEBHOOK_SECRET (shared with
 * odubo's order-confirmation webhook — same store, same signature).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!verifyShopifyHmac(rawBody, req.headers.get("x-shopify-hmac-sha256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const order = parseShopifyOrder(rawBody);
  if (!order) {
    return NextResponse.json({ error: "unrecognised order payload" }, { status: 400 });
  }

  if (!passMatcherConfigured()) {
    console.warn("[loop:pass] webhook hit but LOOP_PASS_SKU / LOOP_PASS_PRODUCT_ID are unset.");
    return NextResponse.json({ ok: true, skipped: "no pass matcher configured" });
  }
  if (order.passCount === 0) {
    return NextResponse.json({ ok: true, passes: 0 });
  }
  // With the recommended orders/paid topic this is always "paid"; the guard
  // covers a mis-registered orders/create hook on a manual-payment order.
  if (order.financialStatus && !["paid", "partially_paid"].includes(order.financialStatus)) {
    return NextResponse.json({ ok: true, skipped: `financial_status ${order.financialStatus}` });
  }

  const event = await getCurrentEvent();
  const now = Date.now();

  const codes: string[] = [];
  let anyNew = false;
  for (const unitOrderId of passUnitOrderIds(order.id, order.passCount)) {
    const { code, isNew } = await issueForOrder(event.id, unitOrderId, order.email, now);
    codes.push(code);
    if (isNew) anyNew = true;
  }

  // Only email when something was newly issued — a pure retry stays silent.
  // A partial retry (some units new) resends the FULL set so the buyer always
  // ends up with one complete email.
  let delivered = false;
  if (order.email && anyNew) {
    const res = await sendEventCodesEmail(order.email, codes, event.title);
    delivered = res.ok;
  }

  // Codes themselves stay out of the response — they travel by email only.
  return NextResponse.json({ ok: true, passes: order.passCount, issued: codes.length, anyNew, delivered });
}
