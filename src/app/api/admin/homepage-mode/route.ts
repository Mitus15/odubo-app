import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'nodejs';

type HomepageMode = 'auto' | 'clips' | 'music';

interface SettingRow {
  value: string;
}

interface ClipCountRow {
  count: number;
}

/**
 * GET /api/admin/homepage-mode
 * Returns the current homepage mode and clip count
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

    return NextResponse.json({
      success: true,
      mode,
      effectiveMode,
      clipCount,
    });
  } catch (error) {
    console.error('[Homepage Mode] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get homepage mode', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/homepage-mode
 * Set the homepage mode (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json() as { mode: HomepageMode };
    const { mode } = body;

    if (!['auto', 'clips', 'music'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be: auto, clips, or music' },
        { status: 400 }
      );
    }

    // Ensure table exists (in case migration hasn't run)
    await executeQuery(
      `CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      []
    );

    // Upsert the setting
    await executeQuery(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ('homepage_mode', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [mode]
    );

    return NextResponse.json({ success: true, mode });
  } catch (error) {
    console.error('[Homepage Mode] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to set homepage mode', details: String(error) },
      { status: 500 }
    );
  }
}
