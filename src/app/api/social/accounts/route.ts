import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

/**
 * GET /api/social/accounts
 * Get all connected social accounts from our database
 * Supports filtering by entity_id and platform
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entity_id');
    const platform = searchParams.get('platform');
    const activeOnly = searchParams.get('active') !== 'false';
    const groupByPlatform = searchParams.get('group') === 'platform';

    let query = `
      SELECT * FROM social_accounts
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (activeOnly) {
      query += ` AND is_active = 1`;
    }

    if (entityId) {
      query += ` AND entity_id = ?`;
      params.push(entityId);
    }

    if (platform) {
      query += ` AND platform = ?`;
      params.push(platform);
    }

    query += ` ORDER BY platform, account_handle`;

    const result = await db.prepare(query).bind(...params).all();
    const accounts = result.results || [];

    // Optionally group by platform for UI convenience
    if (groupByPlatform) {
      const grouped: Record<string, unknown[]> = {};
      accounts.forEach((acc: unknown) => {
        const p = (acc as { platform: string }).platform;
        if (!grouped[p]) grouped[p] = [];
        grouped[p].push(acc);
      });
      return NextResponse.json({ accounts, grouped });
    }

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('[Social Accounts] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

/**
 * DELETE /api/social/accounts/:id
 * Deactivate a social account (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const db = env.DB;

    const body = await request.json();
    const accountId = (body as { id?: string }).id;

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    await db
      .prepare(`UPDATE social_accounts SET is_active = 0 WHERE id = ?`)
      .bind(accountId)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Social Accounts] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to deactivate account' }, { status: 500 });
  }
}
