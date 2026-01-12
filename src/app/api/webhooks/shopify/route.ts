import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { toCents, extractOrderNumber, hashCustomerId, parseUtmParams } from '@/lib/shopify-admin';

export const runtime = 'edge';

/**
 * Shopify Webhook Handler
 *
 * POST /api/webhooks/shopify
 *
 * Handles real-time order events from Shopify.
 * Note: On Basic plan, webhooks don't include customer PII.
 *
 * Supported topics:
 * - orders/create
 * - orders/updated
 * - orders/cancelled
 * - refunds/create
 */
export async function POST(request: NextRequest) {
  try {
    // Get webhook topic from header
    const topic = request.headers.get('x-shopify-topic');
    const shopDomain = request.headers.get('x-shopify-shop-domain');
    const hmac = request.headers.get('x-shopify-hmac-sha256');

    if (!topic) {
      return NextResponse.json({ error: 'Missing webhook topic' }, { status: 400 });
    }

    // Verify HMAC signature (optional but recommended)
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (webhookSecret && hmac) {
      const body = await request.text();
      const isValid = await verifyWebhook(body, hmac, webhookSecret);
      if (!isValid) {
        console.error('[Webhook] Invalid HMAC signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      // Parse body after verification
      const payload = JSON.parse(body);
      return await handleWebhook(topic, payload, shopDomain);
    }

    // If no secret configured, parse body directly
    const payload = await request.json();
    return await handleWebhook(topic, payload, shopDomain);
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook failed' },
      { status: 500 }
    );
  }
}

/**
 * Verify Shopify webhook HMAC signature
 */
async function verifyWebhook(body: string, hmac: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));

    return computed === hmac;
  } catch {
    return false;
  }
}

/**
 * Handle webhook based on topic
 */
async function handleWebhook(
  topic: string,
  payload: any,
  shopDomain: string | null
): Promise<NextResponse> {
  const { env } = getRequestContext();
  const db = env.DB;

  switch (topic) {
    case 'orders/create':
    case 'orders/updated':
      await handleOrderWebhook(db, payload);
      break;

    case 'orders/cancelled':
      await handleOrderCancelled(db, payload);
      break;

    case 'refunds/create':
      await handleRefund(db, payload);
      break;

    default:
      console.log(`[Webhook] Unhandled topic: ${topic}`);
  }

  // Log webhook
  await db
    .prepare(
      `INSERT INTO sync_logs (job_type, platform, status, records_fetched, records_inserted, completed_at)
       VALUES (?, 'shopify', 'completed', 1, 1, datetime('now'))`
    )
    .bind(`webhook_${topic}`)
    .run();

  return NextResponse.json({ success: true, topic });
}

/**
 * Handle order create/update webhook
 *
 * Note: On Basic plan, customer field only contains:
 * - id
 * - No email, name, or address
 */
async function handleOrderWebhook(db: any, order: any) {
  const orderId = `order_${order.id}`;
  const shopifyId = `gid://shopify/Order/${order.id}`;
  const orderNumber = order.order_number || 0;

  // Parse UTM from landing site
  const utm = parseUtmParams(order.landing_site);

  // Hash customer ID for privacy
  const customerHash = order.customer?.id ? hashCustomerId(`${order.customer.id}`) : null;

  // Calculate totals in cents
  const totalPriceCents = Math.round(parseFloat(order.total_price || '0') * 100);
  const subtotalCents = Math.round(parseFloat(order.subtotal_price || '0') * 100);
  const totalTaxCents = Math.round(parseFloat(order.total_tax || '0') * 100);
  const totalDiscountsCents = Math.round(parseFloat(order.total_discounts || '0') * 100);

  // Upsert order
  await db
    .prepare(
      `INSERT INTO commerce_orders (
         id, shopify_id, shopify_order_number,
         total_price_cents, subtotal_price_cents, total_tax_cents, total_discounts_cents, currency,
         financial_status, fulfillment_status,
         customer_id, customer_hash,
         source_name, referring_site, landing_site,
         utm_source, utm_medium, utm_campaign,
         shopify_created_at, shopify_updated_at, processed_at, closed_at, cancelled_at,
         data_source, synced_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'webhook', datetime('now'), datetime('now'))
       ON CONFLICT(shopify_id) DO UPDATE SET
         total_price_cents = excluded.total_price_cents,
         subtotal_price_cents = excluded.subtotal_price_cents,
         total_tax_cents = excluded.total_tax_cents,
         total_discounts_cents = excluded.total_discounts_cents,
         financial_status = excluded.financial_status,
         fulfillment_status = excluded.fulfillment_status,
         shopify_updated_at = excluded.shopify_updated_at,
         closed_at = excluded.closed_at,
         cancelled_at = excluded.cancelled_at,
         synced_at = datetime('now'),
         updated_at = datetime('now')`
    )
    .bind(
      orderId,
      shopifyId,
      orderNumber,
      totalPriceCents,
      subtotalCents,
      totalTaxCents,
      totalDiscountsCents,
      order.currency || 'USD',
      order.financial_status,
      order.fulfillment_status,
      order.customer?.id ? `${order.customer.id}` : null,
      customerHash,
      order.source_name,
      order.referring_site,
      order.landing_site,
      utm.utm_source || null,
      utm.utm_medium || null,
      utm.utm_campaign || null,
      order.created_at,
      order.updated_at,
      order.processed_at,
      order.closed_at,
      order.cancelled_at
    )
    .run();

  // Delete existing line items and re-insert
  await db.prepare(`DELETE FROM commerce_order_items WHERE order_id = ?`).bind(orderId).run();

  // Insert line items
  for (const item of order.line_items || []) {
    await db
      .prepare(
        `INSERT INTO commerce_order_items (
           order_id, shopify_line_item_id,
           product_id, product_title, variant_id, variant_title, sku,
           quantity, price_cents, total_discount_cents
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        orderId,
        `${item.id}`,
        item.product_id ? `gid://shopify/Product/${item.product_id}` : null,
        item.title,
        item.variant_id ? `gid://shopify/ProductVariant/${item.variant_id}` : null,
        item.variant_title,
        item.sku,
        item.quantity,
        Math.round(parseFloat(item.price || '0') * 100 * item.quantity),
        Math.round(parseFloat(item.total_discount || '0') * 100)
      )
      .run();
  }

  // Update/create customer record
  if (order.customer?.id && customerHash) {
    await db
      .prepare(
        `INSERT INTO commerce_customers (id, shopify_customer_id, customer_hash, total_orders, first_order_at, last_order_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(shopify_customer_id) DO UPDATE SET
           total_orders = commerce_customers.total_orders + 1,
           last_order_at = MAX(commerce_customers.last_order_at, excluded.last_order_at),
           updated_at = datetime('now')`
      )
      .bind(customerHash, `${order.customer.id}`, customerHash, order.created_at, order.created_at)
      .run();
  }

  // Update daily metrics for this order's date
  const orderDate = order.created_at?.split('T')[0];
  if (orderDate) {
    await updateDailyMetrics(db, orderDate);
  }
}

/**
 * Handle order cancelled webhook
 */
async function handleOrderCancelled(db: any, order: any) {
  const shopifyId = `gid://shopify/Order/${order.id}`;

  await db
    .prepare(
      `UPDATE commerce_orders SET
         cancelled_at = ?,
         updated_at = datetime('now')
       WHERE shopify_id = ?`
    )
    .bind(order.cancelled_at, shopifyId)
    .run();
}

/**
 * Handle refund webhook
 */
async function handleRefund(db: any, refund: any) {
  const shopifyOrderId = `gid://shopify/Order/${refund.order_id}`;

  // Update order financial status
  await db
    .prepare(
      `UPDATE commerce_orders SET
         financial_status = 'refunded',
         updated_at = datetime('now')
       WHERE shopify_id = ?`
    )
    .bind(shopifyOrderId)
    .run();
}

/**
 * Update daily metrics for a specific date
 */
async function updateDailyMetrics(db: any, date: string) {
  const result = await db
    .prepare(
      `SELECT
         COUNT(*) as total_orders,
         SUM(total_price_cents) as total_revenue_cents,
         AVG(total_price_cents) as avg_order_value_cents
       FROM commerce_orders
       WHERE date(shopify_created_at) = ?
         AND financial_status NOT IN ('voided', 'refunded')`
    )
    .bind(date)
    .first();

  if (result) {
    await db
      .prepare(
        `INSERT INTO commerce_daily_metrics (date, total_orders, total_revenue_cents, avg_order_value_cents, computed_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(date) DO UPDATE SET
           total_orders = excluded.total_orders,
           total_revenue_cents = excluded.total_revenue_cents,
           avg_order_value_cents = excluded.avg_order_value_cents,
           computed_at = datetime('now')`
      )
      .bind(
        date,
        result.total_orders || 0,
        result.total_revenue_cents || 0,
        Math.round(result.avg_order_value_cents || 0)
      )
      .run();
  }
}
