import { queryDatabase, executeQuery } from "./db";

/**
 * One generic reader/writer for `loop_settings`, the D1 key/value table the
 * owner edits from /loop/admin.
 *
 * It exists so facts that end up on PRINTED artwork — the destination URL, the
 * price — have exactly one source. A constant in a script and a value in the
 * database will eventually disagree, and when they do the disagreement is
 * discovered at the print shop.
 *
 * Import-free apart from the D1 client (itself import-free), so the Node
 * poster kit reads the same values the app does.
 */

export async function getSetting(key: string): Promise<string | null> {
  try {
    const rows = await queryDatabase<{ value: string }>(
      `SELECT value FROM loop_settings WHERE key = ?1`,
      [key],
    );
    return rows[0]?.value?.trim() || null;
  } catch {
    // Table not migrated yet — callers fall back or refuse.
    return null;
  }
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  const v = value?.trim() ?? "";
  if (!v) {
    await executeQuery(`DELETE FROM loop_settings WHERE key = ?1`, [key]);
    return;
  }
  await executeQuery(
    `INSERT INTO loop_settings (key, value, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3`,
    [key, v, new Date().toISOString()],
  );
}

export { priceLabel } from "./priceLabel";
