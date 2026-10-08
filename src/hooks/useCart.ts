'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { CartItem, Cart, ProductVariant, ProductImage } from '@/lib/store/types';
import { BAG_KEY, forgetCheckout, readBag, rememberedCheckout, writeBag } from '@/lib/store/bag';
import { cartExists } from '@/lib/store/api';

const CART_STORAGE_KEY = BAG_KEY;
const VISITOR_ID_KEY = 'odubo_visitor_id';
const SYNC_DEBOUNCE_MS = 500;

/**
 * useCart - Unified cart management hook
 * Single source of truth for cart state with localStorage persistence
 */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncRef = useRef<string>('');

  // ============================================
  // Visitor ID Management
  // ============================================

  useEffect(() => {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    setVisitorId(id);
  }, []);

  // ============================================
  // Persistence
  // ============================================

  // Load cart from localStorage on mount, merge with server if empty
  useEffect(() => {
    const loadCart = async () => {
      try {
        // The bag module folds the old 'cart' key in once (lib/store/bag.ts).
        let localItems: CartItem[] = readBag();

        // Back from Shopify's checkout? If the cart made there no longer
        // exists, an order completed it: the bag is empty now. Only a clear
        // "no" empties it; "still open" or "could not tell" leave it alone.
        const checkoutCartId = rememberedCheckout();
        if (checkoutCartId && localItems.length > 0) {
          const exists = await cartExists(checkoutCartId);
          if (exists === false) {
            localItems = [];
            writeBag(localItems);
            forgetCheckout();
          } else if (exists === true) {
            // still open: keep the bag, keep the memory for next time
          }
        } else if (checkoutCartId) {
          forgetCheckout();
        }

        // If local cart is empty and we have visitor ID, try to load from server
        if (localItems.length === 0 && visitorId) {
          try {
            const res = await fetch(`/api/store/cart/sync?visitorId=${visitorId}`);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.items) && data.items.length > 0) {
                localItems = data.items;
                writeBag(localItems);
              }
            }
          } catch (e) {
            // Server sync failed, use local only
          }
        }

        setItems(localItems);
      } catch (error) {
        console.error('Failed to load cart:', error);
      }
      setIsHydrated(true);
    };

    if (visitorId !== null) {
      loadCart();
    }
  }, [visitorId]);

  // Save cart to localStorage and sync to server on change (debounced)
  useEffect(() => {
    if (!isHydrated) return;

    // Save to localStorage immediately
    writeBag(items);

    // Debounced sync to server
    if (!visitorId) return;

    const itemsHash = JSON.stringify(items);
    if (itemsHash === lastSyncRef.current) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const subtotalCents = Math.round(
          items.reduce((sum, item) => sum + item.price * item.quantity * 100, 0)
        );
        await fetch('/api/store/cart/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId,
            items,
            subtotalCents,
            currency: items[0]?.currency || 'USD',
          }),
        });
        lastSyncRef.current = itemsHash;
      } catch (e) {
        // Sync failed, cart still saved locally
      }
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [items, isHydrated, visitorId]);

  // Cross-tab sync
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // ============================================
  // Computed Values
  // ============================================

  const cart: Cart = useMemo(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const currency = items[0]?.currency || 'USD';
    
    return {
      items,
      itemCount,
      subtotal,
      currency,
    };
  }, [items]);

  // ============================================
  // Actions
  // ============================================

  // Only what the bag keeps of a variant is asked for, so QuickShop and the
  // product page, which carry their own variant shapes, can add through here too.
  const addToCart = useCallback((params: {
    variant: Pick<ProductVariant, 'id' | 'title' | 'price' | 'currency' | 'image'>;
    productHandle: string;
    productTitle: string;
    image?: ProductImage | null;
    quantity?: number;
  }) => {
    const { variant, productHandle, productTitle, image } = params;
    const quantity = Math.max(1, Math.floor(params.quantity ?? 1));

    setItems(prev => {
      const existingIndex = prev.findIndex(item => item.variantId === variant.id);
      
      if (existingIndex >= 0) {
        // Increment quantity
        return prev.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      
      // Add new item
      const newItem: CartItem = {
        variantId: variant.id,
        productHandle,
        title: productTitle,
        variantTitle: variant.title,
        price: variant.price,
        currency: variant.currency,
        quantity,
        image: variant.image || image || null,
      };
      
      return [...prev, newItem];
    });
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setItems(prev => {
      if (quantity <= 0) {
        return prev.filter(item => item.variantId !== variantId);
      }
      return prev.map(item =>
        item.variantId === variantId ? { ...item, quantity } : item
      );
    });
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems(prev => prev.filter(item => item.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback((variantId: string) => {
    return items.some(item => item.variantId === variantId);
  }, [items]);

  const getItemQuantity = useCallback((variantId: string) => {
    return items.find(item => item.variantId === variantId)?.quantity || 0;
  }, [items]);

  return {
    cart,
    items,
    itemCount: cart.itemCount,
    subtotal: cart.subtotal,
    isHydrated,
    visitorId,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    isInCart,
    getItemQuantity,
  };
}

export type UseCartReturn = ReturnType<typeof useCart>;
