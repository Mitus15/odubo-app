/**
 * Apply migration 158 (the fluid cover) to the remote D1.
 *
 *   tsx --env-file=.env.local scripts/loop/apply_158_cover_choices.ts
 *
 * Idempotent: CREATE IF NOT EXISTS throughout, and the ALTER is guarded by a
 * PRAGMA because SQLite has no ADD COLUMN IF NOT EXISTS and a re-run would
 * otherwise fail on "duplicate column name".
 */
import { executeQuery, queryDatabase } from "../../src/lib/loop/db";

async function hasTable(table: string): Promise<boolean> {
  const cols = await queryDatabase<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.length > 0;
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  const cols = await queryDatabase<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.some((c) => c.name === column);
}

async function main() {
  if (!(await hasTable("loop_cover_choices"))) {
    await executeQuery(
      `CREATE TABLE IF NOT EXISTS loop_cover_choices (
         attendee_id TEXT NOT NULL,
         event_id    TEXT NOT NULL,
         photo_uid   TEXT NOT NULL,
         chosen_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (attendee_id, event_id)
       )`,
    );
    console.log("✓ loop_cover_choices");
  } else {
    console.log("· loop_cover_choices already exists");
  }
  await executeQuery(
    `CREATE INDEX IF NOT EXISTS idx_loop_cover_choices_uid ON loop_cover_choices(photo_uid)`,
  );

  if (!(await hasColumn("loop_gift_codes", "attendee_id"))) {
    await executeQuery(`ALTER TABLE loop_gift_codes ADD COLUMN attendee_id TEXT`);
    console.log("✓ loop_gift_codes.attendee_id");
  } else {
    console.log("· loop_gift_codes.attendee_id already exists");
  }
  await executeQuery(
    `CREATE INDEX IF NOT EXISTS idx_loop_gift_codes_attendee ON loop_gift_codes(attendee_id)`,
  );

  if (!(await hasTable("loop_cover_choices")) || !(await hasColumn("loop_gift_codes", "attendee_id"))) {
    throw new Error("158 did not take");
  }
  console.log("158 ready");
}

main().catch((e) => {
  console.error("Migration 158 failed:", e);
  process.exit(1);
});
