import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { platformConfigs, type Platform } from '@/lib/platform-oauth';

export const runtime = 'edge';

/**
 * Disconnect Platform
 *
 * POST /api/connections/disconnect
 * Body: { platform: 'youtube' | 'instagram' | ... }
 *
 * Removes the platform connection and deletes stored tokens.
 */
export async function POST(request: NextRequest) {
  try {
    const body: { platform?: string } = await request.json();
    const platform = body.platform as Platform;

    // Validate platform
    if (!platform || !platformConfigs[platform]) {
      return NextResponse.json(
        { error: 'Invalid platform specified' },
        { status: 400 }
      );
    }

    const { env } = getRequestContext();
    const db = env.DB;

    // Check if connection exists
    const connection = await db
      .prepare(`SELECT id, account_name FROM platform_connections WHERE platform = ?`)
      .bind(platform)
      .first();

    if (!connection) {
      return NextResponse.json(
        { error: 'No connection found for this platform' },
        { status: 404 }
      );
    }

    // Delete the connection
    await db
      .prepare(`DELETE FROM platform_connections WHERE platform = ?`)
      .bind(platform)
      .run();

    // Log the disconnection
    await db
      .prepare(
        `INSERT INTO sync_logs (job_type, platform, status, completed_at)
         VALUES ('oauth_disconnect', ?, 'completed', datetime('now'))`
      )
      .bind(platform)
      .run();

    return NextResponse.json({
      success: true,
      platform,
      accountName: (connection as any).account_name,
      message: `Successfully disconnected ${platformConfigs[platform].displayName}`,
    });
  } catch (error) {
    console.error('[Disconnect API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
