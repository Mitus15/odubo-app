// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import type { AdCampaignInput, AdPlatform } from '@/types/bi';

export const runtime = 'edge';

// GET /api/bi/ad-campaigns - List campaigns with metrics
export async function GET(req: NextRequest) {
  try {
    const { env } = getRequestContext();
    const url = new URL(req.url);

    const platform = url.searchParams.get('platform') as AdPlatform | null;
    const status = url.searchParams.get('status');

    let sql = 'SELECT * FROM bi_ad_campaigns WHERE 1=1';
    const params: string[] = [];

    if (platform) {
      sql += ' AND platform = ?';
      params.push(platform);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const { results: campaigns } = await env.DB.prepare(sql).bind(...params).all();

    // Get aggregated metrics for each campaign
    const campaignsWithMetrics = await Promise.all(
      (campaigns || []).map(async (campaign: Record<string, unknown>) => {
        const { results: metrics } = await env.DB.prepare(`
          SELECT
            COALESCE(SUM(spend_cents), 0) as total_spend_cents,
            COALESCE(SUM(impressions), 0) as total_impressions,
            COALESCE(SUM(clicks), 0) as total_clicks,
            COALESCE(SUM(conversions), 0) as total_conversions,
            COALESCE(SUM(conversion_value_cents), 0) as total_conversion_value_cents
          FROM bi_ad_metrics
          WHERE campaign_id = ?
        `).bind(campaign.id).all();

        const m = metrics?.[0] || {};
        const totalSpend = Number(m.total_spend_cents) || 0;
        const totalConversionValue = Number(m.total_conversion_value_cents) || 0;
        const roas = totalSpend > 0 ? totalConversionValue / totalSpend : null;

        return {
          ...campaign,
          metrics: {
            total_spend_cents: totalSpend,
            total_impressions: Number(m.total_impressions) || 0,
            total_clicks: Number(m.total_clicks) || 0,
            total_conversions: Number(m.total_conversions) || 0,
            total_conversion_value_cents: totalConversionValue,
            roas,
          },
        };
      })
    );

    // Calculate totals
    const totals = campaignsWithMetrics.reduce(
      (acc, c) => ({
        spend_cents: acc.spend_cents + (c.metrics?.total_spend_cents || 0),
        impressions: acc.impressions + (c.metrics?.total_impressions || 0),
        clicks: acc.clicks + (c.metrics?.total_clicks || 0),
        conversions: acc.conversions + (c.metrics?.total_conversions || 0),
        conversion_value_cents: acc.conversion_value_cents + (c.metrics?.total_conversion_value_cents || 0),
      }),
      { spend_cents: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value_cents: 0 }
    );

    const overall_roas = totals.spend_cents > 0 ? totals.conversion_value_cents / totals.spend_cents : null;

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithMetrics,
      totals: { ...totals, roas: overall_roas },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/bi/ad-campaigns - Create campaign
export async function POST(req: NextRequest) {
  try {
    const { env } = getRequestContext();
    const body = (await req.json()) as AdCampaignInput;

    if (!body.platform || !body.name || !body.start_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: platform, name, start_date' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    await env.DB.prepare(`
      INSERT INTO bi_ad_campaigns (
        id, platform, external_campaign_id, name, objective, status,
        budget_cents, budget_type, start_date, end_date, target_audience, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.platform,
      body.external_campaign_id || null,
      body.name,
      body.objective || null,
      body.status || 'active',
      body.budget_cents || null,
      body.budget_type || null,
      body.start_date,
      body.end_date || null,
      body.target_audience ? JSON.stringify(body.target_audience) : null,
      body.notes || null
    ).run();

    const campaign = await env.DB.prepare('SELECT * FROM bi_ad_campaigns WHERE id = ?').bind(id).first();

    return NextResponse.json({ success: true, campaign });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
