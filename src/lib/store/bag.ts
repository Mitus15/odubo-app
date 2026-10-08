/**
 * The bag, in one place.
 *
 * Every surface that touches what a visitor is buying (the store grid's
 * product view, QuickShop from a clip, the product page, the bag page, the
 * cart overlay, the logo badge) reads and writes ONE localStorage key through
 * this module, via `useCart` (the StoreProvider's state). Until 2026-10-08 the
 * product page, QuickShop and /store/cart kept their own bag under `'cart'`
 * while the grid, its cart panel and the badge used `'odubo_cart'`: add from a
 * product page, tap "Back to Shop", and the bag looked empty.
 *
 * `readBag` also folds whatever a visitor still has under the old key into
 * the bag once (same variant: the quantities add) and removes it, so nobody's
 * bag is lost by the change.
 *
 * The checkout memory is here too: the Shopify cart id made at checkout, so a
 * visitor coming back after paying can have the bag emptied (useCart asks
 * Shopify whether that cart still exists; a completed one does not).
 */

import type { CartItem } from './types';

export const BAG_KEY = 'odubo_cart';
export const LEGACY_BAG_KEY = 'cart';
export const CHECKOUT_KEY = 'odubo_checkout_cart';

const storage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

const isItem = (x: unknown): x is CartItem =>
  !!x && typeof x === 'object' && typeof (x as CartItem).variantId === 'string' &&
  typeof (x as CartItem).quantity === 'number';

/** Parse the bag's own format; anything else is an empty bag. */
export function parseBag(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isItem) : [];
  } catch {
    return [];
  }
}

/**
 * The old key's format, as the product page and QuickShop wrote it:
 * `{ variantId, qty, title: "Product — Variant", price, currency?, image? }`
 * (the image a URL string, sometimes an object). Converted to bag items.
 */
export function parseLegacyBag(raw: string | null): CartItem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const items: CartItem[] = [];
  for (const x of parsed) {
    if (!x || typeof x !== 'object' || typeof x.variantId !== 'string') continue;
    const quantity = Number(x.quantity ?? x.qty) || 0;
    if (quantity <= 0) continue;
    const [title, variantTitle] = String(x.title ?? '').split(' — ');
    const image = typeof x.image === 'string' ? { url: x.image }
      : x.image && typeof x.image === 'object' && typeof x.image.url === 'string' ? { url: x.image.url, altText: x.image.altText }
      : null;
    items.push({
      variantId: x.variantId,
      productHandle: typeof x.productHandle === 'string' ? x.productHandle : '',
      title: (title || '').trim(),
      variantTitle: (x.variantTitle ?? variantTitle ?? '').trim(),
      price: Number(x.price) || 0,
      currency: typeof x.currency === 'string' ? x.currency : '',
      quantity,
      image,
    });
  }
  return items;
}

/** Two bags as one: the same variant adds its quantities; the first bag's order holds. */
export function mergeBags(a: CartItem[], b: CartItem[]): CartItem[] {
  const out = a.map((item) => ({ ...item }));
  for (const item of b) {
    const found = out.find((o) => o.variantId === item.variantId);
    if (found) found.quantity += item.quantity;
    else out.push({ ...item });
  }
  return out;
}

/** The bag from storage, the old key folded in once. */
export function readBag(): CartItem[] {
  const s = storage();
  if (!s) return [];
  let items = parseBag(s.getItem(BAG_KEY));
  const legacyRaw = s.getItem(LEGACY_BAG_KEY);
  if (legacyRaw !== null) {
    const legacy = parseLegacyBag(legacyRaw);
    if (legacy.length) {
      items = mergeBags(items, legacy);
      writeBag(items);
    }
    s.removeItem(LEGACY_BAG_KEY);
  }
  return items;
}

export function writeBag(items: CartItem[]): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(BAG_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save the bag:', error);
  }
}

// ---- The checkout memory

export function rememberCheckout(cartId: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(CHECKOUT_KEY, cartId);
  } catch {}
}

export function rememberedCheckout(): string | null {
  return storage()?.getItem(CHECKOUT_KEY) ?? null;
}

export function forgetCheckout(): void {
  storage()?.removeItem(CHECKOUT_KEY);
}
