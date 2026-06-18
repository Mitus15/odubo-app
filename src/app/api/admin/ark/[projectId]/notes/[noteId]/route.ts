import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  try {
    const { noteId } = await params;
    const body = await req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
    if (body.content !== undefined) { fields.push('content = ?'); values.push(body.content); }
    if (body.category !== undefined) { fields.push('category = ?'); values.push(body.category); }
    if (body.is_pinned !== undefined) { fields.push('is_pinned = ?'); values.push(body.is_pinned ? 1 : 0); }
    if (body.tags !== undefined) { fields.push('tags = ?'); values.push(body.tags ? JSON.stringify(body.tags) : null); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(noteId);

    await executeQuery(`UPDATE ark_notes SET ${fields.join(', ')} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark update note error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  try {
    const { noteId } = await params;
    await executeQuery('DELETE FROM ark_notes WHERE id = ?', [noteId]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ark delete note error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete note' }, { status: 500 });
  }
}
