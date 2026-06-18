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
    if (body.color !== undefined) { fields.push('color = ?'); values.push(body.color); }
    if (body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(body.sort_order); }
    if (body.is_closed !== undefined) { fields.push('is_closed = ?'); values.push(body.is_closed ? 1 : 0); }
    if (body.is_default !== undefined) { fields.push('is_default = ?'); values.push(body.is_default ? 1 : 0); }
    if (body.applies_to !== undefined) { fields.push('applies_to = ?'); values.push(body.applies_to); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    await executeQuery(`UPDATE ark_statuses SET ${fields.join(', ')} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark update status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update status' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await executeQuery('DELETE FROM ark_statuses WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark delete status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete status' }, { status: 500 });
  }
}
