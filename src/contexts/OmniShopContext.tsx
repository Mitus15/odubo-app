'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

// Types
export interface CartItem {
  variantId: string;
  qty: number;
  title: string;
  variantTitle?: string;
  price: number;
  image?: string;
}

export interface ProductDetail {
  id: string;
  title: string;
  handle: string;
  images: string[];
  options: { name: string; values: string[] }[];
  variants: {
    id: string;
    title: string;
    price: number;
    currency: string;
    available: boolean;
    quantityAvailable: number;
    selectedOptions: Record<string, string>;
    image: string | null;
  }[];
}

export interface ProductCard {
  id: string;
  title: string;
  handle: string;
  image: string | null;
  price: number | null;
  available: boolean;
}

type ModalType = 'maison' | 'product' | 'cart';

interface ModalState {
  type: ModalType;
  productHandle?: string;
}

interface OmniShopContextValue {
  // Store access
  storeAccessible: boolean;
  checkingStoreAccess: boolean;

  // Modal stack
  modalStack: ModalState[];
  openMaison: () => void;
  openProduct: (handle: string) => void;
  openCart: () => void;
  goBack: () => void;
  closeAll: () => void;
  currentModal: ModalState | null;

  // Cart
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  addToCart: (item: Omit<CartItem, 'qty'>) => void;
  updateQuantity: (variantId: string, qty: number) => void;
  removeFromCart: (variantId: string) => void;
  clearCart: () => void;

  // Product cache
  products: ProductCard[];
  setProducts: (products: ProductCard[]) => void;
  productCache: Map<string, ProductDetail>;
  cacheProduct: (handle: string, product: ProductDetail) => void;
  getCachedProduct: (handle: string) => ProductDetail | undefined;
}

const OmniShopContext = createContext<OmniShopContextValue | null>(null);

export function OmniShopProvider({ children }: { children: ReactNode }) {
  // Store access state
  const [storeAccessible, setStoreAccessible] = useState(false);
  const [checkingStoreAccess, setCheckingStoreAccess] = useState(true);

  // Modal stack state
  const [modalStack, setModalStack] = useState<ModalState[]>([]);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Products list (for Maison grid)
  const [products, setProducts] = useState<ProductCard[]>([]);

  // Product detail cache
  const [productCache, setProductCache] = useState<Map<string, ProductDetail>>(new Map());

  // Check store access on mount
  useEffect(() => {
    async function checkStoreAccess() {
      try {
        const res = await fetch('/api/store/status');
        if (res.ok) {
          const data = await res.json();
          setStoreAccessible(data.accessGranted);
        }
      } catch (error) {
        console.error('Failed to check store status:', error);
        setStoreAccessible(false);
      } finally {
        setCheckingStoreAccess(false);
      }
    }

    checkStoreAccess();
  }, []);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('cart');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {}
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // Cross-tab sync
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cart' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setCart(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Modal actions
  const openMaison = useCallback(() => {
    setModalStack(prev => {
      // Don't duplicate if already on top
      if (prev.length > 0 && prev[prev.length - 1].type === 'maison') return prev;
      return [...prev, { type: 'maison' }];
    });
  }, []);

  const openProduct = useCallback((handle: string) => {
    setModalStack(prev => [...prev, { type: 'product', productHandle: handle }]);
  }, []);

  const openCart = useCallback(() => {
    setModalStack(prev => {
      if (prev.length > 0 && prev[prev.length - 1].type === 'cart') return prev;
      return [...prev, { type: 'cart' }];
    });
  }, []);

  const goBack = useCallback(() => {
    setModalStack(prev => prev.slice(0, -1));
  }, []);

  const closeAll = useCallback(() => {
    setModalStack([]);
  }, []);

  const currentModal = modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;

  // Cart actions
  const addToCart = useCallback((item: Omit<CartItem, 'qty'>) => {
    setCart(prev => {
      const existing = prev.find(c => c.variantId === item.variantId);
      if (existing) {
        return prev.map(c =>
          c.variantId === item.variantId ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((variantId: string, qty: number) => {
    setCart(prev => {
      if (qty <= 0) {
        return prev.filter(c => c.variantId !== variantId);
      }
      return prev.map(c =>
        c.variantId === variantId ? { ...c, qty } : c
      );
    });
  }, []);

  const removeFromCart = useCallback((variantId: string) => {
    setCart(prev => prev.filter(c => c.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  // Product cache actions
  const cacheProduct = useCallback((handle: string, product: ProductDetail) => {
    setProductCache(prev => new Map(prev).set(handle, product));
  }, []);

  const getCachedProduct = useCallback((handle: string) => {
    return productCache.get(handle);
  }, [productCache]);

  return (
    <OmniShopContext.Provider
      value={{
        storeAccessible,
        checkingStoreAccess,
        modalStack,
        openMaison,
        openProduct,
        openCart,
        goBack,
        closeAll,
        currentModal,
        cart,
        cartCount,
        cartSubtotal,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        products,
        setProducts,
        productCache,
        cacheProduct,
        getCachedProduct,
      }}
    >
      {children}
    </OmniShopContext.Provider>
  );
}

export function useOmniShop() {
  const context = useContext(OmniShopContext);
  if (!context) {
    throw new Error('useOmniShop must be used within an OmniShopProvider');
  }
  return context;
}
