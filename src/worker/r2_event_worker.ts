// Cloudflare Worker module to receive R2 put notifications and enqueue thumbnail jobs
// This worker expects to be bound with the following environment variables:
// - SITE_ORIGIN: the public origin of your Next app (e.g. https://example.com)
// - THUMBNAIL_JOB_SECRET: shared secret used to authenticate job requests to the app

export default {
  async fetch(request: Request, env: any) {
    try {
      const payload = await request.json().catch(() => null);
      if (!payload) return new Response('no payload', { status: 400 });

      // Expecting a record structure similar to S3/R2 notifications with Records array
      const records = payload.Records || [];
      const jobs: Promise<any>[] = [];

      for (const rec of records) {
        const key = rec?.r2?.key || rec?.s3?.object?.key || null;
        if (!key) continue;

        // Only handle gallery video uploads
        // Expected key: galleries/{galleryId}/videos/{filename}
        const parts = key.split('/');
        if (parts.length >= 4 && parts[0] === 'galleries' && parts[2] === 'videos') {
          const galleryId = parts[1];
          const filename = parts.slice(3).join('/');
          // derive uid from filename (strip extension)
          const uid = filename.split('.').slice(0, -1).join('.') || String(Date.now());

          const jobUrl = `${env.SITE_ORIGIN}/api/moments/thumbnail-job`;
          jobs.push(fetch(jobUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-thumbnail-secret': env.THUMBNAIL_JOB_SECRET || '',
            },
            body: JSON.stringify({ r2Key: key, galleryId, uid }),
          }).catch((e) => {
            // don't fail the whole worker if a single job enqueue fails
            console.error('enqueue failed', e);
          }));
        }
      }

      await Promise.all(jobs);
      return new Response('ok');
    } catch (e: any) {
      console.error('r2_event_worker error', e);
      return new Response('error', { status: 500 });
    }
  }
};
