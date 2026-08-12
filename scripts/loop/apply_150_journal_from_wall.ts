/**
 * Apply migration 150 (Journal Iconic Moments ← the Wall) to the remote D1.
 *
 *   tsx --env-file=.env.local scripts/loop/apply_150_journal_from_wall.ts
 *
 * Idempotent: checks for the new column first and no-ops if the rebuild has
 * already run. One statement per request (D1 HTTP client).
 */
import { executeQuery, queryDatabase } from "../../src/lib/loop/db";

async function columns(table: string): Promise<string[]> {
  const rows = await queryDatabase<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.map((r) => r.name);
}

async function main() {
  const before = await columns("journal_moments");
  if (before.includes("photo_uid")) {
    console.log("journal_moments.photo_uid already exists — nothing to do");
    return;
  }
  console.log("current columns:", before.join(", ") || "(table missing)");

  const statements = [
    `CREATE TABLE IF NOT EXISTS journal_moments_v2 (
       event_id  TEXT NOT NULL,
       position  INTEGER NOT NULL,
       id        TEXT NOT NULL,
       photo_uid TEXT,
       image_url TEXT,
       caption   TEXT NOT NULL DEFAULT '',
       PRIMARY KEY (event_id, id)
     )`,
    `INSERT OR IGNORE INTO journal_moments_v2 (event_id, position, id, photo_uid, image_url, caption)
       SELECT event_id, position, id, NULL, image_url, caption FROM journal_moments`,
    `DROP TABLE journal_moments`,
    `ALTER TABLE journal_moments_v2 RENAME TO journal_moments`,
    `CREATE INDEX IF NOT EXISTS idx_journal_moments_photo ON journal_moments(photo_uid)`,
  ];

  for (const sql of statements) {
    await executeQuery(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 62));
  }

  const after = await columns("journal_moments");
  if (!after.includes("photo_uid")) throw new Error("photo_uid missing after rebuild");
  console.log("journal_moments ready:", after.join(", "));
}

main().catch((e) => {
  console.error("Migration 150 failed:", e);
  process.exit(1);
});
