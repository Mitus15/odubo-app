/**
 * Cloudflare Worker: Triggers MP4 processing every 5 minutes
 * Free tier: Up to 100,000 requests/day
 */

interface Env {
  CRON_SECRET: string;
  API_URL: string;
}

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log('Triggering MP4 processing job...');

    try {
      const response = await fetch(env.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': env.CRON_SECRET,
        },
      });

      if (!response.ok) {
        console.error('Job failed:', response.status, await response.text());
      } else {
        const result = await response.json();
        console.log('Job completed:', result);
      }
    } catch (error) {
      console.error('Error triggering job:', error);
    }
  },
};
