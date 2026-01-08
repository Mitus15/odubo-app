'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { CartItem, Cart, ProductVariant, ProductImage } from '@/lib/store/types';

const CART_STORAGE_KEY = 'odubo_cart';

/**
 * useCart - Unified cart management hook
 * Single source of truth for cart state with localStorage persistence
 */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // ============================================
  // Persistence
  // ============================================

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
    }
    setIsHydrated(true);
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [items, isHydrated]);

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

  const addToCart = useCallback((params: {
    variant: ProductVariant;
    productHandle: string;
    productTitle: string;
    image?: ProductImage | null;
  }) => {
    const { variant, productHandle, productTitle, image } = params;
    
    setItems(prev => {
      const existingIndex = prev.findIndex(item => item.variantId === variant.id);
      
      if (existingIndex >= 0) {
        // Increment quantity
        return prev.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + 1 }
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
        quantity: 1,
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
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    isInCart,
    getItemQuantity,
  };
}

export type UseCartReturn = ReturnType<typeof useCart>;
