import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { hashCustomerId, parseUtmParams } from '@/lib/shopify-admin';

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
  switch (topic) {
    case 'orders/create':
    case 'orders/updated':
      await handleOrderWebhook(payload);
      break;

    case 'orders/cancelled':
      await handleOrderCancelled(payload);
      break;

    case 'refunds/create':
      await handleRefund(payload);
      break;

    default:
      console.log(`[Webhook] Unhandled topic: ${topic}`);
  }

  // Log webhook
  await executeQuery(
    `INSERT INTO sync_logs (job_type, platform, status, records_fetched, records_inserted, completed_at)
     VALUES (?, 'shopify', 'completed', 1, 1, datetime('now'))`,
    [`webhook_${topic}`]
  );

  return NextResponse.json({ success: true, topic });
}

/**
 * Handle order create/update webhook
 *
 * Note: On Basic plan, customer field only contains:
 * - id
 * - No email, name, or address
 */
async function handleOrderWebhook(order: any) {
  const orderId = `order_${order.id}`;
  const shopifyId = `gid://shopify/Order/${order.id}`;
  const orderNumber = order.order_number || 0;

  // Check if this is a new order (before the order UPSERT)
  const existingOrder = await queryDatabase(
    `SELECT id FROM commerce_orders WHERE shopify_id = ?`,
    [shopifyId]
  );
  const isNewOrder = existingOrder.length === 0;

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
  await executeQuery(
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
       updated_at = datetime('now')`,
    [
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
      order.cancelled_at,
    ]
  );

  // UPSERT line items (idempotent - safe for duplicate webhooks)
  const lineItems = order.line_items || [];
  for (const item of lineItems) {
    await executeQuery(
      `INSERT INTO commerce_order_items (
         order_id, shopify_line_item_id,
         product_id, product_title, variant_id, variant_title, sku,
         quantity, price_cents, total_discount_cents
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(order_id, shopify_line_item_id) DO UPDATE SET
         product_id = excluded.product_id,
         product_title = excluded.product_title,
         variant_id = excluded.variant_id,
         variant_title = excluded.variant_title,
         sku = excluded.sku,
         quantity = excluded.quantity,
         price_cents = excluded.price_cents,
         total_discount_cents = excluded.total_discount_cents`,
      [
        orderId,
        `${item.id}`,
        item.product_id ? `gid://shopify/Product/${item.product_id}` : null,
        item.title,
        item.variant_id ? `gid://shopify/ProductVariant/${item.variant_id}` : null,
        item.variant_title,
        item.sku,
        item.quantity,
        Math.round(parseFloat(item.price || '0') * 100 * item.quantity),
        Math.round(parseFloat(item.total_discount || '0') * 100),
      ]
    );
  }

  // Clean up removed items (items no longer in order)
  if (lineItems.length > 0) {
    const itemIds = lineItems.map((i: any) => `${i.id}`);
    const placeholders = itemIds.map(() => '?').join(',');
    await executeQuery(
      `DELETE FROM commerce_order_items WHERE order_id = ? AND shopify_line_item_id NOT IN (${placeholders})`,
      [orderId, ...itemIds]
    );
  }

  // Update/create customer record - only increment total_orders for NEW orders
  if (order.customer?.id && customerHash) {
    if (isNewOrder) {
      await executeQuery(
        `INSERT INTO commerce_customers (id, shopify_customer_id, customer_hash, total_orders, first_order_at, last_order_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(shopify_customer_id) DO UPDATE SET
           total_orders = commerce_customers.total_orders + 1,
           last_order_at = MAX(commerce_customers.last_order_at, excluded.last_order_at),
           updated_at = datetime('now')`,
        [customerHash, `${order.customer.id}`, customerHash, order.created_at, order.created_at]
      );
    } else {
      // For existing orders, only update last_order_at (don't increment total_orders)
      await executeQuery(
        `UPDATE commerce_customers SET
           last_order_at = MAX(last_order_at, ?),
           updated_at = datetime('now')
         WHERE shopify_customer_id = ?`,
        [order.created_at, `${order.customer.id}`]
      );
    }
  }

  // Update daily metrics for this order's date
  const orderDate = order.created_at?.split('T')[0];
  if (orderDate) {
    await updateDailyMetrics(orderDate);
  }
}

/**
 * Handle order cancelled webhook
 */
async function handleOrderCancelled(order: any) {
  const shopifyId = `gid://shopify/Order/${order.id}`;

  await executeQuery(
    `UPDATE commerce_orders SET
       cancelled_at = ?,
       updated_at = datetime('now')
     WHERE shopify_id = ?`,
    [order.cancelled_at, shopifyId]
  );
}

/**
 * Handle refund webhook
 */
async function handleRefund(refund: any) {
  const shopifyOrderId = `gid://shopify/Order/${refund.order_id}`;

  // Update order financial status
  await executeQuery(
    `UPDATE commerce_orders SET
       financial_status = 'refunded',
       updated_at = datetime('now')
     WHERE shopify_id = ?`,
    [shopifyOrderId]
  );
}

/**
 * Update daily metrics for a specific date
 */
async function updateDailyMetrics(date: string) {
  const results = await queryDatabase(
    `SELECT
       COUNT(*) as total_orders,
       SUM(total_price_cents) as total_revenue_cents,
       AVG(total_price_cents) as avg_order_value_cents
     FROM commerce_orders
     WHERE date(shopify_created_at) = ?
       AND financial_status NOT IN ('voided', 'refunded')`,
    [date]
  );

  const result = results?.[0] as any;
  if (result) {
    await executeQuery(
      `INSERT INTO commerce_daily_metrics (date, total_orders, total_revenue_cents, avg_order_value_cents, computed_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(date) DO UPDATE SET
         total_orders = excluded.total_orders,
         total_revenue_cents = excluded.total_revenue_cents,
         avg_order_value_cents = excluded.avg_order_value_cents,
         computed_at = datetime('now')`,
      [date, result.total_orders || 0, result.total_revenue_cents || 0, Math.round(result.avg_order_value_cents || 0)]
    );
  }
}
