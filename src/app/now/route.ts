import { queryDatabase } from '@/lib/db';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /now — Permanent bio link.
 * Redirects to the currently featured video's watch page.
 */
export async function GET() {
  try {
    const rows = await queryDatabase(
      `SELECT video_id FROM featured_schedule
       WHERE starts_at <= datetime('now')
       ORDER BY starts_at DESC
       LIMIT 1`,
      []
    ) as any[];

    const id = rows?.[0]?.video_id;
    if (id) {
      return NextResponse.redirect(new URL(`/watch/${id}`, 'https://odubo.studio'), 302);
    }
  } catch {
    // Fall through to homepage
  }

  return NextResponse.redirect(new URL('/', 'https://odubo.studio'), 302);
}
