import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/analytics/attribution
 *
 * Revenue attribution analytics - understand which content drives revenue.
 *
 * Query params:
 * - days: Number of days to look back (default: 30)
 * - type: Content type filter ('clip', 'gallery', 'album', 'source', 'all')
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const type = searchParams.get('type') || 'all';

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Revenue by entry clip
    const clipRevenue = await queryDatabase(
      `SELECT
        entry_clip_id as content_id,
        v.title as content_title,
        COUNT(*) as orders,
        SUM(total_price_cents) as revenue_cents,
        AVG(total_price_cents) as avg_order_value_cents
       FROM commerce_orders co
       LEFT JOIN videos v ON co.entry_clip_id = v.id
       WHERE co.financial_status = 'paid'
         AND date(co.shopify_created_at) >= ?
         AND co.entry_clip_id IS NOT NULL
       GROUP BY co.entry_clip_id
       ORDER BY revenue_cents DESC
       LIMIT 20`,
      [startDateStr]
    );

    // Revenue by entry gallery
    const galleryRevenue = await queryDatabase(
      `SELECT
        entry_gallery_id as content_id,
        g.title as content_title,
        COUNT(*) as orders,
        SUM(total_price_cents) as revenue_cents,
        AVG(total_price_cents) as avg_order_value_cents
       FROM commerce_orders co
       LEFT JOIN galleries g ON co.entry_gallery_id = g.id
       WHERE co.financial_status = 'paid'
         AND date(co.shopify_created_at) >= ?
         AND co.entry_gallery_id IS NOT NULL
       GROUP BY co.entry_gallery_id
       ORDER BY revenue_cents DESC
       LIMIT 20`,
      [startDateStr]
    );

    // Revenue by traffic source
    const sourceRevenue = await queryDatabase(
      `SELECT
        COALESCE(utm_source, source_name, 'direct') as source,
        COUNT(*) as orders,
        SUM(total_price_cents) as revenue_cents,
        AVG(total_price_cents) as avg_order_value_cents,
        COUNT(DISTINCT customer_hash) as unique_customers
       FROM commerce_orders
       WHERE financial_status = 'paid'
         AND date(shopify_created_at) >= ?
       GROUP BY COALESCE(utm_source, source_name, 'direct')
       ORDER BY revenue_cents DESC
       LIMIT 20`,
      [startDateStr]
    );

    // Revenue by entry path (landing page)
    const pathRevenue = await queryDatabase(
      `SELECT
        entry_path as path,
        COUNT(*) as orders,
        SUM(total_price_cents) as revenue_cents,
        AVG(total_price_cents) as avg_order_value_cents
       FROM commerce_orders
       WHERE financial_status = 'paid'
         AND date(shopify_created_at) >= ?
         AND entry_path IS NOT NULL
       GROUP BY entry_path
       ORDER BY revenue_cents DESC
       LIMIT 20`,
      [startDateStr]
    );

    // Summary totals
    const totals = await queryDatabase(
      `SELECT
        COUNT(*) as total_orders,
        SUM(total_price_cents) as total_revenue_cents,
        AVG(total_price_cents) as avg_order_value_cents,
        COUNT(DISTINCT customer_hash) as unique_customers,
        SUM(CASE WHEN entry_clip_id IS NOT NULL THEN 1 ELSE 0 END) as clip_attributed_orders,
        SUM(CASE WHEN entry_clip_id IS NOT NULL THEN total_price_cents ELSE 0 END) as clip_attributed_revenue_cents,
        SUM(CASE WHEN entry_gallery_id IS NOT NULL THEN 1 ELSE 0 END) as gallery_attributed_orders,
        SUM(CASE WHEN entry_gallery_id IS NOT NULL THEN total_price_cents ELSE 0 END) as gallery_attributed_revenue_cents
       FROM commerce_orders
       WHERE financial_status = 'paid'
         AND date(shopify_created_at) >= ?`,
      [startDateStr]
    );

    const summary = totals?.[0] as any || {};

    return NextResponse.json({
      period: {
        days,
        startDate: startDateStr,
        endDate: new Date().toISOString().split('T')[0],
      },
      summary: {
        totalOrders: summary.total_orders || 0,
        totalRevenueCents: summary.total_revenue_cents || 0,
        avgOrderValueCents: Math.round(summary.avg_order_value_cents || 0),
        uniqueCustomers: summary.unique_customers || 0,
        // Attribution coverage
        clipAttributedOrders: summary.clip_attributed_orders || 0,
        clipAttributedRevenueCents: summary.clip_attributed_revenue_cents || 0,
        clipAttributionRate: summary.total_orders > 0
          ? ((summary.clip_attributed_orders || 0) / summary.total_orders * 100).toFixed(1)
          : 0,
        galleryAttributedOrders: summary.gallery_attributed_orders || 0,
        galleryAttributedRevenueCents: summary.gallery_attributed_revenue_cents || 0,
      },
      byClip: (clipRevenue || []).map((r: any) => ({
        clipId: r.content_id,
        title: r.content_title || `Clip #${r.content_id}`,
        orders: r.orders,
        revenueCents: r.revenue_cents || 0,
        avgOrderValueCents: Math.round(r.avg_order_value_cents || 0),
      })),
      byGallery: (galleryRevenue || []).map((r: any) => ({
        galleryId: r.content_id,
        title: r.content_title || `Gallery #${r.content_id}`,
        orders: r.orders,
        revenueCents: r.revenue_cents || 0,
        avgOrderValueCents: Math.round(r.avg_order_value_cents || 0),
      })),
      bySource: (sourceRevenue || []).map((r: any) => ({
        source: r.source,
        orders: r.orders,
        revenueCents: r.revenue_cents || 0,
        avgOrderValueCents: Math.round(r.avg_order_value_cents || 0),
        uniqueCustomers: r.unique_customers || 0,
      })),
      byPath: (pathRevenue || []).map((r: any) => ({
        path: r.path,
        orders: r.orders,
        revenueCents: r.revenue_cents || 0,
        avgOrderValueCents: Math.round(r.avg_order_value_cents || 0),
      })),
      meta: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Attribution API error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
