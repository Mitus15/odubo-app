/**
 * GET /api/admin/release/files/[id]/url — a short-lived presigned GET.
 *
 * Admin-only and time-boxed: these are the working masters and the DAW
 * sessions, not published assets. The public playback path for a shipped
 * master is /api/media/audio/[...key], which is a different route with a
 * different audience.
 */
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/api/requireAdmin';
import { queryDatabase } from '@/lib/db';
import { createStorageService } from '@/lib/storage/StorageService';

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
    const rows = await queryDatabase(
      'SELECT r2_key, original_filename, mime_type, status FROM warehouse_files WHERE id = ?',
      [id]
    );
    const file = rows?.[0];
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    if (file.status !== 'ready') {
      return NextResponse.json(
        { error: `File is ${file.status} — nothing to download yet` },
        { status: 409 }
      );
    }

    const url = await createStorageService().getPresignedUrl({
      key: file.r2_key,
      operation: 'get',
      expiresIn: 900,
    });

    return NextResponse.json({
      url,
      filename: file.original_filename,
      mimeType: file.mime_type,
      expiresIn: 900,
    });
  } catch (error) {
    console.error('Presign failed:', error);
    return NextResponse.json({ error: 'Failed to sign a download URL' }, { status: 500 });
  }
}
