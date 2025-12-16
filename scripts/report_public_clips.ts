import { queryDatabase } from '../src/lib/db';

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing ${name}; set it before running`);
  }
  return v;
}

function parseParentId(related?: string | null): number | null {
  if (!related) return null;
  const m = related.match(/parent_id:(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  // Ensure required envs exist for D1 HTTP API
  requireEnv('DATABASE_URL');
  requireEnv('CLOUDFLARE_D1_API_TOKEN') || requireEnv('CLOUDFLARE_API_TOKEN');

  const videoSql = `
    SELECT id, title, is_public, status, publication_status, created_at
    FROM videos
    WHERE type != 'clip'
      AND (is_public = 1 OR is_public IS NULL)
      AND COALESCE(status, 'published') != 'archived'
      AND COALESCE(publication_status, 'live') = 'live'
    ORDER BY id ASC
  `;

  const clipSql = `
    SELECT id, title, artist_name, related_projects, is_public, status, publication_status, created_at
    FROM videos
    WHERE type = 'clip'
      AND (is_public = 1 OR is_public IS NULL)
      AND COALESCE(status, 'published') != 'archived'
      AND COALESCE(publication_status, 'live') = 'live'
    ORDER BY created_at DESC, id DESC
  `;

  const [videos, clips] = await Promise.all([
    queryDatabase(videoSql),
    queryDatabase(clipSql),
  ]);

  const totalVideos = videos.length;
  const totalClips = clips.length;

  const byParent = new Map<number, { count: number; titles: Set<string> }>();
  const orphanClips: { id: number; title: string | null }[] = [];

  for (const c of clips) {
    const pid = parseParentId(c.related_projects);
    if (pid == null) {
      orphanClips.push({ id: c.id, title: c.title });
      continue;
    }
    if (!byParent.has(pid)) {
      byParent.set(pid, { count: 0, titles: new Set() });
    }
    const entry = byParent.get(pid)!;
    entry.count += 1;
    if (c.title) entry.titles.add(c.title.replace(/\s+\d+$/, ''));
  }

  const parentRows = Array.from(byParent.entries()).map(([parentId, info]) => ({
    parentId,
    clips: info.count,
    titles: Array.from(info.titles).join(', '),
  })).sort((a, b) => b.clips - a.clips);

  console.log('=== Public parents ===');
  console.log(`Total public videos (non-clips): ${totalVideos}`);
  console.table(videos.map((v: any) => ({ id: v.id, title: v.title, status: v.status, pub: v.publication_status })));

  console.log('\n=== Public clips ===');
  console.log(`Total public clips: ${totalClips}`);
  console.table(parentRows);

  if (orphanClips.length) {
    console.log('\nClips without parent_id tag (related_projects):');
    console.table(orphanClips.slice(0, 50));
    if (orphanClips.length > 50) {
      console.log(`(+ ${orphanClips.length - 50} more...)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
