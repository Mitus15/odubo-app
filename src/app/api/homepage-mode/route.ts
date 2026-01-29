import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';

export const runtime = 'nodejs';

type HomepageMode = 'auto' | 'clips' | 'music';

interface SettingRow {
  value: string;
}

interface ClipCountRow {
  count: number;
}

/**
 * GET /api/homepage-mode
 * Public endpoint - returns the effective homepage mode
 */
export async function GET(req: NextRequest) {
  try {
    // Get current mode setting (handle table not existing)
    let mode: HomepageMode = 'auto';
    try {
      const settings = await queryDatabase(
        `SELECT value FROM site_settings WHERE key = 'homepage_mode'`,
        []
      ) as SettingRow[];
      mode = (settings[0]?.value || 'auto') as HomepageMode;
    } catch {
      // Table doesn't exist yet, use default
      mode = 'auto';
    }

    // Count published clips
    const countResult = await queryDatabase(
      `SELECT COUNT(*) as count FROM videos
       WHERE type = 'clip'
         AND COALESCE(publication_status, 'live') = 'live'
         AND COALESCE(status, 'published') != 'archived'`,
      []
    ) as ClipCountRow[];

    const clipCount = countResult[0]?.count || 0;

    // Determine effective mode
    let effectiveMode: 'clips' | 'music';
    if (mode === 'auto') {
      effectiveMode = clipCount > 0 ? 'clips' : 'music';
    } else {
      effectiveMode = mode;
    }

    const res = NextResponse.json({
      mode: effectiveMode,
      hasClips: clipCount > 0,
    });

    // Cache for 60 seconds
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
    return res;
  } catch (error) {
    console.error('[Homepage Mode] GET error:', error);
    // Default to music on error (safer fallback)
    return NextResponse.json({ mode: 'music', hasClips: false });
  }
}
