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
      "SELECT value FROM app_config WHERE key = 'featured_video_id'",
      []
    ) as any[];

    const id = rows?.[0]?.value;
    if (id) {
      return NextResponse.redirect(new URL(`/watch/${id}`, 'https://odubo.studio'), 302);
    }
  } catch {
    // Fall through to homepage
  }

  return NextResponse.redirect(new URL('/', 'https://odubo.studio'), 302);
}
