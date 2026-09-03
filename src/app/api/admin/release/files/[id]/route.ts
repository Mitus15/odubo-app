/**
 * PATCH  /api/admin/release/files/[id] — re-file it (class, category, piece).
 * DELETE /api/admin/release/files/[id] — remove the row and the R2 object.
 *
 * Deleting refuses when the file is the one currently flagged to ship: the
 * delivery sheet would then point at an object that no longer exists, and the
 * failure would only surface at the distributor. Unship it first.
 */
import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { executeQuery, queryDatabase } from '@/lib/db';
import {
  FILE_CLASSES,
  FILE_CATEGORIES,
  type FileClass,
  type FileCategory,
} from '@/lib/release/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const s3 = new S3Client({
  region: 'auto',
  endpoint:
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    process.env.R2_ENDPOINT ||
    `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey:
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
      process.env.R2_SECRET_ACCESS_KEY ||
      '',
  },
});
const R2_BUCKET =
  process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET || 'odubo-studio-media';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return gate.error;

    const { id } = await params;
    const body = (await req.json()) as {
      class?: string;
      category?: string;
      pieceId?: string | null;
    };

    const sets: string[] = [];
    const values: unknown[] = [];

    if (body.class !== undefined) {
      if (!(FILE_CLASSES as readonly string[]).includes(body.class)) {
        return NextResponse.json(
          { error: `class must be one of ${FILE_CLASSES.join(', ')}` },
          { status: 400 }
        );
      }
      sets.push('class = ?');
      values.push(body.class as FileClass);
    }
    if (body.category !== undefined) {
      if (!(FILE_CATEGORIES as readonly string[]).includes(body.category)) {
        return NextResponse.json(
          { error: `category must be one of ${FILE_CATEGORIES.join(', ')}` },
          { status: 400 }
        );
      }
      sets.push('category = ?');
      values.push(body.category as FileCategory);
    }
    if (body.pieceId !== undefined) {
      sets.push('piece_id = ?');
      values.push(body.pieceId);
    }

    if (!sets.length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    values.push(id);
    await executeQuery(`UPDATE warehouse_files SET ${sets.join(', ')} WHERE id = ?`, values);

    const rows = await queryDatabase('SELECT * FROM warehouse_files WHERE id = ?', [id]);
    if (!rows?.length) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return NextResponse.json({ file: rows[0] });
  } catch (error) {
    console.error('Update file failed:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
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
    const rows = await queryDatabase('SELECT * FROM warehouse_files WHERE id = ?', [id]);
    const file = rows?.[0];
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Refuse if the delivery sheet points at this object.
    const shipping = await queryDatabase(
      'SELECT id FROM distribution_release_tracks WHERE audio_r2_key = ?',
      [file.r2_key]
    );
    if (shipping?.length) {
      return NextResponse.json(
        {
          error:
            'This file is flagged to ship. Unship it first, or the delivery sheet will point at a file that no longer exists.',
        },
        { status: 409 }
      );
    }

    try {
      await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: file.r2_key }));
    } catch (err) {
      // The row is the index; a stranded object is cheaper than a phantom row.
      console.error('R2 delete failed (removing the row anyway):', err);
    }

    await executeQuery('DELETE FROM warehouse_files WHERE id = ?', [id]);
    // A piece pointing at this file as its preview must forget it.
    await executeQuery(
      'UPDATE warehouse_pieces SET preview_file_id = NULL WHERE preview_file_id = ?',
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete file failed:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
