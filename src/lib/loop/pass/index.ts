import crypto from "crypto";
import { queryOne } from "@/lib/loop/db";
import { getCurrentEvent } from "@/lib/loop/hub";
import { getPassSettings } from "./settings";

/**
 * Shopify pass sales for Loop Soul. Shopify handles money and inventory; Loop
 * keeps identity — a purchase mints event codes (the ticket) through the
 * idempotent `issueForOrder` chain.
 *
 * Shopify is the ONLY ticketing path. The Eventbrite provider chain that used
 * to sit behind this was removed: it was never going to be used, its public
 * webhook minted real event codes for anyone who posted to it, and its "mock"
 * capacity provider was the thing publishing invented sales figures.
 *
 * Configured from /loop/admin (D1 `loop_settings`), env as fallback:
 *   LOOP_PASS_SKU / LOOP_PASS_PRODUCT_ID  → which line items are passes
 *   SHOPIFY_WEBHOOK_SECRET                → webhook HMAC (shared with odubo's)
 *   NEXT_PUBLIC_LOOP_PASS_CHECKOUT_URL    → Get Pass button target
 */

/** Passes sold / remaining for the scarcity counter. */
export type CapacityInfo = { total: number; sold: number; remaining: number };

/* ---------------------------------------------------------------- webhook */

/** Verify Shopify's X-Shopify-Hmac-Sha256 over the RAW body (base64 HMAC).
 *  The secret comes from pass settings (D1 `pass_webhook_secret`, env
 *  fallback) — API-registered webhooks sign with the registering app's API
 *  secret key, not the store notification secret. */
export function verifyShopifyHmac(
  rawBody: string,
  signature: string | null,
  secret: string | null,
): boolean {
  if (!secret) {
    // No secret configured: allow only outside production (local/mock driving).
    if (process.env.NODE_ENV === "production") {
      console.error("[loop:pass] no webhook secret configured — rejecting webhook.");
      return false;
    }
    console.warn("[loop:pass] Skipping webhook signature verification (dev, no secret).");
    return true;
  }
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type ShopifyOrder = {
  id: string;
  email: string | null;
  financialStatus: string | null;
  passCount: number;
};

/**
 * Parse a Shopify order webhook body and count how many passes it contains.
 * A line item is a pass when its SKU matches LOOP_PASS_SKU or its product id
 * matches LOOP_PASS_PRODUCT_ID. Returns null for unusable payloads; a valid
 * order with no pass items comes back with passCount 0.
 */
export function parseShopifyOrder(
  rawBody: string,
  matcher: { sku: string | null; productId: string | null },
): ShopifyOrder | null {
  let body: {
    id?: number | string;
    email?: string | null;
    contact_email?: string | null;
    financial_status?: string | null;
    line_items?: Array<{ sku?: string | null; product_id?: number | string | null; quantity?: number }>;
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (body.id === undefined || body.id === null) return null;

  const { sku, productId } = matcher;

  let passCount = 0;
  if (sku || productId) {
    for (const item of body.line_items ?? []) {
      const skuMatch = sku && item.sku && item.sku === sku;
      const idMatch =
        productId && item.product_id !== undefined && item.product_id !== null &&
        String(item.product_id) === productId;
      if (skuMatch || idMatch) passCount += Math.max(1, Number(item.quantity) || 1);
    }
  }

  return {
    id: String(body.id),
    email: body.email ?? body.contact_email ?? null,
    financialStatus: body.financial_status ?? null,
    passCount,
  };
}

/** True when at least one pass matcher is configured. */
export function passMatcherConfigured(matcher: { sku: string | null; productId: string | null }): boolean {
  return Boolean(matcher.sku || matcher.productId);
}

/**
 * Stable per-pass order ids: a 2-pass order issues codes against
 * "shopify:1001#1" and "shopify:1001#2". Retries reuse the same ids, so
 * `issueForOrder`'s (event_id, order_id) idempotency holds per pass unit.
 */
export function passUnitOrderIds(orderId: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `shopify:${orderId}#${i + 1}`);
}

/* --------------------------------------------------------------- capacity */

/**
 * The scarcity counter, from the only source that can't lie: D1.
 *
 * `sold` counts codes issued against real ticket orders (`order_id IS NOT NULL`
 * — admin hand-outs and comps don't count as sales). `total` is the event's
 * capacity, which the venue owns and an admin edits (migration 149).
 *
 * There is deliberately no mode switch and no env override here. This number is
 * published on /loop as a claim about ticket sales, so the only acceptable
 * answer is the true one: before anything sells it reads 0 sold, which is
 * correct and unembarrassing. The previous implementation defaulted an
 * unconfigured deploy to "44 sold of 75" and put that in front of the public.
 */
export async function getPassCapacity(): Promise<CapacityInfo> {
  const event = await getCurrentEvent();
  // `sim:` orders are the admin "simulate a purchase" tool, not sales. Without
  // this exclusion every test press inflated the public sold counter — the
  // exact fabricated-scarcity failure this function exists to prevent.
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM event_codes
      WHERE event_id = ?1 AND order_id IS NOT NULL AND order_id NOT LIKE 'sim:%'`,
    [event.id],
  );
  const sold = row?.n ?? 0;
  const total = event.capacity;
  return { total, sold, remaining: Math.max(0, total - sold) };
}
