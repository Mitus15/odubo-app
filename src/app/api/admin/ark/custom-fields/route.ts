import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const categoryId = url.searchParams.get('category');

    let sql = 'SELECT * FROM ark_custom_fields';
    const params: string[] = [];

    if (categoryId) {
      sql += ' WHERE category_id = ? OR category_id IS NULL';
      params.push(categoryId);
    }

    sql += ' ORDER BY sort_order ASC';
    const fields = await queryDatabase(sql, params);
    return NextResponse.json({ success: true, fields: fields || [] });
  } catch (error) {
    console.error('Ark custom fields error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch custom fields' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { category_id, name, field_type, options, sort_order, is_required } = body;

    if (!name || !field_type) {
      return NextResponse.json({ success: false, error: 'name and field_type are required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await executeQuery(
      'INSERT INTO ark_custom_fields (id, category_id, name, field_type, options, sort_order, is_required) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, category_id || null, name, field_type, options ? JSON.stringify(options) : null, sort_order ?? 0, is_required ? 1 : 0]
    );

    return NextResponse.json({ success: true, field: { id, name } }, { status: 201 });
  } catch (error) {
    console.error('Ark create custom field error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create custom field' }, { status: 500 });
  }
}
