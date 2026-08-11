import crypto from "crypto";
import { queryOne } from "@/lib/loop/db";
import { getCurrentEvent } from "@/lib/loop/hub";
import { getEventbrite, type CapacityInfo, type EventbriteProvider } from "@/lib/loop/eventbrite";
import { getPassSettings } from "./settings";

/**
 * Shopify pass sales for Loop Soul. Shopify handles money and inventory; Loop
 * keeps identity — a purchase mints event codes (the ticket) via the same
 * idempotent `issueForOrder` chain the Eventbrite path uses.
 *
 * Dormant until configured:
 *   PASS_MODE=shopify                     → capacity comes from issued codes
 *   LOOP_PASS_SKU / LOOP_PASS_PRODUCT_ID  → which line items are passes
 *   SHOPIFY_WEBHOOK_SECRET                → webhook HMAC (shared with odubo's)
 *   NEXT_PUBLIC_LOOP_PASS_CHECKOUT_URL    → Get Pass button target
 */

/* ---------------------------------------------------------------- webhook */

/** Verify Shopify's X-Shopify-Hmac-Sha256 over the RAW body (base64 HMAC). */
export function verifyShopifyHmac(rawBody: string, signature: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured: allow only outside production (local/mock driving).
    if (process.env.NODE_ENV === "production") {
      console.error("[loop:pass] SHOPIFY_WEBHOOK_SECRET is not set — rejecting webhook.");
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
 * Capacity when passes sell through Shopify: sold = codes issued against
 * ticket orders (order_id IS NOT NULL — admin hand-outs don't count), total =
 * the event's seed capacity. No Shopify API call; D1 is the ledger.
 */
class ShopifyPassProvider implements EventbriteProvider {
  async getCapacity(): Promise<CapacityInfo> {
    const event = await getCurrentEvent();
    const row = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM event_codes WHERE event_id = ?1 AND order_id IS NOT NULL`,
      [event.id],
    );
    const sold = row?.n ?? 0;
    const total = event.capacity;
    return { total, sold, remaining: Math.max(0, total - sold) };
  }
}

/**
 * Capacity via the active pass mode — admin-set in loop_settings (env
 * fallback): "shopify" reads the D1 code ledger; "mock" keeps the existing
 * Eventbrite chain (live or mock counters).
 */
export async function getPassCapacity(): Promise<CapacityInfo> {
  const settings = await getPassSettings();
  return settings.mode === "shopify"
    ? new ShopifyPassProvider().getCapacity()
    : getEventbrite().getCapacity();
}
