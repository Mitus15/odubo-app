/**
 * Assert, in data, that Loop Soul is an album and that everything else hangs
 * off it.
 *
 *   npx tsx --env-file=.env.local scripts/loop/assert_album_identity.ts [--dry]
 *
 * Two things happen here.
 *
 * 1. The record gets its right credit. The album was seeded as "Mitus"; the
 *    artist is Mani Odubo. This matters beyond tidiness — the Release floor
 *    renders `artist_name ?? 'Unknown artist'`, so the wrong name is on screen
 *    wherever the release is worked on.
 *
 * 2. `release_links` finally gets rows. Migration 155 built that table with
 *    `albums.id` as the spine and `loop-event`, `journal-issue`, `poster-kit`
 *    and `shopify-product` among its kinds — the schema already modelled the
 *    album owning the event, the magazine, the artwork and the store product.
 *    Nobody had ever written a row, so the claim existed only in the DDL.
 *
 * Deliberately NOT under scripts/release/: that directory belongs to the
 * Release Control branch and does not exist here. This script only touches
 * production D1, where migrations 153-155 are already applied, so it runs
 * from either branch.
 *
 * Idempotent: re-running changes nothing.
 */
import { queryDatabase, executeQuery } from "../../src/lib/loop/db";

const ALBUM_ID = "724666e5-66a8-4229-99ee-d5450076b749";
const ARTIST = "Mani Odubo";

/** Everything the album owns. `ref_id` is a soft reference by design — release
 *  links point outward at subsystems and never the reverse. */
const LINKS: { kind: string; ref_id: string; label: string }[] = [
  { kind: "loop-event", ref_id: "vol-1", label: "Volume 1 — the first play" },
  { kind: "shopify-product", ref_id: "9530389397717", label: "Loop Soul — Volume 1 Pass" },
  { kind: "journal-issue", ref_id: "vol-1", label: "The Loop Journal — Volume 1" },
  { kind: "poster-kit", ref_id: "loop-soul-v1", label: "Volume 1 marketing kit" },
];

const dry = process.argv.includes("--dry");

async function main() {
  const album = await queryDatabase<{ id: string; title: string; artist_name: string | null }>(
    `SELECT id, title, artist_name FROM albums WHERE id = ?1`,
    [ALBUM_ID],
  );
  if (album.length === 0) throw new Error(`No album ${ALBUM_ID} — refusing to invent one.`);
  console.log(`album: "${album[0].title}" — currently credited to ${album[0].artist_name ?? "(none)"}`);

  if (album[0].artist_name !== ARTIST) {
    console.log(`  ${dry ? "would set" : "setting"} artist_name → ${ARTIST}`);
    if (!dry) {
      await executeQuery(
        `UPDATE albums SET artist_name = ?1, updated_at = ?2 WHERE id = ?3`,
        [ARTIST, new Date().toISOString(), ALBUM_ID],
      );
    }
  } else {
    console.log("  artist_name already correct");
  }

  const existing = await queryDatabase<{ kind: string; ref_id: string }>(
    `SELECT kind, ref_id FROM release_links WHERE album_id = ?1`,
    [ALBUM_ID],
  );
  const have = new Set(existing.map((r) => `${r.kind}:${r.ref_id}`));

  for (const l of LINKS) {
    const key = `${l.kind}:${l.ref_id}`;
    if (have.has(key)) {
      console.log(`  link ${key} — already there`);
      continue;
    }
    console.log(`  ${dry ? "would link" : "linking"} ${key} (${l.label})`);
    if (dry) continue;
    // The unique index on (album_id, kind, ref_id) makes this safe to re-run
    // even if two copies race.
    await executeQuery(
      `INSERT OR IGNORE INTO release_links (id, album_id, kind, ref_id, label, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      [`${ALBUM_ID}:${key}`, ALBUM_ID, l.kind, l.ref_id, l.label, new Date().toISOString()],
    );
  }

  const after = await queryDatabase<{ n: number }>(
    `SELECT COUNT(*) AS n FROM release_links WHERE album_id = ?1`,
    [ALBUM_ID],
  );
  console.log(`release_links for this album: ${after[0]?.n ?? 0}${dry ? " (dry run — nothing written)" : ""}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
