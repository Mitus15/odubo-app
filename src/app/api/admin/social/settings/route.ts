import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

interface SocialSettings {
  slots_per_day: number;
  default_timezone: string;
  auto_hashtag_limit: number;
  require_approval: boolean;
}

/**
 * GET /api/admin/social/settings
 * Get social studio settings
 */
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Check if settings table exists, if not create it
    await executeQuery(
      `CREATE TABLE IF NOT EXISTS social_studio_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        slots_per_day INTEGER DEFAULT 2,
        default_timezone TEXT DEFAULT 'America/Los_Angeles',
        auto_hashtag_limit INTEGER DEFAULT 7,
        require_approval INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      []
    );

    // Get or create default settings
    let settings = await queryDatabase(
      'SELECT * FROM social_studio_settings WHERE id = 1',
      []
    );

    if (!settings || settings.length === 0) {
      // Create default settings
      await executeQuery(
        `INSERT INTO social_studio_settings (id, slots_per_day, default_timezone, auto_hashtag_limit, require_approval)
         VALUES (1, 2, 'America/Los_Angeles', 7, 0)`,
        []
      );
      settings = await queryDatabase(
        'SELECT * FROM social_studio_settings WHERE id = 1',
        []
      );
    }

    const setting = settings[0] as {
      slots_per_day: number;
      default_timezone: string;
      auto_hashtag_limit: number;
      require_approval: number;
    };

    return NextResponse.json({
      success: true,
      settings: {
        slots_per_day: setting.slots_per_day,
        default_timezone: setting.default_timezone,
        auto_hashtag_limit: setting.auto_hashtag_limit,
        require_approval: setting.require_approval === 1,
      },
    });
  } catch (error) {
    console.error('[Social Settings] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/social/settings
 * Update social studio settings
 */
export async function PATCH(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (typeof body.slots_per_day === 'number' && body.slots_per_day >= 1 && body.slots_per_day <= 10) {
      updates.push('slots_per_day = ?');
      values.push(body.slots_per_day);
    }

    if (typeof body.default_timezone === 'string') {
      updates.push('default_timezone = ?');
      values.push(body.default_timezone);
    }

    if (typeof body.auto_hashtag_limit === 'number' && body.auto_hashtag_limit >= 0 && body.auto_hashtag_limit <= 30) {
      updates.push('auto_hashtag_limit = ?');
      values.push(body.auto_hashtag_limit);
    }

    if (typeof body.require_approval === 'boolean') {
      updates.push('require_approval = ?');
      values.push(body.require_approval ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    updates.push('updated_at = datetime(\'now\')');

    await executeQuery(
      `UPDATE social_studio_settings SET ${updates.join(', ')} WHERE id = 1`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Social Settings] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
