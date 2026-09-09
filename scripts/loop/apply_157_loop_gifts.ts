/**
 * Apply migration 157 (the gift chain) to the remote D1.
 *
 *   tsx --env-file=.env.local scripts/loop/apply_157_loop_gifts.ts
 *
 * Idempotent: CREATE IF NOT EXISTS throughout, and PRAGMA is checked first so
 * a re-run reports "nothing to do" rather than silently re-executing.
 */
import { executeQuery, queryDatabase } from "../../src/lib/loop/db";

async function has(table: string): Promise<boolean> {
  const cols = await queryDatabase<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.length > 0;
}

async function main() {
  if ((await has("loop_gift_codes")) && (await has("loop_gifts"))) {
    console.log("gift chain already exists — nothing to do");
    return;
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS loop_gift_codes (
       code       TEXT PRIMARY KEY,
       name       TEXT NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS loop_gifts (
       code       TEXT NOT NULL,
       visitor    TEXT NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (code, visitor)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_loop_gifts_code ON loop_gifts(code)`,
  ];

  for (const sql of statements) {
    await executeQuery(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 62));
  }

  if (!(await has("loop_gift_codes")) || !(await has("loop_gifts"))) {
    throw new Error("gift tables missing after CREATE");
  }
  console.log("gift chain ready");
}

main().catch((e) => {
  console.error("Migration 157 failed:", e);
  process.exit(1);
});
