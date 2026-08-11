import { queryDatabase, executeQuery } from "@/lib/loop/db";

/**
 * Pass-sales configuration — read from D1 (`loop_settings`, admin-editable at
 * /loop/admin) with env-var fallback, so the owner never touches Vercel to go
 * live. D1 wins when a key is present.
 */

export type PassSettings = {
  /** Where the Get Pass button sends buyers (Shopify checkout permalink). */
  checkoutUrl: string | null;
  /** Line items with this SKU count as passes. */
  sku: string | null;
  /** …or line items with this Shopify product id. */
  productId: string | null;
  /** Capacity source: mock env counters, or the D1 code ledger (Shopify). */
  mode: "mock" | "shopify";
};

const KEYS = ["pass_checkout_url", "pass_sku", "pass_product_id", "pass_mode"] as const;

export async function getPassSettings(): Promise<PassSettings> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await queryDatabase<{ key: string; value: string }>(
      `SELECT key, value FROM loop_settings WHERE key IN (?1, ?2, ?3, ?4)`,
      [...KEYS],
    );
  } catch {
    // Table not migrated yet — env fallback keeps everything working.
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const checkoutUrl =
    map.get("pass_checkout_url") ||
    process.env.NEXT_PUBLIC_LOOP_PASS_CHECKOUT_URL ||
    null;
  const sku = map.get("pass_sku") || process.env.LOOP_PASS_SKU || null;
  const productId = map.get("pass_product_id") || process.env.LOOP_PASS_PRODUCT_ID || null;
  const modeRaw = map.get("pass_mode") || process.env.PASS_MODE || "mock";

  return {
    checkoutUrl: checkoutUrl?.trim() || null,
    sku: sku?.trim() || null,
    productId: productId?.trim() || null,
    mode: modeRaw === "shopify" ? "shopify" : "mock",
  };
}

/** Upsert one setting; empty/null clears it (falls back to env). */
export async function setPassSetting(key: (typeof KEYS)[number], value: string | null): Promise<void> {
  const v = value?.trim() ?? "";
  if (v === "") {
    await executeQuery(`DELETE FROM loop_settings WHERE key = ?1`, [key]);
    return;
  }
  await executeQuery(
    `INSERT INTO loop_settings (key, value, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3`,
    [key, v, new Date().toISOString()],
  );
}

export const PASS_SETTING_KEYS = KEYS;
