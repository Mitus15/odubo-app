/**
 * Apply migration 148 (Danceyokey) to the remote D1.
 *
 *   tsx --env-file=.env.local scripts/loop/apply_148_danceyokey.ts
 *
 * Idempotent. One statement per request (D1 HTTP client).
 */
import { executeQuery, queryDatabase } from "../../src/lib/loop/db";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS danceyokey_signups (
     id TEXT PRIMARY KEY,
     event_id TEXT NOT NULL,
     attendee_id TEXT,
     performers TEXT NOT NULL,
     song_title TEXT,
     song_artist TEXT,
     note TEXT,
     status TEXT NOT NULL DEFAULT 'waiting',
     position INTEGER,
     source TEXT NOT NULL DEFAULT 'in-room',
     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_danceyokey_event
     ON danceyokey_signups(event_id, status, position)`,
  `CREATE INDEX IF NOT EXISTS idx_danceyokey_attendee
     ON danceyokey_signups(event_id, attendee_id)`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await executeQuery(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 60));
  }
  const t = await queryDatabase<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='danceyokey_signups'`,
  );
  console.log(t.length === 1 ? "danceyokey_signups ready" : "MISSING");
}

main().catch((e) => {
  console.error("Migration 148 failed:", e);
  process.exit(1);
});
