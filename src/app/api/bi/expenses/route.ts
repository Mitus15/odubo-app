import { queryDatabase, executeQuery } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import type { ExpenseInput } from '@/types/bi';

export const runtime = 'nodejs';

// GET /api/bi/expenses - List expenses with optional filtering
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // Query params for filtering
    const category = url.searchParams.get('category');
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');
    const vendor = url.searchParams.get('vendor');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let sql = 'SELECT * FROM bi_expenses WHERE 1=1';
    const params: (string | number)[] = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (startDate) {
      sql += ' AND expense_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND expense_date <= ?';
      params.push(endDate);
    }
    if (vendor) {
      sql += ' AND vendor LIKE ?';
      params.push(`%${vendor}%`);
    }

    sql += ' ORDER BY expense_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const results = await queryDatabase(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM bi_expenses WHERE 1=1';
    const countParams: string[] = [];
    if (category) {
      countSql += ' AND category = ?';
      countParams.push(category);
    }
    if (startDate) {
      countSql += ' AND expense_date >= ?';
      countParams.push(startDate);
    }
    if (endDate) {
      countSql += ' AND expense_date <= ?';
      countParams.push(endDate);
    }
    if (vendor) {
      countSql += ' AND vendor LIKE ?';
      countParams.push(`%${vendor}%`);
    }

    const countResult = await queryDatabase(countSql, countParams);

    return NextResponse.json({
      success: true,
      expenses: results,
      total: countResult[0]?.total || 0,
      limit,
      offset,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/bi/expenses - Create new expense
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExpenseInput;

    // Validate required fields
    if (!body.category || !body.name || !body.amount_cents || !body.expense_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: category, name, amount_cents, expense_date' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    await executeQuery(`
      INSERT INTO bi_expenses (
        id, category, name, description, vendor, amount_cents, currency,
        is_recurring, recurring_interval, expense_date, period_start, period_end,
        campaign_id, receipt_url, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      body.category,
      body.name,
      body.description || null,
      body.vendor || null,
      body.amount_cents,
      body.currency || 'CAD',
      body.is_recurring ? 1 : 0,
      body.recurring_interval || null,
      body.expense_date,
      body.period_start || null,
      body.period_end || null,
      body.campaign_id || null,
      body.receipt_url || null,
      body.notes || null
    ]);

    // Fetch the created expense
    const expense = await queryDatabase('SELECT * FROM bi_expenses WHERE id = ?', [id]);

    return NextResponse.json({ success: true, expense: expense[0] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
