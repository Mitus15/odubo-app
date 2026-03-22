// ============================================================================
// clothingSlots.ts — Maps Shopify products to character clothing slots
//
// Fetches products from /api/products, categorizes by productType,
// and provides random selection per slot for the Catching Light game.
// ============================================================================

import type { ClothingSlot, TopVariant } from '@/types/game';

/** Minimal product info needed for the game */
export interface SlotProduct {
  handle: string;
  title: string;
  price: number;
  image: string | null;
}

/** Product pools organized by clothing slot */
interface SlotPools {
  top: { product: SlotProduct; variant: TopVariant }[];
  bottom: SlotProduct[];
  layer: SlotProduct[];
}

/** Category matching patterns */
const SLOT_PATTERNS: Record<ClothingSlot, RegExp> = {
  top: /t-shirt|tee|hoodie|sweatshirt|shirt|top/i,
  bottom: /jeans|pants|trousers|shorts|bottom/i,
  layer: /vest|jacket|coat|cardigan|layer/i,
};

/** Detect if a top product is a hoodie variant */
const HOODIE_PATTERN = /hoodie|sweatshirt|pullover/i;

let cachedPools: SlotPools | null = null;

/**
 * Fetch and categorize products into clothing slots.
 * Results are cached for the session.
 */
export async function loadClothingSlots(): Promise<SlotPools> {
  if (cachedPools) return cachedPools;

  try {
    const res = await fetch('/api/products');
    const data = (await res.json()) as {
      success: boolean;
      products?: Array<{
        handle: string;
        title: string;
        category: string;
        price: number;
        images: string[];
      }>;
    };

    if (!data.success || !data.products) {
      cachedPools = { top: [], bottom: [], layer: [] };
      return cachedPools;
    }

    const pools: SlotPools = { top: [], bottom: [], layer: [] };

    for (const p of data.products) {
      const category: string = p.category || '';
      const title: string = p.title || '';
      const combined = `${category} ${title}`;

      const product: SlotProduct = {
        handle: p.handle,
        title: p.title,
        price: p.price,
        image: p.images?.[0] || null,
      };

      if (SLOT_PATTERNS.layer.test(combined)) {
        pools.layer.push(product);
      } else if (SLOT_PATTERNS.bottom.test(combined)) {
        pools.bottom.push(product);
      } else if (SLOT_PATTERNS.top.test(combined)) {
        const variant: TopVariant = HOODIE_PATTERN.test(combined) ? 'hoodie' : 'tee';
        pools.top.push({ product, variant });
      }
    }

    cachedPools = pools;
    return pools;
  } catch {
    cachedPools = { top: [], bottom: [], layer: [] };
    return cachedPools;
  }
}

/**
 * Pick a random product from a slot's pool.
 * Returns null if the pool is empty.
 */
export function getRandomProduct(
  pools: SlotPools,
  slot: ClothingSlot,
): { product: SlotProduct; variant?: TopVariant } | null {
  if (slot === 'top') {
    const pool = pools.top;
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const pool = pools[slot];
  if (pool.length === 0) return null;
  const product = pool[Math.floor(Math.random() * pool.length)];
  return { product };
}

/**
 * Determine the next unfilled clothing slot in order: top → bottom → layer.
 * Returns null if all slots are filled.
 */
export function getNextSlot(clothing: {
  top: unknown | null;
  bottom: unknown | null;
  layer: unknown | null;
  accessory: boolean;
}): ClothingSlot | 'accessory' | null {
  if (!clothing.top) return 'top';
  if (!clothing.bottom) return 'bottom';
  if (!clothing.layer) return 'layer';
  if (!clothing.accessory) return 'accessory';
  return null; // Fully dressed — bonus points from here
}

/**
 * Clear the cached product pools (e.g., on game restart).
 */
export function clearClothingCache(): void {
  cachedPools = null;
}
