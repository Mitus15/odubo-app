import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getAvailablePlatforms, type Platform } from '@/lib/platform-oauth';

export const runtime = 'edge';

/**
 * Platform Connections API
 *
 * GET /api/connections
 * Returns list of connected platforms and available platforms to connect
 */
export async function GET() {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    // Get all connections from database
    const connections = await db
      .prepare(
        `SELECT
           id,
           platform,
           account_id,
           account_name,
           status,
           last_sync_at,
           last_error,
           created_at,
           updated_at
         FROM platform_connections
         ORDER BY created_at DESC`
      )
      .all()
      .catch(() => ({ results: [] }));

    // Get available platforms with configuration status
    const availablePlatforms = getAvailablePlatforms();

    // Format connections
    const connectedPlatforms = ((connections as any)?.results || []).map((conn: any) => ({
      id: conn.id,
      platform: conn.platform,
      accountId: conn.account_id,
      accountName: conn.account_name,
      status: conn.status,
      lastSync: conn.last_sync_at,
      lastError: conn.last_error,
      createdAt: conn.created_at,
      updatedAt: conn.updated_at,
    }));

    // Format available platforms
    const platforms = availablePlatforms.map((p) => {
      const connected = connectedPlatforms.find(
        (c: any) => c.platform === p.platform
      );
      return {
        platform: p.platform,
        displayName: p.config.displayName,
        icon: p.config.icon,
        color: p.config.color,
        available: p.config.available,
        requiresApproval: p.config.requiresApproval,
        configured: p.configured,
        connected: !!connected,
        connection: connected || null,
      };
    });

    return NextResponse.json({
      connections: connectedPlatforms,
      platforms,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Connections API] Error:', error);
    return NextResponse.json(
      {
        connections: [],
        platforms: [],
        error: error instanceof Error ? error.message : 'Failed to fetch connections',
      },
      { status: 500 }
    );
  }
}
