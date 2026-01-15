// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import type { AdCampaignInput } from '@/types/bi';

export const runtime = 'edge';

// GET /api/bi/ad-campaigns/[id] - Get campaign with metrics
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = getRequestContext();
    const { id } = await params;

    const campaign = await env.DB.prepare('SELECT * FROM bi_ad_campaigns WHERE id = ?').bind(id).first();
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    // Get all metrics for this campaign
    const { results: metrics } = await env.DB.prepare(`
      SELECT * FROM bi_ad_metrics WHERE campaign_id = ? ORDER BY date DESC
    `).bind(id).all();

    // Calculate aggregates
    const totals = (metrics || []).reduce(
      (acc: Record<string, number>, m: Record<string, unknown>) => ({
        spend_cents: acc.spend_cents + (Number(m.spend_cents) || 0),
        impressions: acc.impressions + (Number(m.impressions) || 0),
        clicks: acc.clicks + (Number(m.clicks) || 0),
        conversions: acc.conversions + (Number(m.conversions) || 0),
        conversion_value_cents: acc.conversion_value_cents + (Number(m.conversion_value_cents) || 0),
      }),
      { spend_cents: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value_cents: 0 }
    );

    const roas = totals.spend_cents > 0 ? totals.conversion_value_cents / totals.spend_cents : null;

    return NextResponse.json({
      success: true,
      campaign,
      metrics,
      totals: { ...totals, roas },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/bi/ad-campaigns/[id] - Update campaign
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = getRequestContext();
    const { id } = await params;
    const body = (await req.json()) as Partial<AdCampaignInput>;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.objective !== undefined) {
      updates.push('objective = ?');
      values.push(body.objective || null);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }
    if (body.budget_cents !== undefined) {
      updates.push('budget_cents = ?');
      values.push(body.budget_cents);
    }
    if (body.budget_type !== undefined) {
      updates.push('budget_type = ?');
      values.push(body.budget_type || null);
    }
    if (body.end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(body.end_date || null);
    }
    if (body.notes !== undefined) {
      updates.push('notes = ?');
      values.push(body.notes || null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    await env.DB.prepare(`UPDATE bi_ad_campaigns SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const campaign = await env.DB.prepare('SELECT * FROM bi_ad_campaigns WHERE id = ?').bind(id).first();

    return NextResponse.json({ success: true, campaign });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/bi/ad-campaigns/[id] - Delete campaign
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = getRequestContext();
    const { id } = await params;

    await env.DB.prepare('DELETE FROM bi_ad_campaigns WHERE id = ?').bind(id).run();

    return NextResponse.json({ success: true, deleted: id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
