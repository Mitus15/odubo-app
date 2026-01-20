import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

interface SocialAccount {
  id: string;
  entity_id: string | null;
  platform: string;
  account_handle: string;
  account_name: string | null;
  profile_image_url: string | null;
  postforme_account_id: string;
  is_active: number;
  connected_at: string;
  last_synced_at: string | null;
}

/**
 * GET /api/social/accounts
 * Get all connected social accounts from our database
 * Supports filtering by entity_id and platform
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const activeOnly = searchParams.get('active') !== 'false';
    const groupByPlatform = searchParams.get('group') === 'platform';

    let query = `SELECT * FROM social_accounts WHERE 1=1`;
    const params: (string | number)[] = [];

    if (activeOnly) {
      query += ` AND is_active = 1`;
    }

    // Entity filtering removed - show all accounts regardless of entity

    if (platform) {
      query += ` AND platform = ?`;
      params.push(platform);
    }

    query += ` ORDER BY platform, account_handle`;

    const accounts = await queryDatabase(query, params) as SocialAccount[];

    // Optionally group by platform for UI convenience
    if (groupByPlatform && accounts) {
      const grouped: Record<string, SocialAccount[]> = {};
      accounts.forEach((acc) => {
        const p = acc.platform;
        if (!grouped[p]) grouped[p] = [];
        grouped[p].push(acc);
      });
      return NextResponse.json({ accounts, grouped });
    }

    return NextResponse.json({ accounts: accounts || [] });
  } catch (error) {
    console.error('[Social Accounts] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

/**
 * DELETE /api/social/accounts
 * Deactivate a social account (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const accountId = (body as { id?: string }).id;

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    await executeQuery(
      `UPDATE social_accounts SET is_active = 0 WHERE id = ?`,
      [accountId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Social Accounts] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to deactivate account' }, { status: 500 });
  }
}
