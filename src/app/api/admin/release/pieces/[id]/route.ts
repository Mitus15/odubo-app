/**
 * PATCH  /api/admin/release/pieces/[id] — rename, describe, set the preview.
 * DELETE /api/admin/release/pieces/[id] — remove an empty piece.
 *
 * Deleting refuses while files still hang off the piece. Detaching them
 * silently would drop them into the project inbox with no trace of where they
 * came from, and these are hundred-megabyte masters, not scratch files.
 */
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const { id } = await params;
    const body = (await req.json()) as {
      title?: string;
      description?: string | null;
      previewFileId?: string | null;
      sortOrder?: number;
    };

    const sets: string[] = [];
    const values: unknown[] = [];

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
      }
      sets.push('title = ?');
      values.push(title);
    }
    if (body.description !== undefined) {
      sets.push('description = ?');
      values.push(body.description);
    }
    if (body.previewFileId !== undefined) {
      sets.push('preview_file_id = ?');
      values.push(body.previewFileId);
    }
    if (body.sortOrder !== undefined) {
      sets.push('sort_order = ?');
      values.push(body.sortOrder);
    }

    if (!sets.length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    sets.push("updated_at = datetime('now')");
    values.push(id);
    await executeQuery(`UPDATE warehouse_pieces SET ${sets.join(', ')} WHERE id = ?`, values);

    const rows = await queryDatabase('SELECT * FROM warehouse_pieces WHERE id = ?', [id]);
    if (!rows?.length) {
      return NextResponse.json({ error: 'Piece not found' }, { status: 404 });
    }
    return NextResponse.json({ piece: rows[0] });
  } catch (error) {
    console.error('Update piece failed:', error);
    return NextResponse.json({ error: 'Failed to update piece' }, { status: 500 });
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
    const files = await queryDatabase(
      'SELECT COUNT(*) AS n FROM warehouse_files WHERE piece_id = ?',
      [id]
    );
    const count = Number(files?.[0]?.n ?? 0);
    if (count > 0) {
      return NextResponse.json(
        {
          error: `This piece still holds ${count} file${count === 1 ? '' : 's'}. Move or delete them first.`,
        },
        { status: 409 }
      );
    }

    await executeQuery('DELETE FROM warehouse_pieces WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete piece failed:', error);
    return NextResponse.json({ error: 'Failed to delete piece' }, { status: 500 });
  }
}
