import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

// Public endpoint to list recent galleries for the Moments page
// Returns minimal safe fields only. Pagination supported via limit/offset.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || '12')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));

    // In the future: filter by visibility in config JSON
    const rows = await queryDatabase(
      `SELECT id, title, description, starts_at, ends_at, created_at, updated_at
       FROM galleries
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return NextResponse.json({ galleries: rows || [] });
  } catch (e: any) {
    console.error('Public galleries list error:', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
