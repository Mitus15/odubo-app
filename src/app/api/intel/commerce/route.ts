import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const runtime = 'edge';

/**
 * Commerce Analytics API
 *
 * GET /api/intel/commerce
 *
 * Returns commerce metrics for the Intelligence Dashboard.
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' (default: '30d')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    // Convert period to days
    const daysMap: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };
    const days = daysMap[period] || 30;

    // Run all queries in parallel
    const [
      currentMetricsResults,
      previousMetricsResults,
      topProductsResults,
      recentOrdersResults,
      dailyTrendResults,
      syncStatusResults,
    ] = await Promise.all([
      // Current period metrics
      queryDatabase(
        `SELECT
           COUNT(*) as total_orders,
           COALESCE(SUM(total_price_cents), 0) as total_revenue_cents,
           COALESCE(AVG(total_price_cents), 0) as avg_order_value_cents,
           COUNT(DISTINCT customer_id) as unique_customers
         FROM commerce_orders
         WHERE shopify_created_at >= datetime('now', '-${days} days')
           AND financial_status NOT IN ('voided', 'refunded')`,
        []
      ).catch(() => []),

      // Previous period metrics (for comparison)
      queryDatabase(
        `SELECT
           COUNT(*) as total_orders,
           COALESCE(SUM(total_price_cents), 0) as total_revenue_cents,
           COALESCE(AVG(total_price_cents), 0) as avg_order_value_cents,
           COUNT(DISTINCT customer_id) as unique_customers
         FROM commerce_orders
         WHERE shopify_created_at >= datetime('now', '-${days * 2} days')
           AND shopify_created_at < datetime('now', '-${days} days')
           AND financial_status NOT IN ('voided', 'refunded')`,
        []
      ).catch(() => []),

      // Top products by revenue
      queryDatabase(
        `SELECT
           i.product_title,
           i.product_id,
           SUM(i.quantity) as units_sold,
           SUM(i.price_cents) as revenue_cents
         FROM commerce_order_items i
         JOIN commerce_orders o ON o.id = i.order_id
         WHERE o.shopify_created_at >= datetime('now', '-${days} days')
           AND o.financial_status NOT IN ('voided', 'refunded')
         GROUP BY i.product_id
         ORDER BY revenue_cents DESC
         LIMIT 10`,
        []
      ).catch(() => []),

      // Recent orders
      queryDatabase(
        `SELECT
           id,
           shopify_order_number,
           total_price_cents,
           financial_status,
           fulfillment_status,
           source_name,
           shopify_created_at
         FROM commerce_orders
         ORDER BY shopify_created_at DESC
         LIMIT 10`,
        []
      ).catch(() => []),

      // Daily trend data
      queryDatabase(
        `SELECT
           date,
           total_orders,
           total_revenue_cents,
           avg_order_value_cents
         FROM commerce_daily_metrics
         WHERE date >= date('now', '-${days} days')
         ORDER BY date ASC`,
        []
      ).catch(() => []),

      // Sync status
      queryDatabase(
        `SELECT
           last_updated_at,
           total_synced,
           status,
           completed_at
         FROM commerce_sync_status
         WHERE sync_type = 'orders'`,
        []
      ).catch(() => []),
    ]);

    const currentMetrics = currentMetricsResults?.[0] || {
      total_orders: 0,
      total_revenue_cents: 0,
      avg_order_value_cents: 0,
      unique_customers: 0,
    };
    const previousMetrics = previousMetricsResults?.[0] || {
      total_orders: 0,
      total_revenue_cents: 0,
      avg_order_value_cents: 0,
      unique_customers: 0,
    };
    const topProducts = topProductsResults || [];
    const recentOrders = recentOrdersResults || [];
    const dailyTrend = dailyTrendResults || [];
    const syncStatus = syncStatusResults?.[0] || null;

    // Calculate changes
    const calculateChange = (
      current: number,
      previous: number
    ): { change: number; trend: 'up' | 'down' | 'neutral' } => {
      if (previous === 0) {
        return { change: current > 0 ? 100 : 0, trend: current > 0 ? 'up' : 'neutral' };
      }
      const change = ((current - previous) / previous) * 100;
      return {
        change,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
      };
    };

    // Type assertions
    const current = currentMetrics as any;
    const previous = previousMetrics as any;

    const revenueChange = calculateChange(
      current?.total_revenue_cents || 0,
      previous?.total_revenue_cents || 0
    );
    const ordersChange = calculateChange(
      current?.total_orders || 0,
      previous?.total_orders || 0
    );
    const aovChange = calculateChange(
      current?.avg_order_value_cents || 0,
      previous?.avg_order_value_cents || 0
    );
    const customersChange = calculateChange(
      current?.unique_customers || 0,
      previous?.unique_customers || 0
    );

    return NextResponse.json({
      metrics: {
        revenue: {
          total: current?.total_revenue_cents || 0,
          change: revenueChange.change,
          trend: revenueChange.trend,
        },
        orders: {
          total: current?.total_orders || 0,
          change: ordersChange.change,
          trend: ordersChange.trend,
        },
        averageOrderValue: {
          total: Math.round(current?.avg_order_value_cents || 0),
          change: aovChange.change,
          trend: aovChange.trend,
        },
        customers: {
          total: current?.unique_customers || 0,
          change: customersChange.change,
          trend: customersChange.trend,
        },
      },
      topProducts: topProducts.map((p: any) => ({
        title: p.product_title || 'Unknown Product',
        productId: p.product_id,
        unitsSold: p.units_sold,
        revenue: p.revenue_cents,
      })),
      recentOrders: recentOrders.map((o: any) => ({
        id: o.id,
        orderNumber: o.shopify_order_number,
        total: o.total_price_cents,
        financialStatus: o.financial_status,
        fulfillmentStatus: o.fulfillment_status,
        source: o.source_name,
        createdAt: o.shopify_created_at,
      })),
      trend: dailyTrend.map((d: any) => ({
        date: d.date,
        orders: d.total_orders,
        revenue: d.total_revenue_cents,
        aov: d.avg_order_value_cents,
      })),
      syncStatus: syncStatus
        ? {
            lastSync: (syncStatus as any).completed_at,
            totalSynced: (syncStatus as any).total_synced,
            status: (syncStatus as any).status,
          }
        : null,
      period,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Intel Commerce API] Error:', error);

    // Return empty data structure on error
    return NextResponse.json(
      {
        metrics: {
          revenue: { total: 0, change: 0, trend: 'neutral' },
          orders: { total: 0, change: 0, trend: 'neutral' },
          averageOrderValue: { total: 0, change: 0, trend: 'neutral' },
          customers: { total: 0, change: 0, trend: 'neutral' },
        },
        topProducts: [],
        recentOrders: [],
        trend: [],
        syncStatus: null,
        period: '30d',
        lastUpdated: new Date().toISOString(),
        error: 'Failed to fetch data. Tables may not exist yet.',
      },
      { status: 200 }
    );
  }
}
