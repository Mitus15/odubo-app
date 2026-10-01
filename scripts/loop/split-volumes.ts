/**
 * Split Loop Soul into two albums in the live database: Loop Soul Vol. 1
 * (songs 1 to 9) and Loop Soul Vol. 2 (songs 10 to 14).
 *
 *   npx tsx --env-file=.env.local scripts/loop/split-volumes.ts                 # dry run: what would change
 *   npx tsx --env-file=.env.local scripts/loop/split-volumes.ts --apply --code-is-live
 *
 * Decided by the owner 2026-09-30; the plan is docs/decisions/loop-vinyl.md.
 *
 * THE CODE GOES LIVE FIRST. Until the per-album release switch and audio gate
 * are deployed, moving songs 10 to 14 would let the old early-track rules deal
 * Vol. 2's songs (The Mind Pt 1 would become a "free" track). So --apply
 * refuses without --code-is-live, which you pass only once that code is on
 * production.
 *
 * The album that exists becomes Vol. 1 (same id, so every link, the singles,
 * the passes and the warehouse keep pointing at it). Songs 10 to 14 MOVE to
 * Vol. 2 with their own ids, numbered 1 to 5 there; nothing is copied. Each
 * step checks the state first, so a second run changes nothing.
 *
 * What it does, in order:
 *   1. the albums: rename to Loop Soul Vol. 1, create Loop Soul Vol. 2 (the id
 *      in songs.json), clear the stale 2026-10-03 date, recount tracks
 *   2. the tracks: move songs 10 to 14 to Vol. 2, numbered 1 to 5
 *   3. the delivery sheet: rename Vol. 1's draft, create Vol. 2's, move songs
 *      10 to 14's rows (their ISRCs are issued once: moved, never re-made).
 *      Vol. 2 gets no barcode: it needs its own from the distributor
 *   4. the warehouse: a Vol. 2 project, with those songs' pieces, files and docs
 *   5. the passes: a pass is the whole record, so each one is owed Vol. 2 too
 *   6. the Oct 10 night's release links lose their "Volume 1" labels, so
 *      "Vol. 1" only ever means the record
 */
import { executeQuery, queryDatabase, queryOne } from "../../src/lib/loop/db";
import { ALBUM_ID as VOL_1, albumOfVolume, songsOf, trackNumber } from "../../src/lib/loop/songs";

const APPLY = process.argv.includes("--apply");
const CODE_LIVE = process.argv.includes("--code-is-live");
const VOL_2 = albumOfVolume(2).albumId;
const now = () => new Date().toISOString();
const hexId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

const NIGHT_LABELS: Record<string, string> = {
  [`${VOL_1}:loop-event:vol-1`]: "The Oct 10 night (called off)",
  [`${VOL_1}:shopify-product:9530389397717`]: "The night's pass (archived)",
  [`${VOL_1}:journal-issue:vol-1`]: "The Loop Journal, the night's issue",
  [`${VOL_1}:poster-kit:loop-soul-v1`]: "The night's marketing kit",
};

let changes = 0;
async function step(what: string, sql: string, params: (string | number | null)[] = []) {
  changes++;
  console.log(`  ${APPLY ? "doing" : "would"}: ${what}`);
  if (APPLY) await executeQuery(sql, params);
}

type AlbumRow = Record<string, string | number | null>;

async function main() {
  if (APPLY && !CODE_LIVE) {
    throw new Error("Deploy the per-album release and audio gate first, then rerun with --apply --code-is-live.");
  }
  console.log(APPLY ? "APPLY: splitting Loop Soul into Vol. 1 and Vol. 2" : "DRY RUN (nothing is written)");

  const vol1 = await queryOne<AlbumRow>(`SELECT * FROM albums WHERE id = ?1`, [VOL_1]);
  if (!vol1) throw new Error(`No album ${VOL_1}: refusing to invent one.`);
  const moving = songsOf(2);
  const movingIds = moving.map((s) => s.trackId);
  const tracks = await queryDatabase<{ id: string; album_id: string; track_number: number; title: string; duration: number | null }>(
    `SELECT id, album_id, track_number, title, duration FROM tracks WHERE album_id IN (?1, ?2) ORDER BY album_id, track_number`,
    [VOL_1, VOL_2],
  );
  for (const s of moving) {
    const t = tracks.find((x) => x.id === s.trackId);
    if (!t) throw new Error(`${s.title} (${s.trackId}) is on neither album: stopping before anything moves.`);
    if (t.title !== s.title) throw new Error(`track ${s.trackId} is "${t.title}", songs.json says "${s.title}"`);
  }
  const seconds = (ids: string[]) => tracks.filter((t) => ids.includes(t.id)).reduce((n, t) => n + (t.duration ?? 0), 0);
  const stayingIds = tracks.filter((t) => !movingIds.includes(t.id)).map((t) => t.id);

  console.log("\n1. the albums");
  if (vol1.title !== albumOfVolume(1).title || vol1.release_date !== null || vol1.total_tracks !== stayingIds.length) {
    await step(
      `"${vol1.title}" becomes "${albumOfVolume(1).title}", ${stayingIds.length} tracks, no release date yet`,
      `UPDATE albums SET title = ?1, release_date = NULL, total_tracks = ?2, total_duration = ?3, updated_at = ?4 WHERE id = ?5`,
      [albumOfVolume(1).title, stayingIds.length, seconds(stayingIds), now(), VOL_1],
    );
  }
  const vol2 = await queryOne<AlbumRow>(`SELECT id FROM albums WHERE id = ?1`, [VOL_2]);
  if (!vol2) {
    await step(
      `create "${albumOfVolume(2).title}" (${VOL_2}), a draft, ${moving.length} tracks, no cover or date yet`,
      `INSERT INTO albums (id, title, artist_name, release_type, release_date, record_label, genre, subgenre,
                           cover_art_url, cover_art_key, total_tracks, total_duration, explicit_content, featured,
                           description, created_at, updated_at, status)
       VALUES (?1, ?2, ?3, 'album', NULL, ?4, ?5, ?6, NULL, NULL, ?7, ?8, ?9, 0, NULL, ?10, ?10, 'draft')`,
      [VOL_2, albumOfVolume(2).title, vol1.artist_name, vol1.record_label, vol1.genre, vol1.subgenre,
       moving.length, seconds(movingIds), vol1.explicit_content ?? 0, now()],
    );
  }

  console.log("\n2. the tracks");
  for (const s of moving) {
    const t = tracks.find((x) => x.id === s.trackId)!;
    const n = trackNumber(s);
    if (t.album_id === VOL_2 && t.track_number === n) continue;
    await step(
      `${s.title}: track ${t.track_number} of Vol. 1 becomes track ${n} of Vol. 2`,
      `UPDATE tracks SET album_id = ?1, track_number = ?2, updated_at = ?3 WHERE id = ?4`,
      [VOL_2, n, now(), s.trackId],
    );
  }

  console.log("\n3. the delivery sheet");
  const rel1 = await queryOne<AlbumRow>(`SELECT * FROM distribution_releases WHERE internal_album_id = ?1`, [VOL_1]);
  if (rel1 && (rel1.title !== albumOfVolume(1).title || rel1.distribution_release_date !== null)) {
    await step(
      `the draft "${rel1.title}" becomes "${albumOfVolume(1).title}", no release date yet`,
      `UPDATE distribution_releases SET title = ?1, distribution_release_date = NULL, updated_at = ?2 WHERE id = ?3`,
      [albumOfVolume(1).title, now(), rel1.id as string],
    );
  }
  let rel2 = await queryOne<{ id: string }>(`SELECT id FROM distribution_releases WHERE internal_album_id = ?1`, [VOL_2]);
  const rel2Id = rel2?.id ?? hexId();
  if (!rel2) {
    await step(
      `create the draft "${albumOfVolume(2).title}" (no barcode: Vol. 2 needs its own from the distributor)`,
      `INSERT INTO distribution_releases (id, title, release_type, artist_name, label_name, distributor, status,
                                          territories, explicit_content, genre, subgenre, language, internal_album_id,
                                          created_at, updated_at)
       VALUES (?1, ?2, 'album', ?3, ?4, ?5, 'draft', ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)`,
      [rel2Id, albumOfVolume(2).title, (rel1?.artist_name as string) ?? (vol1.artist_name as string),
       (rel1?.label_name as string) ?? null, (rel1?.distributor as string) ?? "undecided",
       (rel1?.territories as string) ?? '["worldwide"]', (rel1?.explicit_content as number) ?? 0,
       (rel1?.genre as string) ?? null, (rel1?.subgenre as string) ?? null, (rel1?.language as string) ?? "en", VOL_2, now()],
    );
    rel2 = { id: rel2Id };
  }
  const sheet = await queryDatabase<{ id: string; release_id: string; track_number: number; title: string; internal_track_id: string | null }>(
    `SELECT id, release_id, track_number, title, internal_track_id FROM distribution_release_tracks
      WHERE internal_track_id IN (${movingIds.map((_, i) => `?${i + 1}`).join(", ")})`,
    movingIds,
  );
  for (const s of moving) {
    const row = sheet.find((r) => r.internal_track_id === s.trackId);
    if (!row) continue;
    const n = trackNumber(s);
    if (row.release_id === rel2Id && row.track_number === n) continue;
    await step(
      `${s.title}'s delivery row moves to Vol. 2's draft as track ${n} (ISRC kept)`,
      `UPDATE distribution_release_tracks SET release_id = ?1, track_number = ?2, updated_at = ?3 WHERE id = ?4`,
      [rel2Id, n, now(), row.id],
    );
  }

  console.log("\n4. the warehouse");
  const proj1 = await queryOne<{ id: string; title: string }>(`SELECT id, title FROM warehouse_projects WHERE album_id = ?1`, [VOL_1]);
  if (proj1 && proj1.title !== albumOfVolume(1).title) {
    await step(`the project "${proj1.title}" becomes "${albumOfVolume(1).title}"`,
      `UPDATE warehouse_projects SET title = ?1, updated_at = ?2 WHERE id = ?3`, [albumOfVolume(1).title, now(), proj1.id]);
  }
  if (proj1) {
    const proj2 = await queryOne<{ id: string }>(`SELECT id FROM warehouse_projects WHERE album_id = ?1`, [VOL_2]);
    const proj2Id = proj2?.id ?? crypto.randomUUID();
    if (!proj2) {
      await step(`create the project "${albumOfVolume(2).title}"`,
        `INSERT INTO warehouse_projects (id, type, title, status, album_id, created_at, updated_at)
         VALUES (?1, 'album', ?2, 'active', ?3, ?4, ?4)`, [proj2Id, albumOfVolume(2).title, VOL_2, now()]);
    }
    const marks = movingIds.map((_, i) => `?${i + 2}`).join(", ");
    const pieces = await queryDatabase<{ id: string; title: string }>(
      `SELECT id, title FROM warehouse_pieces WHERE project_id = ?1 AND track_id IN (${marks})`, [proj1.id, ...movingIds]);
    for (const p of pieces) {
      await step(`the piece "${p.title}" and its files move to Vol. 2's project`,
        `UPDATE warehouse_pieces SET project_id = ?1, updated_at = ?2 WHERE id = ?3`, [proj2Id, now(), p.id]);
      await step(`  (its files)`, `UPDATE warehouse_files SET project_id = ?1 WHERE piece_id = ?2`, [proj2Id, p.id]);
    }
    const docs = await queryDatabase<{ id: string; title: string }>(
      `SELECT id, title FROM warehouse_docs WHERE project_id = ?1 AND track_id IN (${marks})`, [proj1.id, ...movingIds]);
    for (const d of docs) {
      await step(`the doc "${d.title}" moves to Vol. 2's project`,
        `UPDATE warehouse_docs SET project_id = ?1, updated_at = ?2 WHERE id = ?3`, [proj2Id, now(), d.id]);
    }
  }

  console.log("\n5. the passes");
  const owed = await queryDatabase<{ email: string; source: string; order_id: string | null; event_id: string | null }>(
    `SELECT e.email, e.source, e.order_id, e.event_id FROM loop_album_entitlements e
      WHERE e.album_id = ?1 AND e.source = 'pass'
        AND NOT EXISTS (SELECT 1 FROM loop_album_entitlements x WHERE x.album_id = ?2 AND x.order_id = e.order_id)`,
    [VOL_1, VOL_2],
  );
  for (const o of owed) {
    await step(`${o.email} (${o.order_id}) is owed Vol. 2 too`,
      `INSERT OR IGNORE INTO loop_album_entitlements (id, album_id, email, source, order_id, event_id, granted_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      [`ent_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`, VOL_2, o.email, o.source, o.order_id, o.event_id, now()]);
  }

  console.log("\n6. the night's labels");
  const links = await queryDatabase<{ id: string; label: string }>(`SELECT id, label FROM release_links WHERE album_id = ?1`, [VOL_1]);
  for (const l of links) {
    const label = NIGHT_LABELS[l.id];
    if (label && l.label !== label) {
      await step(`"${l.label}" becomes "${label}"`, `UPDATE release_links SET label = ?1 WHERE id = ?2`, [label, l.id]);
    }
  }

  console.log(`\n${changes === 0 ? "Already split: nothing to do." : `${changes} change${changes === 1 ? "" : "s"}${APPLY ? " made" : " planned"}.`}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
