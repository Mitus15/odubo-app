/**
 * Apply migration 151 (loop_notes — the promoter thread) to the remote D1.
 *
 *   tsx --env-file=.env.local scripts/loop/apply_151_loop_notes.ts
 *
 * Idempotent: the table is CREATE IF NOT EXISTS, and we check PRAGMA first so
 * a re-run reports "nothing to do" instead of silently re-executing.
 */
import { executeQuery, queryDatabase } from "../../src/lib/loop/db";

async function tableExists(): Promise<boolean> {
  const cols = await queryDatabase<{ name: string }>(`PRAGMA table_info(loop_notes)`);
  return cols.length > 0;
}

async function main() {
  if (await tableExists()) {
    console.log("loop_notes already exists — nothing to do");
    return;
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS loop_notes (
       id         TEXT PRIMARY KEY,
       author     TEXT NOT NULL DEFAULT '',
       topic      TEXT NOT NULL DEFAULT '',
       body       TEXT NOT NULL,
       created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE INDEX IF NOT EXISTS idx_loop_notes_created ON loop_notes(created_at)`,
  ];

  for (const sql of statements) {
    await executeQuery(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 62));
  }

  if (!(await tableExists())) throw new Error("loop_notes missing after CREATE");
  console.log("loop_notes ready");
}

main().catch((e) => {
  console.error("Migration 151 failed:", e);
  process.exit(1);
});
