/**
 * Products whose address changed. The old address forwards to the new one,
 * so a link shared before a rename keeps working.
 *
 * The drop script (scripts/shopify/loop-soul-drop.ts) moves the handle in
 * Shopify with `redirectNewHandle`, which forwards Shopify's own store; this
 * does the same for ours, which reads products by handle. Until the script
 * has moved a handle, the new address reads the product at its old one, so
 * the site and Shopify can change in either order.
 */
export const MOVED_PRODUCTS: Record<string, string> = {
  // 2026-10-26: the Faceless Hoodie is the Portrait Hoodie. The back is his
  // own face, not a mask (owner).
  'faceless-hoodie': 'portrait-hoodie',
};

/** Where an old address now lives, or null. */
export function movedTo(handle: string): string | null {
  return MOVED_PRODUCTS[handle] ?? null;
}

/** The address a new one came from, for reading a product Shopify has not moved yet. */
export function movedFrom(handle: string): string | null {
  return Object.entries(MOVED_PRODUCTS).find(([, to]) => to === handle)?.[0] ?? null;
}
