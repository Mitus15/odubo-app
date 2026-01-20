import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
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

    // Check if connection exists
    const connections = await queryDatabase(
      `SELECT id, account_name FROM platform_connections WHERE platform = ?`,
      [platform]
    );
    const connection = connections?.[0];

    if (!connection) {
      return NextResponse.json(
        { error: 'No connection found for this platform' },
        { status: 404 }
      );
    }

    // Delete the connection
    await executeQuery(
      `DELETE FROM platform_connections WHERE platform = ?`,
      [platform]
    );

    // Log the disconnection
    await executeQuery(
      `INSERT INTO sync_logs (job_type, platform, status, completed_at)
       VALUES ('oauth_disconnect', ?, 'completed', datetime('now'))`,
      [platform]
    );

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
