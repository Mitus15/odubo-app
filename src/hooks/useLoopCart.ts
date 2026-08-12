'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { CartItem, Cart } from '@/lib/store/types';

/**
 * Loop Soul's own bag.
 *
 * Deliberately NOT `useCart` (`odubo_cart`). The two storefronts share one
 * origin and one Shopify store, so a single localStorage key would put Loop
 * pieces and odubo merch in the same bag and the same checkout — two brands in
 * one transaction, and an odubo shopper finding Loop items in a bag they never
 * opened. A separate key keeps each bag to its own store.
 *
 * Also intentionally simpler than useCart: no cross-device server sync, no
 * visitor-id round trip. Loop merch is a small curated drop per volume and the
 * checkout is a redirect to Shopify — the bag's job is to survive a refresh,
 * not to follow someone between devices.
 */
const LOOP_CART_KEY = 'loop_soul_cart';

export function useLoopCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load once on mount. A corrupt payload is discarded rather than thrown — a
  // broken bag must never take the storefront down with it.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOOP_CART_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      localStorage.removeItem(LOOP_CART_KEY);
    }
    setIsHydrated(true);
  }, []);

  // Persist only after hydration, so the initial empty state can't clobber a
  // stored bag before it has been read.
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(LOOP_CART_KEY, JSON.stringify(items));
    } catch {
      /* quota or private mode — the bag stays in memory for this session */
    }
  }, [items, isHydrated]);

  // Keep tabs in step; a bag edited in one tab shouldn't be stale in another.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LOOP_CART_KEY) return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(parsed)) setItems(parsed);
      } catch {
        /* ignore a bad write from another tab */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const at = prev.findIndex((i) => i.variantId === item.variantId);
      if (at === -1) return [...prev, item];
      const next = [...prev];
      next[at] = { ...next[at], quantity: next[at].quantity + item.quantity };
      return next;
    });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.variantId !== variantId)
        : prev.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
    );
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const cart: Cart = useMemo(
    () => ({
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((n, i) => n + i.price * i.quantity, 0),
      // Every line comes from one Shopify store in one @inContext currency, so
      // the first item's currency describes the whole bag.
      currency: items[0]?.currency ?? 'CAD',
    }),
    [items],
  );

  return { cart, isHydrated, addItem, setQuantity, removeItem, clear };
}

export default useLoopCart;
