import { NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { getAccounts, mapPlatform } from '@/lib/postforme';

export const runtime = 'edge';

/**
 * POST /api/social/accounts/sync
 * Sync connected accounts from Post for Me API to local database
 */
export async function POST() {
  try {
    // Fetch accounts from Post for Me
    const result = await getAccounts();

    if (!result.success || !result.data) {
      console.error('[Social Accounts Sync] PostForMe error:', result.error);
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch accounts from PostForMe' },
        { status: 500 }
      );
    }

    const postformeAccounts = result.data;
    let synced = 0;
    let updated = 0;

    // Process each account
    for (const account of postformeAccounts) {
      // Skip disconnected/expired accounts
      if (account.status !== 'connected') {
        continue;
      }

      // Normalize platform name
      const platform = mapPlatform(account.platform);

      // Check if account already exists
      const existing = await queryDatabase(
        `SELECT id FROM social_accounts WHERE postforme_account_id = ?`,
        [account.id]
      );

      const now = new Date().toISOString();

      if (existing && existing.length > 0) {
        // Update existing account
        await executeQuery(
          `UPDATE social_accounts
           SET platform = ?,
               account_handle = ?,
               account_name = ?,
               profile_image_url = ?,
               is_active = 1,
               last_synced_at = ?
           WHERE postforme_account_id = ?`,
          [
            platform,
            account.username,
            account.username,
            account.profile_photo_url || null,
            now,
            account.id,
          ]
        );
        updated++;
      } else {
        // Insert new account
        await executeQuery(
          `INSERT INTO social_accounts
           (id, platform, account_handle, account_name, profile_image_url, postforme_account_id, is_active, connected_at, last_synced_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            crypto.randomUUID(),
            platform,
            account.username,
            account.username,
            account.profile_photo_url || null,
            account.id,
            now,
            now,
          ]
        );
        synced++;
      }
    }

    // Mark accounts not in PostForMe as inactive
    if (postformeAccounts.length > 0) {
      const activeIds = postformeAccounts
        .filter((a) => a.status === 'connected')
        .map((a) => a.id);

      if (activeIds.length > 0) {
        const placeholders = activeIds.map(() => '?').join(', ');
        await executeQuery(
          `UPDATE social_accounts
           SET is_active = 0
           WHERE postforme_account_id NOT IN (${placeholders})`,
          activeIds
        );
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      updated,
      total: postformeAccounts.filter((a) => a.status === 'connected').length,
    });
  } catch (error) {
    console.error('[Social Accounts Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync accounts', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
