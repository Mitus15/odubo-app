import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await queryDatabase(
      'SELECT * FROM ark_categories ORDER BY sort_order ASC, name ASC',
      []
    );
    return NextResponse.json({ success: true, categories: categories || [] });
  } catch (error) {
    console.error('Ark categories list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, color, icon, description, sort_order } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await executeQuery(
      'INSERT INTO ark_categories (id, name, color, icon, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, color || null, icon || null, description || null, sort_order ?? 0]
    );

    return NextResponse.json({ success: true, category: { id, name } }, { status: 201 });
  } catch (error) {
    console.error('Ark create category error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create category' }, { status: 500 });
  }
}
