// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import type { ReportType, ReportData } from '@/types/bi';

export const runtime = 'edge';

// POST /api/bi/reports/generate - Generate a report
export async function POST(req: NextRequest) {
  try {
    const { env } = getRequestContext();
    const body = await req.json();
    const { report_type, period_start, period_end } = body as {
      report_type: ReportType;
      period_start: string;
      period_end: string;
    };

    if (!report_type || !period_start || !period_end) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: report_type, period_start, period_end' },
        { status: 400 }
      );
    }

    const reportId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    // 1. Get Revenue Data from commerce_orders
    const { results: revenueData } = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(total_price_cents), 0) as total_revenue_cents,
        COUNT(*) as order_count
      FROM commerce_orders
      WHERE shopify_created_at >= ? AND shopify_created_at <= ?
        AND financial_status = 'paid'
    `).bind(period_start, period_end + 'T23:59:59').all();

    const revenue = revenueData?.[0] || { total_revenue_cents: 0, order_count: 0 };

    // Get revenue by product
    const { results: productRevenue } = await env.DB.prepare(`
      SELECT
        oi.product_title,
        oi.product_id as product_handle,
        SUM(oi.quantity) as units_sold,
        SUM(oi.price_cents * oi.quantity) as revenue_cents
      FROM commerce_order_items oi
      JOIN commerce_orders o ON o.id = oi.order_id
      WHERE o.shopify_created_at >= ? AND o.shopify_created_at <= ?
        AND o.financial_status = 'paid'
      GROUP BY oi.product_id
      ORDER BY revenue_cents DESC
      LIMIT 10
    `).bind(period_start, period_end + 'T23:59:59').all();

    // 2. Calculate COGS from product costs
    const { results: productCosts } = await env.DB.prepare(`
      SELECT product_handle, unit_cost_cents, shipping_cost_cents, packaging_cost_cents
      FROM bi_product_costs
      WHERE effective_to IS NULL OR effective_to >= ?
    `).bind(period_start).all();

    const costsMap = new Map<string, number>();
    (productCosts || []).forEach((c: Record<string, unknown>) => {
      const total = (Number(c.unit_cost_cents) || 0) + (Number(c.shipping_cost_cents) || 0) + (Number(c.packaging_cost_cents) || 0);
      costsMap.set(c.product_handle as string, total);
    });

    let totalCogs = 0;
    const cogsByProduct: Array<{ product_handle: string; cogs_cents: number }> = [];

    (productRevenue || []).forEach((p: Record<string, unknown>) => {
      const unitCost = costsMap.get(p.product_handle as string) || 0;
      const productCogs = unitCost * (Number(p.units_sold) || 0);
      totalCogs += productCogs;
      cogsByProduct.push({
        product_handle: p.product_handle as string,
        cogs_cents: productCogs,
      });
    });

    // 3. Get Expenses
    const { results: expensesData } = await env.DB.prepare(`
      SELECT
        category,
        COALESCE(SUM(amount_cents), 0) as total_cents,
        COUNT(*) as count
      FROM bi_expenses
      WHERE expense_date >= ? AND expense_date <= ?
      GROUP BY category
    `).bind(period_start, period_end).all();

    const totalExpenses = (expensesData || []).reduce(
      (sum: number, e: Record<string, unknown>) => sum + (Number(e.total_cents) || 0),
      0
    );

    // 4. Get Social Growth
    const { results: socialLatest } = await env.DB.prepare(`
      SELECT s1.*
      FROM bi_social_snapshots s1
      INNER JOIN (
        SELECT platform, MAX(date) as max_date
        FROM bi_social_snapshots
        WHERE date <= ?
        GROUP BY platform
      ) s2 ON s1.platform = s2.platform AND s1.date = s2.max_date
    `).bind(period_end).all();

    const { results: socialPrevious } = await env.DB.prepare(`
      SELECT s1.*
      FROM bi_social_snapshots s1
      INNER JOIN (
        SELECT platform, MAX(date) as max_date
        FROM bi_social_snapshots
        WHERE date < ?
        GROUP BY platform
      ) s2 ON s1.platform = s2.platform AND s1.date = s2.max_date
    `).bind(period_start).all();

    const socialGrowth = (socialLatest || []).map((latest: Record<string, unknown>) => {
      const previous = (socialPrevious || []).find(
        (p: Record<string, unknown>) => p.platform === latest.platform
      ) as Record<string, unknown> | undefined;
      const currentFollowers = Number(latest.followers) || 0;
      const previousFollowers = previous ? (Number(previous.followers) || 0) : currentFollowers;
      const growth = currentFollowers - previousFollowers;
      const growthPercent = previousFollowers > 0 ? (growth / previousFollowers) * 100 : 0;

      return {
        platform: latest.platform as string,
        followers: currentFollowers,
        growth,
        growth_percent: growthPercent,
        engagement: {
          likes: Number(latest.likes_count) || 0,
          comments: Number(latest.comments_count) || 0,
          shares: Number(latest.shares_count) || 0,
          views: Number(latest.views_count) || 0,
        },
      };
    });

    const totalFollowers = socialGrowth.reduce((sum, s) => sum + s.followers, 0);
    const totalSocialGrowth = socialGrowth.reduce((sum, s) => sum + s.growth, 0);
    const topPerformer = socialGrowth.sort((a, b) => b.growth_percent - a.growth_percent)[0]?.platform || null;

    // 5. Get Ad Campaign Performance
    const { results: adMetrics } = await env.DB.prepare(`
      SELECT
        c.platform,
        c.name as campaign_name,
        c.id as campaign_id,
        COALESCE(SUM(m.spend_cents), 0) as spend_cents,
        COALESCE(SUM(m.impressions), 0) as impressions,
        COALESCE(SUM(m.clicks), 0) as clicks,
        COALESCE(SUM(m.conversions), 0) as conversions,
        COALESCE(SUM(m.conversion_value_cents), 0) as conversion_value_cents
      FROM bi_ad_campaigns c
      LEFT JOIN bi_ad_metrics m ON m.campaign_id = c.id AND m.date >= ? AND m.date <= ?
      GROUP BY c.id
    `).bind(period_start, period_end).all();

    const adTotals = (adMetrics || []).reduce(
      (acc: { spend: number; impressions: number; clicks: number; conversions: number; value: number }, m: Record<string, unknown>) => ({
        spend: acc.spend + (Number(m.spend_cents) || 0),
        impressions: acc.impressions + (Number(m.impressions) || 0),
        clicks: acc.clicks + (Number(m.clicks) || 0),
        conversions: acc.conversions + (Number(m.conversions) || 0),
        value: acc.value + (Number(m.conversion_value_cents) || 0),
      }),
      { spend: 0, impressions: 0, clicks: 0, conversions: 0, value: 0 }
    );

    const adByPlatform = (adMetrics || []).reduce((acc: Record<string, Record<string, number>>, m: Record<string, unknown>) => {
      const platform = m.platform as string;
      if (!acc[platform]) {
        acc[platform] = { spend_cents: 0, impressions: 0, clicks: 0, conversions: 0 };
      }
      acc[platform].spend_cents += Number(m.spend_cents) || 0;
      acc[platform].impressions += Number(m.impressions) || 0;
      acc[platform].clicks += Number(m.clicks) || 0;
      acc[platform].conversions += Number(m.conversions) || 0;
      return acc;
    }, {});

    // 6. Get Content Performance (clips)
    const { results: clipStats } = await env.DB.prepare(`
      SELECT
        COUNT(DISTINCT v.id) as clips_published,
        COALESCE(SUM(e.view_count), 0) as total_views,
        COALESCE(SUM(e.completion_count), 0) as total_completions
      FROM videos v
      LEFT JOIN clip_engagement e ON e.clip_id = v.id
      WHERE v.created_at >= ? AND v.created_at <= ?
    `).bind(period_start, period_end).all();

    const clipData = clipStats?.[0] || { clips_published: 0, total_views: 0, total_completions: 0 };

    // Get top clips
    const { results: topClips } = await env.DB.prepare(`
      SELECT v.id, v.title, e.view_count, e.completion_count
      FROM videos v
      LEFT JOIN clip_engagement e ON e.clip_id = v.id
      WHERE v.created_at >= ? AND v.created_at <= ?
      ORDER BY e.view_count DESC
      LIMIT 5
    `).bind(period_start, period_end).all();

    // 7. Build Report Data
    const revenueAmount = Number(revenue.total_revenue_cents) || 0;
    const grossProfit = revenueAmount - totalCogs;
    const grossMargin = revenueAmount > 0 ? (grossProfit / revenueAmount) * 100 : 0;
    const netProfit = grossProfit - totalExpenses;

    const reportData: ReportData = {
      period: {
        start: period_start,
        end: period_end,
        type: report_type,
      },
      financial: {
        revenue: {
          total_cents: revenueAmount,
          order_count: Number(revenue.order_count) || 0,
          avg_order_value_cents: Number(revenue.order_count) > 0
            ? Math.round(revenueAmount / Number(revenue.order_count))
            : 0,
          by_product: (productRevenue || []).map((p: Record<string, unknown>) => ({
            product_handle: String(p.product_handle || ''),
            product_title: String(p.product_title || ''),
            units_sold: Number(p.units_sold) || 0,
            revenue_cents: Number(p.revenue_cents) || 0,
          })),
        },
        cogs: {
          total_cents: totalCogs,
          by_product: cogsByProduct,
        },
        gross_profit_cents: grossProfit,
        gross_margin_percent: grossMargin,
        expenses: {
          total_cents: totalExpenses,
          by_category: (expensesData || []).map((e: Record<string, unknown>) => ({
            category: e.category as string,
            total_cents: Number(e.total_cents) || 0,
            count: Number(e.count) || 0,
          })),
        },
        net_profit_cents: netProfit,
      },
      social: {
        platforms: socialGrowth,
        total_followers: totalFollowers,
        total_growth: totalSocialGrowth,
        growth_percent: totalFollowers - totalSocialGrowth > 0
          ? (totalSocialGrowth / (totalFollowers - totalSocialGrowth)) * 100
          : 0,
        top_performer: topPerformer,
      },
      content: {
        clips_published: Number(clipData.clips_published) || 0,
        total_views: Number(clipData.total_views) || 0,
        total_completions: Number(clipData.total_completions) || 0,
        completion_rate: Number(clipData.total_views) > 0
          ? (Number(clipData.total_completions) / Number(clipData.total_views)) * 100
          : 0,
        top_clips: (topClips || []).map((c: Record<string, unknown>) => ({
          id: Number(c.id),
          title: String(c.title || 'Untitled'),
          views: Number(c.view_count) || 0,
          completions: Number(c.completion_count) || 0,
        })),
      },
      advertising: {
        total_spend_cents: adTotals.spend,
        total_impressions: adTotals.impressions,
        total_clicks: adTotals.clicks,
        total_conversions: adTotals.conversions,
        overall_roas: adTotals.spend > 0 ? adTotals.value / adTotals.spend : null,
        by_platform: Object.entries(adByPlatform).map(([platform, metrics]) => ({
          platform: platform as ReportData['advertising']['by_platform'][0]['platform'],
          spend_cents: metrics.spend_cents,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          conversions: metrics.conversions,
          roas: metrics.spend_cents > 0 ? null : null, // Would need conversion value per platform
        })),
        campaigns: (adMetrics || []).map((m: Record<string, unknown>) => ({
          id: String(m.campaign_id),
          name: String(m.campaign_name || ''),
          platform: m.platform as ReportData['advertising']['campaigns'][0]['platform'],
          spend_cents: Number(m.spend_cents) || 0,
          roas: Number(m.spend_cents) > 0 && Number(m.conversion_value_cents) > 0
            ? Number(m.conversion_value_cents) / Number(m.spend_cents)
            : null,
        })),
      },
      website: {
        visitors: 0, // Would need website metrics data
        page_views: 0,
        sessions: 0,
        avg_session_duration_seconds: null,
        bounce_rate: null,
        top_sources: [],
        top_pages: [],
      },
      generated_at: new Date().toISOString(),
    };

    // Save report
    await env.DB.prepare(`
      INSERT INTO bi_reports (id, report_type, period_start, period_end, status, report_data)
      VALUES (?, ?, ?, ?, 'ready', ?)
    `).bind(reportId, report_type, period_start, period_end, JSON.stringify(reportData)).run();

    return NextResponse.json({
      success: true,
      report_id: reportId,
      report: reportData,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Report generation error:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
