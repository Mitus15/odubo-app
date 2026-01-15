// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import type { ExpenseInput } from '@/types/bi';

export const runtime = 'edge';

// GET /api/bi/expenses/[id] - Get single expense
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = getRequestContext();
    const { id } = await params;

    const expense = await env.DB.prepare('SELECT * FROM bi_expenses WHERE id = ?').bind(id).first();

    if (!expense) {
      return NextResponse.json({ success: false, error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, expense });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/bi/expenses/[id] - Update expense
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = getRequestContext();
    const { id } = await params;
    const body = (await req.json()) as Partial<ExpenseInput>;

    // Check if expense exists
    const existing = await env.DB.prepare('SELECT * FROM bi_expenses WHERE id = ?').bind(id).first();
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Expense not found' }, { status: 404 });
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.category !== undefined) {
      updates.push('category = ?');
      values.push(body.category);
    }
    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description || null);
    }
    if (body.vendor !== undefined) {
      updates.push('vendor = ?');
      values.push(body.vendor || null);
    }
    if (body.amount_cents !== undefined) {
      updates.push('amount_cents = ?');
      values.push(body.amount_cents);
    }
    if (body.currency !== undefined) {
      updates.push('currency = ?');
      values.push(body.currency);
    }
    if (body.is_recurring !== undefined) {
      updates.push('is_recurring = ?');
      values.push(body.is_recurring ? 1 : 0);
    }
    if (body.recurring_interval !== undefined) {
      updates.push('recurring_interval = ?');
      values.push(body.recurring_interval || null);
    }
    if (body.expense_date !== undefined) {
      updates.push('expense_date = ?');
      values.push(body.expense_date);
    }
    if (body.period_start !== undefined) {
      updates.push('period_start = ?');
      values.push(body.period_start || null);
    }
    if (body.period_end !== undefined) {
      updates.push('period_end = ?');
      values.push(body.period_end || null);
    }
    if (body.campaign_id !== undefined) {
      updates.push('campaign_id = ?');
      values.push(body.campaign_id || null);
    }
    if (body.receipt_url !== undefined) {
      updates.push('receipt_url = ?');
      values.push(body.receipt_url || null);
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

    const sql = `UPDATE bi_expenses SET ${updates.join(', ')} WHERE id = ?`;
    await env.DB.prepare(sql).bind(...values).run();

    // Fetch updated expense
    const expense = await env.DB.prepare('SELECT * FROM bi_expenses WHERE id = ?').bind(id).first();

    return NextResponse.json({ success: true, expense });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/bi/expenses/[id] - Delete expense
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = getRequestContext();
    const { id } = await params;

    // Check if expense exists
    const existing = await env.DB.prepare('SELECT * FROM bi_expenses WHERE id = ?').bind(id).first();
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Expense not found' }, { status: 404 });
    }

    await env.DB.prepare('DELETE FROM bi_expenses WHERE id = ?').bind(id).run();

    return NextResponse.json({ success: true, deleted: id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
