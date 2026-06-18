import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const appliesTo = url.searchParams.get('applies_to');

    let sql = 'SELECT * FROM ark_statuses';
    const params: string[] = [];

    if (appliesTo) {
      sql += " WHERE applies_to = ? OR applies_to = 'all'";
      params.push(appliesTo);
    }

    sql += ' ORDER BY sort_order ASC';
    const statuses = await queryDatabase(sql, params);
    return NextResponse.json({ success: true, statuses: statuses || [] });
  } catch (error) {
    console.error('Ark statuses list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch statuses' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, color, sort_order, is_closed, is_default, applies_to } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await executeQuery(
      'INSERT INTO ark_statuses (id, name, color, sort_order, is_closed, is_default, applies_to) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, color || null, sort_order ?? 0, is_closed ? 1 : 0, is_default ? 1 : 0, applies_to || 'all']
    );

    return NextResponse.json({ success: true, status: { id, name } }, { status: 201 });
  } catch (error) {
    console.error('Ark create status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create status' }, { status: 500 });
  }
}
