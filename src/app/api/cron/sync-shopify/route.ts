import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import {
  fetchOrders,
  toCents,
  extractOrderNumber,
  hashCustomerId,
  parseUtmParams,
  isAdminApiConfigured,
  type ShopifyAdminOrder,
} from '@/lib/shopify-admin';

export const runtime = 'edge';

/**
 * Shopify Order Sync Cron Job
 *
 * POST /api/cron/sync-shopify
 *
 * Fetches orders from Shopify Admin API and stores them in D1.
 * Supports incremental sync (only new/updated orders).
 *
 * Can be called:
 * - Via cron scheduler (Vercel Cron or Cloudflare)
 * - Manually from admin UI
 * - Via webhook trigger for real-time updates
 *
 * Query params:
 * - full=true: Force full sync instead of incremental
 * - limit=N: Limit number of orders to sync (for testing)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let syncLogId: number | null = null;

  try {
    // Check if Admin API is configured
    if (!isAdminApiConfigured()) {
      return NextResponse.json(
        { error: 'Shopify Admin API not configured. Set SHOPIFY_ADMIN_ACCESS_TOKEN.' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fullSync = searchParams.get('full') === 'true';
    const limitParam = searchParams.get('limit');
    const maxOrders = limitParam ? parseInt(limitParam, 10) : 500;

    // Create sync log entry
    await executeQuery(
      `INSERT INTO sync_logs (job_type, platform, status, started_at)
       VALUES ('commerce_orders', 'shopify', 'running', datetime('now'))`,
      []
    );

    // Get the last inserted id
    const logResults = await queryDatabase(
      `SELECT id FROM sync_logs WHERE job_type = 'commerce_orders' ORDER BY id DESC LIMIT 1`,
      []
    );
    syncLogId = (logResults?.[0] as any)?.id || null;

    // Get last sync time for incremental updates
    let sinceDate: string | undefined;
    if (!fullSync) {
      const syncStatusResults = await queryDatabase(
        `SELECT last_updated_at FROM commerce_sync_status WHERE sync_type = 'orders'`,
        []
      );
      const syncStatus = syncStatusResults?.[0] as { last_updated_at: string | null } | undefined;
      sinceDate = syncStatus?.last_updated_at || undefined;
    }

    // Fetch orders from Shopify
    let cursor: string | undefined;
    let totalFetched = 0;
    let totalInserted = 0;
    let latestUpdatedAt: string | null = null;

    while (totalFetched < maxOrders) {
      const { orders, pageInfo } = await fetchOrders({
        since: sinceDate,
        cursor,
        limit: Math.min(50, maxOrders - totalFetched),
      });

      if (orders.length === 0) break;

      // Process orders
      for (const order of orders) {
        try {
          const inserted = await upsertOrder(order);
          if (inserted) totalInserted++;

          // Track latest update time
          if (!latestUpdatedAt || order.updatedAt > latestUpdatedAt) {
            latestUpdatedAt = order.updatedAt;
          }
        } catch (err) {
          console.error(`[Sync] Error processing order ${order.id}:`, err);
        }
      }

      totalFetched += orders.length;

      // Check for more pages
      if (!pageInfo.hasNextPage) break;
      cursor = pageInfo.endCursor || undefined;
    }

    // Update sync status
    if (latestUpdatedAt) {
      await executeQuery(
        `INSERT INTO commerce_sync_status (sync_type, last_updated_at, total_synced, last_sync_count, status, completed_at)
         VALUES ('orders', ?, ?, ?, 'idle', datetime('now'))
         ON CONFLICT(sync_type) DO UPDATE SET
           last_updated_at = excluded.last_updated_at,
           total_synced = commerce_sync_status.total_synced + excluded.last_sync_count,
           last_sync_count = excluded.last_sync_count,
           status = 'idle',
           completed_at = datetime('now')`,
        [latestUpdatedAt, totalInserted, totalInserted]
      );
    }

    // Update sync log
    const duration = Date.now() - startTime;
    if (syncLogId) {
      await executeQuery(
        `UPDATE sync_logs SET
           status = 'completed',
           records_fetched = ?,
           records_inserted = ?,
           completed_at = datetime('now')
         WHERE id = ?`,
        [totalFetched, totalInserted, syncLogId]
      );
    }

    // Recompute daily metrics
    await recomputeDailyMetrics();

    return NextResponse.json({
      success: true,
      fetched: totalFetched,
      inserted: totalInserted,
      duration: `${duration}ms`,
      incremental: !fullSync,
      lastUpdatedAt: latestUpdatedAt,
    });
  } catch (error) {
    console.error('[Sync Shopify] Error:', error);

    // Update sync log on error
    if (syncLogId) {
      try {
        await executeQuery(
          `UPDATE sync_logs SET
             status = 'failed',
             error_message = ?,
             completed_at = datetime('now')
           WHERE id = ?`,
          [error instanceof Error ? error.message : 'Unknown error', syncLogId]
        );
      } catch {
        // Ignore logging errors
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * Upsert a single order into D1
 */
async function upsertOrder(order: ShopifyAdminOrder): Promise<boolean> {
  const orderId = `order_${order.id.split('/').pop()}`;
  const shopifyId = order.id;
  const orderNumber = extractOrderNumber(order.name);

  // Check if this is a new order (before the order UPSERT)
  const existingOrder = await queryDatabase(
    `SELECT id FROM commerce_orders WHERE shopify_id = ?`,
    [shopifyId]
  );
  const isNewOrder = existingOrder.length === 0;

  // Parse UTM from landing site
  const utm = parseUtmParams(order.landingSite);

  // Hash customer ID for privacy
  const customerHash = order.customer ? hashCustomerId(order.customer.id) : null;

  // Extract entry content attribution from custom attributes
  const getAttr = (key: string): string | null => {
    const attr = order.customAttributes?.find(a => a.key === key);
    return attr?.value || null;
  };
  const entryClipId = getAttr('_entry_clip_id');
  const entryGalleryId = getAttr('_entry_gallery_id');
  const entryAlbumId = getAttr('_entry_album_id');
  const entryPath = getAttr('_entry_path');
  const sessionId = getAttr('_session');

  // Upsert order with entry content attribution
  await executeQuery(
    `INSERT INTO commerce_orders (
       id, shopify_id, shopify_order_number,
       total_price_cents, subtotal_price_cents, total_tax_cents, total_discounts_cents, currency,
       financial_status, fulfillment_status,
       customer_id, customer_hash,
       source_name, referring_site, landing_site,
       utm_source, utm_medium, utm_campaign,
       entry_clip_id, entry_gallery_id, entry_album_id, entry_path, session_id,
       shopify_created_at, shopify_updated_at, processed_at, closed_at, cancelled_at,
       synced_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
       entry_clip_id = COALESCE(excluded.entry_clip_id, commerce_orders.entry_clip_id),
       entry_gallery_id = COALESCE(excluded.entry_gallery_id, commerce_orders.entry_gallery_id),
       entry_album_id = COALESCE(excluded.entry_album_id, commerce_orders.entry_album_id),
       entry_path = COALESCE(excluded.entry_path, commerce_orders.entry_path),
       session_id = COALESCE(excluded.session_id, commerce_orders.session_id),
       synced_at = datetime('now'),
       updated_at = datetime('now')`,
    [
      orderId,
      shopifyId,
      orderNumber,
      toCents(order.totalPriceSet.shopMoney.amount),
      toCents(order.subtotalPriceSet.shopMoney.amount),
      toCents(order.totalTaxSet.shopMoney.amount),
      toCents(order.totalDiscountsSet.shopMoney.amount),
      order.totalPriceSet.shopMoney.currencyCode,
      order.displayFinancialStatus,
      order.displayFulfillmentStatus,
      order.customer?.id || null,
      customerHash,
      order.sourceName,
      order.referringSite,
      order.landingSite,
      utm.utm_source || null,
      utm.utm_medium || null,
      utm.utm_campaign || null,
      entryClipId ? parseInt(entryClipId, 10) : null,
      entryGalleryId ? parseInt(entryGalleryId, 10) : null,
      entryAlbumId,
      entryPath,
      sessionId,
      order.createdAt,
      order.updatedAt,
      order.processedAt,
      order.closedAt,
      order.cancelledAt,
    ]
  );

  // UPSERT line items (idempotent - safe for duplicate syncs)
  const lineItemEdges = order.lineItems.edges;
  for (const edge of lineItemEdges) {
    const item = edge.node;
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
        item.id,
        item.product?.id || null,
        item.title,
        item.variant?.id || null,
        item.variantTitle,
        item.sku,
        item.quantity,
        toCents(item.originalTotalSet.shopMoney.amount),
        toCents(item.totalDiscountSet.shopMoney.amount),
      ]
    );
  }

  // Clean up removed items (items no longer in order)
  if (lineItemEdges.length > 0) {
    const itemIds = lineItemEdges.map((e: any) => e.node.id);
    const placeholders = itemIds.map(() => '?').join(',');
    await executeQuery(
      `DELETE FROM commerce_order_items WHERE order_id = ? AND shopify_line_item_id NOT IN (${placeholders})`,
      [orderId, ...itemIds]
    );
  }

  // Update/create customer record - only increment total_orders for NEW orders
  if (order.customer && customerHash) {
    if (isNewOrder) {
      await executeQuery(
        `INSERT INTO commerce_customers (id, shopify_customer_id, customer_hash, total_orders, first_order_at, last_order_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(shopify_customer_id) DO UPDATE SET
           total_orders = commerce_customers.total_orders + 1,
           last_order_at = MAX(commerce_customers.last_order_at, excluded.last_order_at),
           updated_at = datetime('now')`,
        [customerHash, order.customer.id, customerHash, order.createdAt, order.createdAt]
      );
    } else {
      // For existing orders, only update last_order_at (don't increment total_orders)
      await executeQuery(
        `UPDATE commerce_customers SET
           last_order_at = MAX(last_order_at, ?),
           updated_at = datetime('now')
         WHERE shopify_customer_id = ?`,
        [order.createdAt, order.customer.id]
      );
    }
  }

  return true;
}

/**
 * Recompute daily metrics after sync
 */
async function recomputeDailyMetrics() {
  // Get metrics for the last 90 days
  const result = await queryDatabase(
    `SELECT
       date(shopify_created_at) as date,
       COUNT(*) as total_orders,
       SUM(total_price_cents) as total_revenue_cents,
       AVG(total_price_cents) as avg_order_value_cents
     FROM commerce_orders
     WHERE shopify_created_at >= date('now', '-90 days')
       AND financial_status NOT IN ('voided', 'refunded')
     GROUP BY date(shopify_created_at)`,
    []
  );

  // Upsert each day's metrics
  for (const row of result || []) {
    const r = row as any;
    await executeQuery(
      `INSERT INTO commerce_daily_metrics (date, total_orders, total_revenue_cents, avg_order_value_cents, computed_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(date) DO UPDATE SET
         total_orders = excluded.total_orders,
         total_revenue_cents = excluded.total_revenue_cents,
         avg_order_value_cents = excluded.avg_order_value_cents,
         computed_at = datetime('now')`,
      [r.date, r.total_orders, r.total_revenue_cents || 0, Math.round(r.avg_order_value_cents || 0)]
    );
  }
}

// Also support GET for manual triggers from browser
export async function GET(request: NextRequest) {
  return POST(request);
}
