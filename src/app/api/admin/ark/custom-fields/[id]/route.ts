import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.field_type !== undefined) { fields.push('field_type = ?'); values.push(body.field_type); }
    if (body.category_id !== undefined) { fields.push('category_id = ?'); values.push(body.category_id); }
    if (body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(body.sort_order); }
    if (body.is_required !== undefined) { fields.push('is_required = ?'); values.push(body.is_required ? 1 : 0); }
    if (body.options !== undefined) { fields.push('options = ?'); values.push(body.options ? JSON.stringify(body.options) : null); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    await executeQuery(`UPDATE ark_custom_fields SET ${fields.join(', ')} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark update custom field error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update custom field' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await executeQuery('DELETE FROM ark_custom_fields WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark delete custom field error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete custom field' }, { status: 500 });
  }
}
