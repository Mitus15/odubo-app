/**
 * Apply migration 146 (loop_settings) to the remote D1 via the HTTP client.
 *
 *   tsx --env-file=.env.local scripts/loop/apply_146_loop_settings.ts
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS).
 */
import { executeQuery, queryDatabase } from "../../src/lib/loop/db";

async function main() {
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS loop_settings (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL,
       updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );
  const rows = await queryDatabase<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='loop_settings'`,
  );
  console.log(rows.length === 1 ? "✓ loop_settings ensured" : "✗ table missing!");
}

main().catch((e) => {
  console.error("Migration 146 failed:", e);
  process.exit(1);
});
