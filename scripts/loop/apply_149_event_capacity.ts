/**
 * Apply migration 149 (event capacity override) to the remote D1.
 *
 *   tsx --env-file=.env.local scripts/loop/apply_149_event_capacity.ts
 *
 * Idempotent, unlike the raw .sql: SQLite's ADD COLUMN throws "duplicate column
 * name" on a second run, so this checks PRAGMA table_info first and no-ops if
 * the column is already there.
 */
import { executeQuery, queryDatabase } from "../../src/lib/loop/db";

async function hasCapacityColumn(): Promise<boolean> {
  const cols = await queryDatabase<{ name: string }>(`PRAGMA table_info(event_overrides)`);
  return cols.some((c) => c.name === "capacity");
}

async function main() {
  if (await hasCapacityColumn()) {
    console.log("event_overrides.capacity already exists — nothing to do");
    return;
  }

  await executeQuery(`ALTER TABLE event_overrides ADD COLUMN capacity INTEGER`);
  console.log("✓ ALTER TABLE event_overrides ADD COLUMN capacity");

  if (!(await hasCapacityColumn())) throw new Error("column missing after ALTER");
  console.log("event_overrides.capacity ready");
}

main().catch((e) => {
  console.error("Migration 149 failed:", e);
  process.exit(1);
});
