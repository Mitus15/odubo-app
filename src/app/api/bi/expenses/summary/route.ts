// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// GET /api/bi/expenses/summary - Get aggregated expense data
export async function GET(req: NextRequest) {
  try {
    const { env } = getRequestContext();
    const url = new URL(req.url);

    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');

    // Build date filter
    let dateFilter = '';
    const dateParams: string[] = [];
    if (startDate) {
      dateFilter += ' AND expense_date >= ?';
      dateParams.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND expense_date <= ?';
      dateParams.push(endDate);
    }

    // Total expenses
    const totalResult = await env.DB.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) as total_cents
      FROM bi_expenses
      WHERE 1=1 ${dateFilter}
    `).bind(...dateParams).first();

    // By category
    const { results: byCategory } = await env.DB.prepare(`
      SELECT
        category,
        COALESCE(SUM(amount_cents), 0) as total_cents,
        COUNT(*) as count
      FROM bi_expenses
      WHERE 1=1 ${dateFilter}
      GROUP BY category
      ORDER BY total_cents DESC
    `).bind(...dateParams).all();

    // By vendor
    const { results: byVendor } = await env.DB.prepare(`
      SELECT
        vendor,
        COALESCE(SUM(amount_cents), 0) as total_cents,
        COUNT(*) as count
      FROM bi_expenses
      WHERE vendor IS NOT NULL ${dateFilter}
      GROUP BY vendor
      ORDER BY total_cents DESC
      LIMIT 10
    `).bind(...dateParams).all();

    // Monthly recurring total
    const recurringResult = await env.DB.prepare(`
      SELECT COALESCE(SUM(
        CASE
          WHEN recurring_interval = 'weekly' THEN amount_cents * 4
          WHEN recurring_interval = 'monthly' THEN amount_cents
          WHEN recurring_interval = 'quarterly' THEN amount_cents / 3
          WHEN recurring_interval = 'yearly' THEN amount_cents / 12
          ELSE 0
        END
      ), 0) as monthly_recurring_cents
      FROM bi_expenses
      WHERE is_recurring = 1
    `).first();

    // Recent expenses
    const { results: recent } = await env.DB.prepare(`
      SELECT * FROM bi_expenses
      WHERE 1=1 ${dateFilter}
      ORDER BY expense_date DESC
      LIMIT 5
    `).bind(...dateParams).all();

    return NextResponse.json({
      success: true,
      summary: {
        total_cents: totalResult?.total_cents || 0,
        by_category: byCategory || [],
        by_vendor: byVendor || [],
        monthly_recurring_cents: recurringResult?.monthly_recurring_cents || 0,
        recent: recent || [],
        period: {
          start: startDate,
          end: endDate,
        },
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
