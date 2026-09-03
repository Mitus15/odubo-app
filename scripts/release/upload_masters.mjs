/**
 * Upload an album's masters and their web transcodes, then flag each master
 * to ship — the whole ingest, from the command line.
 *
 *   node --env-file=.env.local scripts/release/upload_masters.mjs <plan.json>
 *   node --env-file=.env.local scripts/release/upload_masters.mjs <plan.json> --apply
 *
 * WHY A CLI AS WELL AS THE BROWSER
 * --------------------------------
 * FolderIngest does this from a page, which is right when the owner is sitting
 * in front of it. But an album is ~800MB across 28 objects, and a browser tab
 * that sleeps, navigates or loses focus mid-run leaves half-written state
 * behind. This path is resumable, logs every object, and can be re-run safely:
 * an object already present in R2 with the right size is skipped.
 *
 * TWO OBJECTS PER SONG, ON PURPOSE
 * --------------------------------
 * The 24-bit WAV is what the distributor receives. It is also 80MB, so making
 * the album preview stream it would be unkind. An AAC transcode is uploaded
 * alongside and the preview points at that instead. This is the "delivery and
 * preview may disagree about the audio" rule the ship endpoint already
 * encodes — here it is used deliberately rather than as a fallback.
 *
 * The plan file is explicit rather than derived. Matching a filename to a
 * song is a guess (`rap.wav` is the song "Please"), and a guess does not
 * belong in the step that writes the distributor's delivery record.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  S3Client, PutObjectCommand, HeadObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';

const APPLY = process.argv.includes('--apply');
const PLAN_PATH = process.argv[2];
if (!PLAN_PATH || PLAN_PATH.startsWith('--')) {
  console.error('Usage: upload_masters.mjs <plan.json> [--apply]');
  process.exit(1);
}

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const D1 = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.CLOUDFLARE_D1_DATABASE_ID}/query`;

async function sql(statement, params = []) {
  const res = await fetch(D1, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_D1_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: statement, params }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(JSON.stringify(body.errors));
  return body.result[0].results ?? [];
}

/** Mirrors sanitizeFilename in the multipart route — the extension is load-bearing. */
function sanitize(filename) {
  const dot = filename.lastIndexOf('.');
  const hasExt = dot > 0 && dot < filename.length - 1;
  const base = (hasExt ? filename.slice(0, dot) : filename)
    .replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').slice(0, 120);
  const ext = hasExt ? filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return ext ? `${base}.${ext}` : base;
}

const MIME = { wav: 'audio/wav', m4a: 'audio/mp4', flac: 'audio/flac', aiff: 'audio/aiff', mp3: 'audio/mpeg' };
const PART = 50 * 1024 * 1024;

async function alreadyThere(key, size) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return head.ContentLength === size;
  } catch { return false; }
}

async function put(localPath, key) {
  const size = fs.statSync(localPath).size;
  const ext = path.extname(localPath).slice(1).toLowerCase();
  const ContentType = MIME[ext] ?? 'application/octet-stream';

  if (await alreadyThere(key, size)) { process.stdout.write(' (already uploaded)'); return size; }

  if (size <= PART) {
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: fs.readFileSync(localPath), ContentType }));
    return size;
  }

  // Hand-rolled multipart: lib-storage is not installed, and a 137MB master
  // exceeds what one PUT should carry.
  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: key, ContentType }));
  try {
    const fd = fs.openSync(localPath, 'r');
    const parts = [];
    for (let offset = 0, n = 1; offset < size; offset += PART, n++) {
      const length = Math.min(PART, size - offset);
      const buf = Buffer.alloc(length);
      fs.readSync(fd, buf, 0, length, offset);
      const { ETag } = await s3.send(new UploadPartCommand({
        Bucket: BUCKET, Key: key, UploadId, PartNumber: n, Body: buf,
      }));
      parts.push({ ETag, PartNumber: n });
      process.stdout.write('.');
    }
    fs.closeSync(fd);
    await s3.send(new CompleteMultipartUploadCommand({
      Bucket: BUCKET, Key: key, UploadId, MultipartUpload: { Parts: parts },
    }));
    return size;
  } catch (err) {
    await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId })).catch(() => {});
    throw err;
  }
}

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
const { projectId, releaseId, songs } = plan;

console.log(`${songs.length} songs · ${APPLY ? 'APPLYING' : 'DRY RUN — pass --apply to write'}\n`);

let uploaded = 0, shipped = 0, failed = 0;

for (const song of songs) {
  const label = `${String(song.trackNumber).padStart(2)}. ${song.title}`;
  if (!fs.existsSync(song.master)) { console.log(`${label}  MASTER MISSING: ${song.master}`); failed++; continue; }

  if (!APPLY) {
    console.log(`${label}\n     master  ${path.basename(song.master)}\n     web     ${song.web ? path.basename(song.web) : '(none)'}`);
    continue;
  }

  process.stdout.write(label);
  try {
    // The piece must exist before a file can hang off it.
    let [piece] = await sql(
      `SELECT id FROM warehouse_pieces WHERE project_id = ? AND track_id = ? AND kind = 'track-master'`,
      [projectId, song.trackId]
    );
    if (!piece) {
      const pieceId = crypto.randomUUID();
      await sql(
        `INSERT INTO warehouse_pieces (id, project_id, kind, title, track_id, sort_order)
         VALUES (?, ?, 'track-master', ?, ?, ?)`,
        [pieceId, projectId, song.title, song.trackId, song.trackNumber]
      );
      piece = { id: pieceId };
      process.stdout.write(' +piece');
    }

    // ---- the master: what the distributor receives ----
    const masterKey = `warehouse/${projectId}/commercial/audio-master/${song.stamp}-${sanitize(path.basename(song.master))}`;
    const size = await put(song.master, masterKey);
    const fileId = crypto.randomUUID();
    await sql(
      `INSERT INTO warehouse_files
         (id, project_id, piece_id, class, category, r2_key, original_filename, mime_type, size_bytes, status)
       VALUES (?, ?, ?, 'commercial', 'audio-master', ?, ?, 'audio/wav', ?, 'ready')`,
      [fileId, projectId, piece.id, masterKey, path.basename(song.master), size]
    );
    await sql(
      `UPDATE distribution_release_tracks
          SET audio_r2_key = ?, audio_url = ?, duration_seconds = ?, updated_at = datetime('now')
        WHERE release_id = ? AND internal_track_id = ?`,
      [masterKey, `warehouse:${fileId}`, song.durationSeconds, releaseId, song.trackId]
    );
    uploaded++; shipped++;

    // ---- the transcode: what the preview streams ----
    if (song.web && fs.existsSync(song.web)) {
      const webKey = `warehouse/${projectId}/commercial/audio-master/web/${song.stamp}-${sanitize(path.basename(song.web))}`;
      const webSize = await put(song.web, webKey);
      const webId = crypto.randomUUID();
      await sql(
        `INSERT INTO warehouse_files
           (id, project_id, piece_id, class, category, r2_key, original_filename, mime_type, size_bytes, status)
         VALUES (?, ?, ?, 'commercial', 'audio-master', ?, ?, 'audio/mp4', ?, 'ready')`,
        [webId, projectId, piece.id, webKey, path.basename(song.web), webSize]
      );
      await sql(
        `UPDATE tracks
            SET audio_url = ?, source_file_id = ?, audio_status = 'ready',
                duration = ?, updated_at = datetime('now')
          WHERE id = ?`,
        [`/api/media/audio/${webKey}`, webId, song.durationSeconds, song.trackId]
      );
      uploaded++;
    }
    console.log('  ok');
  } catch (err) {
    failed++;
    console.log(`  FAILED: ${err.message}`);
  }
}

if (APPLY) {
  const total = await sql(
    `SELECT COALESCE(SUM(duration),0) d, COUNT(*) c FROM tracks WHERE album_id = (SELECT internal_album_id FROM distribution_releases WHERE id = ?)`,
    [releaseId]
  );
  await sql(
    `UPDATE albums SET total_duration = ?, total_tracks = ?, updated_at = datetime('now')
      WHERE id = (SELECT internal_album_id FROM distribution_releases WHERE id = ?)`,
    [total[0].d, total[0].c, releaseId]
  );
  console.log(`\n${uploaded} objects uploaded · ${shipped} masters flagged to ship · ${failed} failed`);
  console.log(`Album totals: ${total[0].c} tracks, ${Math.floor(total[0].d / 60)}:${String(total[0].d % 60).padStart(2, '0')}`);
}
