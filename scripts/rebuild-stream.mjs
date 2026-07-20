// Rebuild Cloudflare Stream from R2 masters after Stream was wiped during suspension.
// For every row in `videos`, find its R2 source master, re-ingest into Stream (server-side copy
// from a presigned R2 URL), wait until ready, enable MP4 downloads, and re-link the D1 record.
// Placement fields (type/category/publication_status/is_public/position) are left untouched.
//
// Run: node --env-file=.env.local scripts/rebuild-stream.mjs
// Resumable: skips any video that already has a ready Stream video tagged meta.video_id.

import { execFileSync } from 'node:child_process';

const ACCT = process.env.CLOUDFLARE_ACCOUNT_ID;
const STREAM_TOK = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const D1_URL = process.env.DATABASE_URL;
const D1_TOK = process.env.CLOUDFLARE_D1_API_TOKEN;
const R2_EP = process.env.CLOUDFLARE_R2_ENDPOINT;
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'odubo-studio-media';
const CUSTOMER = 'customer-tpkm273r1u0s40no'; // matches hardcoded value in the app
const STREAM_BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/stream`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function norm(s) {
  s = String(s).split('/').pop();
  s = s.replace(/\.\w+$/, '');
  s = s.replace(/^\d{10,}-/, '');
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function d1(sql, params = []) {
  const res = await fetch(`${D1_URL}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${D1_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const j = await res.json();
  if (!j.success) throw new Error('D1 error: ' + JSON.stringify(j.errors));
  return j.result[0].results;
}

async function stream(path, opts = {}) {
  const res = await fetch(`${STREAM_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${STREAM_TOK}`, ...(opts.headers || {}) },
  });
  return res.json();
}

function presign(key) {
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    AWS_DEFAULT_REGION: 'auto',
  };
  return execFileSync(
    'aws',
    ['s3', 'presign', `s3://${BUCKET}/${key}`, '--endpoint-url', R2_EP, '--expires-in', '604800'],
    { env, encoding: 'utf8' }
  ).trim();
}

function listR2Sources() {
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    AWS_DEFAULT_REGION: 'auto',
  };
  const out = execFileSync(
    'aws',
    ['s3', 'ls', `s3://${BUCKET}/videos/source/`, '--endpoint-url', R2_EP, '--recursive'],
    { env, encoding: 'utf8' }
  );
  const files = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^\S+\s+\S+\s+(\d+)\s+(videos\/source\/.+\.(?:mp4|mov|m4v|webm))$/i);
    if (m) files.push({ key: m[2], size: Number(m[1]) });
  }
  return files;
}

async function main() {
  log('Loading videos + transcoding_jobs + R2 sources...');
  const videos = await d1(
    'SELECT id, title, type, uid, poster_url, thumbnail, thumbnail_timestamp_pct FROM videos ORDER BY id'
  );
  const tj = await d1(
    'SELECT video_id, source_url FROM transcoding_jobs WHERE source_url IS NOT NULL'
  );
  const r2files = listR2Sources();
  log(`videos=${videos.length} transcoding_jobs=${tj.length} r2_sources=${r2files.length}`);

  // Build key pool + normalized index
  const keyBySize = new Map(r2files.map((f) => [f.key, f.size]));
  const byNorm = new Map();
  for (const f of r2files) {
    const n = norm(f.key);
    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n).push(f.key);
  }
  // Authoritative map from transcoding_jobs: video_id -> r2 key
  const tjKey = new Map();
  for (const r of tj) {
    const key = String(r.source_url).replace(/^https?:\/\/[^/]+\//, '');
    if (keyBySize.has(key)) tjKey.set(r.video_id, key);
  }

  // Assign a source key to every video (transcoding_jobs first, then unique title match)
  const used = new Set();
  const assign = new Map();
  const unmatched = [];
  for (const v of videos) {
    if (tjKey.has(v.id) && !used.has(tjKey.get(v.id))) {
      assign.set(v.id, tjKey.get(v.id));
      used.add(tjKey.get(v.id));
    }
  }
  for (const v of videos) {
    if (assign.has(v.id)) continue;
    const cands = (byNorm.get(norm(v.title)) || []).filter((k) => !used.has(k));
    if (cands.length) {
      assign.set(v.id, cands[0]);
      used.add(cands[0]);
    } else {
      unmatched.push(v);
    }
  }
  if (unmatched.length) {
    log('!! UNMATCHED (no R2 source):', unmatched.map((v) => `${v.id}:${v.title}`).join(', '));
  }
  log(`assigned sources: ${assign.size}/${videos.length}`);

  // Existing Stream videos tagged with meta.video_id (for resume/skip)
  const existing = new Map();
  let cursor;
  do {
    const q = new URLSearchParams({ limit: '1000' });
    if (cursor) q.set('after', cursor);
    const r = await stream(`?${q}`);
    for (const sv of r.result || []) {
      const vid = sv.meta && sv.meta.video_id;
      if (vid) existing.set(String(vid), sv);
    }
    cursor = r.result_info && r.result_info.cursors && r.result_info.cursors.after;
    if (!r.result || r.result.length === 0) break;
  } while (cursor);
  log(`existing Stream videos tagged with video_id: ${existing.size}`);

  // Order small-first so the 14GB film masters go last
  const work = videos
    .filter((v) => assign.has(v.id))
    .sort((a, b) => (keyBySize.get(assign.get(a.id)) || 0) - (keyBySize.get(assign.get(b.id)) || 0));

  // PHASE 1: initiate copies (skip already-ingested)
  const jobs = new Map(); // video_id -> newUid
  let initiated = 0,
    skipped = 0;
  const CONC = 6;
  for (let i = 0; i < work.length; i += CONC) {
    const batch = work.slice(i, i + CONC);
    await Promise.all(
      batch.map(async (v) => {
        const ex = existing.get(String(v.id));
        if (ex) {
          jobs.set(v.id, ex.uid);
          skipped++;
          return;
        }
        try {
          const url = presign(assign.get(v.id));
          const body = { url, meta: { name: v.title || `video-${v.id}`, video_id: String(v.id) } };
          if (v.thumbnail_timestamp_pct != null) body.thumbnailTimestampPct = v.thumbnail_timestamp_pct;
          const r = await stream('/copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (r.success && r.result && r.result.uid) {
            jobs.set(v.id, r.result.uid);
            initiated++;
          } else {
            log(`  copy FAILED id=${v.id} ${v.title}:`, JSON.stringify(r.errors));
          }
        } catch (e) {
          log(`  copy ERROR id=${v.id} ${v.title}:`, e.message);
        }
      })
    );
    log(`initiated ${initiated} + skipped ${skipped} / ${work.length}`);
  }

  // PHASE 2: poll until ready, enable downloads, update D1
  const pending = new Set(jobs.keys());
  const done = new Set();
  const failed = [];
  const deadline = Date.now() + 90 * 60 * 1000; // 90 min
  while (pending.size && Date.now() < deadline) {
    for (const vid of [...pending]) {
      const uid = jobs.get(vid);
      const r = await stream(`/${uid}`);
      const st = r.result && r.result.status && r.result.status.state;
      if (st === 'ready') {
        // enable MP4 downloads (async; don't wait for mp4 render)
        await stream(`/${uid}/downloads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 'default' }),
        }).catch(() => {});
        const v = videos.find((x) => x.id === vid);
        const url = `https://iframe.videodelivery.net/${uid}`;
        const mp4 = `https://${CUSTOMER}.cloudflarestream.com/${uid}/downloads/default.mp4`;
        const newThumb = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;
        // Replace dead videodelivery posters; keep real R2 (media.odubo.studio) posters
        const poster =
          !v.poster_url || v.poster_url.includes('videodelivery.net') ? newThumb : v.poster_url;
        const thumb =
          !v.thumbnail || String(v.thumbnail).includes('videodelivery.net') ? newThumb : v.thumbnail;
        await d1(
          'UPDATE videos SET uid=?, stream_video_id=?, url=?, mp4_url=?, poster_url=?, thumbnail=?, updated_at=datetime("now") WHERE id=?',
          [uid, uid, url, mp4, poster, thumb, vid]
        );
        done.add(vid);
        pending.delete(vid);
        log(`  ✓ ${done.size}/${jobs.size} id=${vid} ${v.title}`);
      } else if (st === 'error') {
        failed.push({ vid, reason: r.result.status.errorReasonText });
        pending.delete(vid);
        log(`  ✗ id=${vid} error: ${r.result.status.errorReasonText}`);
      }
    }
    if (pending.size) {
      log(`waiting on ${pending.size} (transcoding)...`);
      await sleep(15000);
    }
  }

  log('==== DONE ====');
  log(`re-linked: ${done.size}`);
  log(`skipped (already done): ${[...jobs.keys()].filter((k) => existing.has(String(k))).length}`);
  log(`failed: ${failed.length}`, failed.length ? JSON.stringify(failed) : '');
  log(`still pending at timeout: ${pending.size}`, pending.size ? [...pending].join(',') : '');
  if (unmatched.length) log(`no R2 source: ${unmatched.map((v) => v.id).join(',')}`);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
