import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

/**
 * Funnel Session Computation Cron Job
 *
 * POST /api/cron/compute-funnels
 *
 * Aggregates fan_activity events into funnel_sessions for funnel analysis.
 * Each session represents a visitor journey through the conversion funnel:
 * clip_view → shop_visit → product_view → add_to_cart → checkout → purchase
 *
 * Run hourly to keep funnel data fresh.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let sessionsProcessed = 0;

  try {
    // Get recent sessions that need processing (last 7 days)
    const recentSessions = await queryDatabase(
      `SELECT DISTINCT session_id, fan_id, source
       FROM fan_activity
       WHERE session_id IS NOT NULL
         AND created_at >= datetime('now', '-7 days')
       LIMIT 1000`,
      []
    );

    if (!recentSessions || recentSessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sessions to process',
        processed: 0,
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // Process each session
    for (const row of recentSessions) {
      const { session_id, fan_id, source } = row as {
        session_id: string;
        fan_id: string | null;
        source: string | null;
      };

      if (!session_id) continue;

      await computeSessionFunnel(session_id, fan_id, source);
      sessionsProcessed++;
    }

    // Also update exit_step for sessions that haven't progressed recently
    await updateExitSteps();

    return NextResponse.json({
      success: true,
      processed: sessionsProcessed,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error('[Compute Funnels] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Funnel computation failed' },
      { status: 500 }
    );
  }
}

/**
 * Compute funnel metrics for a single session
 */
async function computeSessionFunnel(
  sessionId: string,
  fanId: string | null,
  source: string | null
): Promise<void> {
  // Get all activity for this session
  const activity = await queryDatabase(
    `SELECT
       activity_type,
       content_id,
       value_cents,
       duration_seconds,
       created_at,
       metadata
     FROM fan_activity
     WHERE session_id = ?
     ORDER BY created_at ASC`,
    [sessionId]
  );

  if (!activity || activity.length === 0) return;

  // Extract funnel step data
  let firstClipViewAt: string | null = null;
  let lastClipViewAt: string | null = null;
  let clipViewCount = 0;
  let shopVisitAt: string | null = null;
  let firstProductViewAt: string | null = null;
  let lastProductViewAt: string | null = null;
  let productViewCount = 0;
  let productViewDurationMs = 0;
  let addToCartAt: string | null = null;
  let cartValueCents = 0;
  let cartItemCount = 0;
  let checkoutStartAt: string | null = null;
  let purchaseAt: string | null = null;
  let purchaseValueCents = 0;
  let purchaseOrderId: string | null = null;
  let entryClipId: number | null = null;
  let entryGalleryId: number | null = null;
  let entryPath: string | null = null;
  let sessionStart: string | null = null;
  let sessionEnd: string | null = null;

  for (const event of activity) {
    const e = event as any;
    const eventTime = e.created_at;

    if (!sessionStart) sessionStart = eventTime;
    sessionEnd = eventTime;

    switch (e.activity_type) {
      case 'clip_view':
        if (!firstClipViewAt) {
          firstClipViewAt = eventTime;
          // First clip is entry clip
          if (e.content_id) {
            entryClipId = parseInt(e.content_id, 10) || null;
          }
        }
        lastClipViewAt = eventTime;
        clipViewCount++;
        break;

      case 'shop_visit':
        if (!shopVisitAt) shopVisitAt = eventTime;
        break;

      case 'product_view':
        if (!firstProductViewAt) firstProductViewAt = eventTime;
        lastProductViewAt = eventTime;
        productViewCount++;
        if (e.duration_seconds) {
          productViewDurationMs += (e.duration_seconds * 1000);
        }
        break;

      case 'add_to_cart':
        if (!addToCartAt) addToCartAt = eventTime;
        if (e.value_cents) cartValueCents += e.value_cents;
        cartItemCount++;
        break;

      case 'checkout_start':
        if (!checkoutStartAt) checkoutStartAt = eventTime;
        break;

      case 'purchase':
        purchaseAt = eventTime;
        if (e.value_cents) purchaseValueCents = e.value_cents;
        if (e.content_id) purchaseOrderId = e.content_id;
        break;

      case 'page_view':
        // Capture entry path from first page view
        if (!entryPath && e.content_id) {
          entryPath = e.content_id;
        }
        // Check for gallery entry
        if (!entryGalleryId && e.metadata) {
          try {
            const meta = JSON.parse(e.metadata);
            if (meta.gallery_id) entryGalleryId = parseInt(meta.gallery_id, 10);
          } catch {}
        }
        break;
    }
  }

  // Calculate session duration
  const sessionDurationMs = sessionStart && sessionEnd
    ? new Date(sessionEnd).getTime() - new Date(sessionStart).getTime()
    : 0;

  // Determine exit step (furthest step reached)
  let exitStep = 'bounce';
  if (purchaseAt) exitStep = 'purchase';
  else if (checkoutStartAt) exitStep = 'checkout';
  else if (addToCartAt) exitStep = 'cart';
  else if (productViewCount > 0) exitStep = 'product_view';
  else if (shopVisitAt) exitStep = 'shop_visit';
  else if (clipViewCount > 0) exitStep = 'clip_view';

  // Upsert session funnel data
  await executeQuery(
    `INSERT INTO funnel_sessions (
       session_id, fan_id, source,
       first_clip_view_at, last_clip_view_at, clip_view_count,
       shop_visit_at,
       first_product_view_at, last_product_view_at, product_view_count, product_view_duration_ms,
       add_to_cart_at, cart_value_cents, cart_item_count,
       checkout_start_at,
       purchase_at, purchase_value_cents, purchase_order_id,
       exit_step, session_duration_ms,
       entry_clip_id, entry_gallery_id, entry_path,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(session_id) DO UPDATE SET
       fan_id = COALESCE(excluded.fan_id, funnel_sessions.fan_id),
       source = COALESCE(excluded.source, funnel_sessions.source),
       first_clip_view_at = COALESCE(funnel_sessions.first_clip_view_at, excluded.first_clip_view_at),
       last_clip_view_at = excluded.last_clip_view_at,
       clip_view_count = excluded.clip_view_count,
       shop_visit_at = COALESCE(funnel_sessions.shop_visit_at, excluded.shop_visit_at),
       first_product_view_at = COALESCE(funnel_sessions.first_product_view_at, excluded.first_product_view_at),
       last_product_view_at = excluded.last_product_view_at,
       product_view_count = excluded.product_view_count,
       product_view_duration_ms = excluded.product_view_duration_ms,
       add_to_cart_at = COALESCE(funnel_sessions.add_to_cart_at, excluded.add_to_cart_at),
       cart_value_cents = excluded.cart_value_cents,
       cart_item_count = excluded.cart_item_count,
       checkout_start_at = COALESCE(funnel_sessions.checkout_start_at, excluded.checkout_start_at),
       purchase_at = COALESCE(funnel_sessions.purchase_at, excluded.purchase_at),
       purchase_value_cents = COALESCE(funnel_sessions.purchase_value_cents, excluded.purchase_value_cents),
       purchase_order_id = COALESCE(funnel_sessions.purchase_order_id, excluded.purchase_order_id),
       exit_step = excluded.exit_step,
       session_duration_ms = excluded.session_duration_ms,
       entry_clip_id = COALESCE(funnel_sessions.entry_clip_id, excluded.entry_clip_id),
       entry_gallery_id = COALESCE(funnel_sessions.entry_gallery_id, excluded.entry_gallery_id),
       entry_path = COALESCE(funnel_sessions.entry_path, excluded.entry_path),
       updated_at = datetime('now')`,
    [
      sessionId,
      fanId,
      source,
      firstClipViewAt,
      lastClipViewAt,
      clipViewCount,
      shopVisitAt,
      firstProductViewAt,
      lastProductViewAt,
      productViewCount,
      productViewDurationMs,
      addToCartAt,
      cartValueCents,
      cartItemCount,
      checkoutStartAt,
      purchaseAt,
      purchaseValueCents,
      purchaseOrderId,
      exitStep,
      sessionDurationMs,
      entryClipId,
      entryGalleryId,
      entryPath,
    ]
  );
}

/**
 * Update exit_step for old sessions that likely won't progress further
 */
async function updateExitSteps(): Promise<void> {
  // Sessions older than 24 hours that haven't converted are considered complete
  await executeQuery(
    `UPDATE funnel_sessions
     SET exit_step = CASE
       WHEN purchase_at IS NOT NULL THEN 'purchase'
       WHEN checkout_start_at IS NOT NULL THEN 'checkout'
       WHEN add_to_cart_at IS NOT NULL THEN 'cart'
       WHEN product_view_count > 0 THEN 'product_view'
       WHEN shop_visit_at IS NOT NULL THEN 'shop_visit'
       WHEN clip_view_count > 0 THEN 'clip_view'
       ELSE 'bounce'
     END
     WHERE updated_at < datetime('now', '-24 hours')
       AND purchase_at IS NULL`,
    []
  );
}

// Also support GET for manual triggers
export async function GET(request: NextRequest) {
  return POST(request);
}
