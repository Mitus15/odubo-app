/**
 * The featured product: the one piece the /links landing puts first.
 *
 * One Shopify handle, kept in `site_settings` under `featured_product` and
 * chosen in /admin/linktree. It changes with the release (the piece worn in
 * the current video), so it is a setting, not code. No handle, or a product
 * Shopify no longer returns, and the landing simply shows no product.
 */

import { queryDatabase } from '@/lib/db';
import { getShopifyProduct } from '@/lib/shopify';

export const FEATURED_PRODUCT_KEY = 'featured_product';

export interface FeaturedProduct {
  handle: string;
  title: string;
  image: string | null;
  price: number;
  currency: string;
  available: boolean;
}

export async function getFeaturedHandle(): Promise<string | null> {
  try {
    const rows = (await queryDatabase(`SELECT value FROM site_settings WHERE key = ?`, [FEATURED_PRODUCT_KEY])) as
      | { value: string }[]
      | null;
    const handle = rows?.[0]?.value?.trim();
    return handle || null;
  } catch {
    return null;
  }
}

export async function setFeaturedHandle(handle: string | null): Promise<void> {
  if (!handle) {
    await queryDatabase(`DELETE FROM site_settings WHERE key = ?`, [FEATURED_PRODUCT_KEY]);
    return;
  }
  await queryDatabase(
    `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [FEATURED_PRODUCT_KEY, handle],
  );
}

/** The featured product as the landing shows it, priced for the visitor's country. */
export async function getFeaturedProduct(country?: string): Promise<FeaturedProduct | null> {
  const handle = await getFeaturedHandle();
  if (!handle) return null;
  const res = await getShopifyProduct(handle, country);
  if (!res.success || !res.product) return null;
  const p = res.product;
  const variants = (p.variants || []) as { currency?: string; available?: boolean }[];
  return {
    handle: p.handle,
    title: p.title,
    image: p.images?.[0] ?? null,
    price: p.price,
    currency: variants[0]?.currency || 'CAD',
    available: variants.some((v) => v.available !== false),
  };
}
