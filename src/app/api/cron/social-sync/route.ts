import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * GET /api/cron/social-sync
 * Scheduled job to sync social media data from Post for Me
 * Triggered by Vercel Cron every hour
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization (Vercel sets this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the cron secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the base URL from the request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // Step 1: Process scheduled posts that are due
    console.log('[Cron Social Sync] Processing scheduled posts...');
    const processResponse = await fetch(`${baseUrl}/api/social/posts/process-scheduled`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': cronSecret ? `Bearer ${cronSecret}` : '',
      },
    });

    const processResult = (await processResponse.json()) as {
      success?: boolean;
      processed?: number;
      published?: number;
      failed?: number;
      errors?: Array<{ post_id: string; error: string }>;
    };

    if (!processResponse.ok) {
      console.error('[Cron Social Sync] Process scheduled failed:', processResult);
    } else {
      console.log('[Cron Social Sync] Scheduled posts processed:', processResult);
    }

    // Step 2: Sync data from Post for Me
    console.log('[Cron Social Sync] Syncing from Post for Me...');
    const syncResponse = await fetch(`${baseUrl}/api/social/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'full',
        triggered_by: 'cron',
      }),
    });

    const syncResult = (await syncResponse.json()) as {
      success?: boolean;
      error?: string;
      sync_id?: string;
      accounts_synced?: number;
      posts_synced?: number;
      metrics_synced?: number;
      duration_ms?: number;
    };

    if (!syncResponse.ok) {
      console.error('[Cron Social Sync] Sync failed:', syncResult);
      return NextResponse.json(
        { success: false, error: syncResult.error || 'Sync failed' },
        { status: 500 }
      );
    }

    console.log('[Cron Social Sync] Completed:', syncResult);

    return NextResponse.json({
      success: true,
      scheduled_posts: {
        processed: processResult.processed || 0,
        published: processResult.published || 0,
        failed: processResult.failed || 0,
      },
      sync: {
        sync_id: syncResult.sync_id,
        accounts_synced: syncResult.accounts_synced,
        posts_synced: syncResult.posts_synced,
        metrics_synced: syncResult.metrics_synced,
        duration_ms: syncResult.duration_ms,
      },
    });
  } catch (error) {
    console.error('[Cron Social Sync] Error:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
