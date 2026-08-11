/**
 * Apply migration 145 (gallery curation) to the remote D1 via the HTTP client.
 *
 *   tsx --env-file=.env.local scripts/loop/apply_145_gallery_curation.ts
 *
 * Exists because wrangler can't auth non-interactively in this environment
 * (same reason 144 went in through src/lib/loop/db.ts). Idempotent: checks
 * pragma_table_info before each ALTER.
 */
import { queryDatabase, executeQuery } from "../../src/lib/loop/db";

async function main() {
  const cols = await queryDatabase<{ name: string }>(
    `SELECT name FROM pragma_table_info('gallery_photos')`,
  );
  const names = new Set(cols.map((c) => c.name));
  console.log(`gallery_photos has ${names.size} columns`);

  const adds: Array<[string, string]> = [
    ["moderated_at", `ALTER TABLE gallery_photos ADD COLUMN moderated_at TEXT`],
    ["moderated_by", `ALTER TABLE gallery_photos ADD COLUMN moderated_by TEXT`],
    ["featured", `ALTER TABLE gallery_photos ADD COLUMN featured INTEGER NOT NULL DEFAULT 0`],
  ];

  for (const [col, sql] of adds) {
    if (names.has(col)) {
      console.log(`✓ ${col} already exists — skipping`);
    } else {
      await executeQuery(sql);
      console.log(`+ added ${col}`);
    }
  }

  await executeQuery(
    `CREATE INDEX IF NOT EXISTS idx_gallery_photos_featured ON gallery_photos(gallery_id, featured)`,
  );
  console.log(`✓ idx_gallery_photos_featured ensured`);

  const after = await queryDatabase<{ name: string }>(
    `SELECT name FROM pragma_table_info('gallery_photos')`,
  );
  console.log(`done — columns now: ${after.map((c) => c.name).join(", ")}`);
}

main().catch((e) => {
  console.error("Migration 145 failed:", e);
  process.exit(1);
});
