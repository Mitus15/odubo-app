import { queryDatabase } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GET /api/bi/expenses/summary - Get aggregated expense data
export async function GET(req: NextRequest) {
  try {
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
    const totalResult = await queryDatabase(`
      SELECT COALESCE(SUM(amount_cents), 0) as total_cents
      FROM bi_expenses
      WHERE 1=1 ${dateFilter}
    `, dateParams);

    // By category
    const byCategory = await queryDatabase(`
      SELECT
        category,
        COALESCE(SUM(amount_cents), 0) as total_cents,
        COUNT(*) as count
      FROM bi_expenses
      WHERE 1=1 ${dateFilter}
      GROUP BY category
      ORDER BY total_cents DESC
    `, dateParams);

    // By vendor
    const byVendor = await queryDatabase(`
      SELECT
        vendor,
        COALESCE(SUM(amount_cents), 0) as total_cents,
        COUNT(*) as count
      FROM bi_expenses
      WHERE vendor IS NOT NULL ${dateFilter}
      GROUP BY vendor
      ORDER BY total_cents DESC
      LIMIT 10
    `, dateParams);

    // Monthly recurring total
    const recurringResult = await queryDatabase(`
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
    `, []);

    // Recent expenses
    const recent = await queryDatabase(`
      SELECT * FROM bi_expenses
      WHERE 1=1 ${dateFilter}
      ORDER BY expense_date DESC
      LIMIT 5
    `, dateParams);

    return NextResponse.json({
      success: true,
      summary: {
        total_cents: totalResult[0]?.total_cents || 0,
        by_category: byCategory || [],
        by_vendor: byVendor || [],
        monthly_recurring_cents: recurringResult[0]?.monthly_recurring_cents || 0,
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
