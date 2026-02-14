import { queryDatabase } from '../src/lib/db';

async function main() {
  const deploys = await queryDatabase(
    `SELECT v.id, v.title, vd.platform, vd.status, vd.external_url
     FROM video_deployments vd
     JOIN videos v ON v.id = vd.video_id
     WHERE vd.deployed_at >= '2026-02-12'
     ORDER BY v.id, vd.platform`,
    []
  );

  const byVideo = new Map();
  for (const d of deploys) {
    if (!byVideo.has(d.id)) {
      byVideo.set(d.id, { title: d.title, platforms: {} });
    }
    byVideo.get(d.id).platforms[d.platform] = {
      status: d.status,
      url: d.external_url || 'no URL'
    };
  }

  console.log('📹 Recent video deployments (since Feb 12):\n');
  for (const [id, data] of byVideo.entries()) {
    console.log(`Video ${id}: ${data.title}`);
    for (const [platform, info] of Object.entries(data.platforms)) {
      console.log(`  ${platform}: ${info.status} - ${info.url}`);
    }
    console.log('');
  }
}

main().catch(console.error);
