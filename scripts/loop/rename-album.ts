/**
 * The album is Signs of Life (owner, 2026-10-03). Rename it in the data.
 *
 *   npx tsx --env-file=.env.local scripts/loop/rename-album.ts           (dry run)
 *   npx tsx --env-file=.env.local scripts/loop/rename-album.ts --apply
 *
 * It was Loop Soul, the same name as the night it was going to be played at.
 * The night was called off (2026-09-29) and Loop Soul is the night again, a
 * live series that may come back; the record has its own name now. The site
 * reads the album's title from D1 (a single says "from <title>"), so the
 * rename is these rows, not a constant:
 *
 *   albums                 the album itself
 *   distribution_releases  the delivery sheet's draft, what a distributor gets
 *   warehouse_projects     the album's project in the warehouse
 *   entities               the Loop Soul line said "Album, event, ..."
 *
 * Left as Loop Soul on purpose, because they are the night's: the pass
 * product and its release link, the run of show, the Wall's gallery, the
 * announcement drafts, the pass email's sender name, and order history (an
 * order is a record of what was bought, under the name it had).
 *
 * The album is pressed on two records, Loop Soul (songs 1 to 9) and Signs of
 * Life (songs 10 to 14); until the split (scripts/loop/split-volumes.ts on the
 * film branch) D1 holds one album with all fourteen, and that is the whole,
 * Signs of Life. The split names the records.
 *
 * Idempotent: each update only matches the old value, so a re-run changes
 * nothing.
 */
import { executeQuery, queryDatabase, type SqlParam } from "../../src/lib/loop/db";
import { ALBUM_NAME } from "../../src/lib/loop/albumName";

const APPLY = process.argv.includes("--apply");
const OLD = "Loop Soul";
const ALBUM_ID = "724666e5-66a8-4229-99ee-d5450076b749";
const LINE_BEFORE = "Project, run directly under the studio. Album, event, and the pilot ground for the studio's software.";
const LINE_AFTER = "Event series, run directly under the studio, and the pilot ground for the studio's software.";

type Change = { what: string; sql: string; params: SqlParam[] };

async function plan(): Promise<Change[]> {
  const changes: Change[] = [];
  const album = await queryDatabase<{ title: string }>(`SELECT title FROM albums WHERE id = ?1`, [ALBUM_ID]);
  if (!album.length) throw new Error(`album ${ALBUM_ID} is not in D1: stopping.`);
  if (album[0].title === OLD) {
    changes.push({
      what: `albums: "${OLD}" becomes "${ALBUM_NAME}"`,
      sql: `UPDATE albums SET title = ?1, updated_at = ?2 WHERE id = ?3 AND title = ?4`,
      params: [ALBUM_NAME, new Date().toISOString(), ALBUM_ID, OLD],
    });
  }
  const releases = await queryDatabase<{ id: string }>(
    `SELECT id FROM distribution_releases WHERE internal_album_id = ?1 AND title = ?2`,
    [ALBUM_ID, OLD],
  );
  for (const r of releases) {
    changes.push({
      what: `distribution_releases ${r.id}: the draft becomes "${ALBUM_NAME}"`,
      sql: `UPDATE distribution_releases SET title = ?1, updated_at = ?2 WHERE id = ?3 AND title = ?4`,
      params: [ALBUM_NAME, new Date().toISOString(), r.id, OLD],
    });
  }
  const projects = await queryDatabase<{ id: string }>(`SELECT id FROM warehouse_projects WHERE title = ?1`, [OLD]);
  for (const p of projects) {
    changes.push({
      what: `warehouse_projects ${p.id}: becomes "${ALBUM_NAME}"`,
      sql: `UPDATE warehouse_projects SET title = ?1 WHERE id = ?2 AND title = ?3`,
      params: [ALBUM_NAME, p.id, OLD],
    });
  }
  const line = await queryDatabase<{ description: string | null }>(`SELECT description FROM entities WHERE slug = 'loop-soul'`, []);
  if (line[0]?.description === LINE_BEFORE) {
    changes.push({
      what: `entities loop-soul: an event series, no longer the album`,
      sql: `UPDATE entities SET description = ?1 WHERE slug = 'loop-soul' AND description = ?2`,
      params: [LINE_AFTER, LINE_BEFORE],
    });
  }
  return changes;
}

async function main() {
  const changes = await plan();
  console.log(APPLY ? `APPLY: the album becomes ${ALBUM_NAME}` : "DRY RUN (pass --apply to write)");
  if (!changes.length) console.log("  nothing to change: already renamed");
  for (const c of changes) {
    console.log(`  ${c.what}`);
    if (!APPLY) continue;
    // At least one: D1 counts a trigger's writes too (albums has an
    // updated_at trigger, so its rename reports 2).
    const { changes: n } = await executeQuery(c.sql, c.params);
    if (n < 1) throw new Error(`nothing changed: stopping`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
