/**
 * Cloudflare Worker: Scheduled jobs for Odubo
 *
 * Every 6 hours: Arsenal sync (match published content from platform feeds)
 */

interface Env {
  CRON_SECRET: string;
  ARSENAL_SYNC_URL: string;
}

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log('[Arsenal Sync] Triggering...');

    try {
      const response = await fetch(env.ARSENAL_SYNC_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.CRON_SECRET}`,
        },
      });

      if (!response.ok) {
        console.error('[Arsenal Sync] Failed:', response.status, await response.text());
      } else {
        const result = await response.json();
        console.log('[Arsenal Sync] Completed:', result);
      }
    } catch (error) {
      console.error('[Arsenal Sync] Error:', error);
    }
  },
};
