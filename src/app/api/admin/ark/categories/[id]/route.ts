import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, color, icon, description, sort_order } = body;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (color !== undefined) { fields.push('color = ?'); values.push(color); }
    if (icon !== undefined) { fields.push('icon = ?'); values.push(icon); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    await executeQuery(`UPDATE ark_categories SET ${fields.join(', ')} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark update category error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await executeQuery('DELETE FROM ark_categories WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark delete category error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete category' }, { status: 500 });
  }
}
