/**
 * Apply migration 147 (attendee identity) to the remote D1.
 *
 *   tsx --env-file=.env.local scripts/loop/apply_147_loop_identity.ts
 *
 * Idempotent (CREATE TABLE/INDEX IF NOT EXISTS). Statements run one at a time
 * because the D1 HTTP client takes a single statement per request.
 */
import { executeQuery, queryDatabase } from "../../src/lib/loop/db";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS loop_attendees (
     id TEXT PRIMARY KEY,
     display_name TEXT,
     email TEXT,
     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     last_seen_at TEXT
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_loop_attendees_email
     ON loop_attendees(email) WHERE email IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS loop_attendee_devices (
     voter_id TEXT PRIMARY KEY,
     attendee_id TEXT NOT NULL,
     bound_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_loop_devices_attendee
     ON loop_attendee_devices(attendee_id)`,
  `CREATE TABLE IF NOT EXISTS loop_attendance (
     event_id TEXT NOT NULL,
     attendee_id TEXT NOT NULL,
     code TEXT,
     first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (event_id, attendee_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_loop_attendance_attendee
     ON loop_attendance(attendee_id)`,
  `CREATE TABLE IF NOT EXISTS loop_media_credits (
     photo_uid TEXT PRIMARY KEY,
     attendee_id TEXT NOT NULL,
     event_id TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_loop_credits_attendee
     ON loop_media_credits(attendee_id, event_id)`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await executeQuery(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 64));
  }
  const tables = await queryDatabase<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'loop_%' ORDER BY name`,
  );
  console.log("loop tables:", tables.map((t) => t.name).join(", "));
}

main().catch((e) => {
  console.error("Migration 147 failed:", e);
  process.exit(1);
});
