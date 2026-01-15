import { queryDatabase, executeQuery } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import type { AdMetricsInput } from '@/types/bi';

export const runtime = 'nodejs';

// GET /api/bi/ad-campaigns/[id]/metrics - Get metrics for a campaign
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');

    let sql = 'SELECT * FROM bi_ad_metrics WHERE campaign_id = ?';
    const sqlParams: string[] = [id];

    if (startDate) {
      sql += ' AND date >= ?';
      sqlParams.push(startDate);
    }
    if (endDate) {
      sql += ' AND date <= ?';
      sqlParams.push(endDate);
    }

    sql += ' ORDER BY date DESC';

    const results = await queryDatabase(sql, sqlParams);

    return NextResponse.json({ success: true, metrics: results });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/bi/ad-campaigns/[id]/metrics - Add metrics for a day
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const body = (await req.json()) as Omit<AdMetricsInput, 'campaign_id'>;

    if (!body.date) {
      return NextResponse.json({ success: false, error: 'Missing required field: date' }, { status: 400 });
    }

    // Check campaign exists
    const campaign = await queryDatabase('SELECT id FROM bi_ad_campaigns WHERE id = ?', [campaignId]);
    if (!campaign.length) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    // Calculate derived metrics
    const spend = body.spend_cents || 0;
    const impressions = body.impressions || 0;
    const clicks = body.clicks || 0;
    const conversions = body.conversions || 0;
    const conversionValue = body.conversion_value_cents || 0;

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
    const cpc = clicks > 0 ? Math.round(spend / clicks) : null;
    const cpm = impressions > 0 ? Math.round((spend / impressions) * 1000) : null;
    const cpa = conversions > 0 ? Math.round(spend / conversions) : null;
    const roas = spend > 0 ? conversionValue / spend : null;

    const metricsId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    // Upsert metrics for this campaign+date
    await executeQuery(`
      INSERT INTO bi_ad_metrics (
        id, campaign_id, date, spend_cents, impressions, reach, clicks, ctr,
        conversions, conversion_value_cents, cpc_cents, cpm_cents, cpa_cents, roas, entry_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
      ON CONFLICT(campaign_id, date) DO UPDATE SET
        spend_cents = excluded.spend_cents,
        impressions = excluded.impressions,
        reach = excluded.reach,
        clicks = excluded.clicks,
        ctr = excluded.ctr,
        conversions = excluded.conversions,
        conversion_value_cents = excluded.conversion_value_cents,
        cpc_cents = excluded.cpc_cents,
        cpm_cents = excluded.cpm_cents,
        cpa_cents = excluded.cpa_cents,
        roas = excluded.roas
    `, [
      metricsId,
      campaignId,
      body.date,
      spend,
      impressions,
      body.reach || 0,
      clicks,
      ctr,
      conversions,
      conversionValue,
      cpc,
      cpm,
      cpa,
      roas
    ]);

    const metrics = await queryDatabase(
      'SELECT * FROM bi_ad_metrics WHERE campaign_id = ? AND date = ?',
      [campaignId, body.date]
    );

    return NextResponse.json({ success: true, metrics: metrics[0] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
