/**
 * GET / PATCH / DELETE /api/admin/release/docs/[id]
 */
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';
import { DOC_KINDS } from '@/lib/release/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const { id } = await params;
    const rows = await queryDatabase('SELECT * FROM warehouse_docs WHERE id = ?', [id]);
    if (!rows?.length) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
    }
    return NextResponse.json({ doc: rows[0] });
  } catch (error) {
    console.error('Load doc failed:', error);
    return NextResponse.json({ error: 'Failed to load doc' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const { id } = await params;
    const body = (await req.json()) as {
      kind?: string;
      title?: string;
      body?: string;
      trackId?: string | null;
    };

    const sets: string[] = [];
    const values: unknown[] = [];

    if (body.kind !== undefined) {
      if (!(DOC_KINDS as readonly string[]).includes(body.kind)) {
        return NextResponse.json(
          { error: `kind must be one of ${DOC_KINDS.join(', ')}` },
          { status: 400 }
        );
      }
      sets.push('kind = ?');
      values.push(body.kind);
    }
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
      }
      sets.push('title = ?');
      values.push(title);
    }
    if (body.body !== undefined) {
      sets.push('body = ?');
      values.push(body.body);
    }
    if (body.trackId !== undefined) {
      sets.push('track_id = ?');
      values.push(body.trackId);
    }

    if (!sets.length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    sets.push("updated_at = datetime('now')");
    values.push(id);
    await executeQuery(`UPDATE warehouse_docs SET ${sets.join(', ')} WHERE id = ?`, values);

    const rows = await queryDatabase('SELECT * FROM warehouse_docs WHERE id = ?', [id]);
    if (!rows?.length) {
      return NextResponse.json({ error: 'Doc not found' }, { status: 404 });
    }
    return NextResponse.json({ doc: rows[0] });
  } catch (error) {
    console.error('Update doc failed:', error);
    return NextResponse.json({ error: 'Failed to update doc' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const { id } = await params;
    await executeQuery('DELETE FROM warehouse_docs WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete doc failed:', error);
    return NextResponse.json({ error: 'Failed to delete doc' }, { status: 500 });
  }
}
