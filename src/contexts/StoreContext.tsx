'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useCart, type UseCartReturn } from '@/hooks/useCart';
import { fetchProducts, fetchProduct, createCheckout } from '@/lib/store/api';
import type {
  ProductSummary,
  Product,
  SortOption,
  ProductFilters,
  StoreView,
} from '@/lib/store/types';

// ============================================
// Context Types
// ============================================

interface StoreContextValue {
  // Store Access
  isStoreAccessible: boolean;
  isCheckingAccess: boolean;

  // View State
  view: StoreView;
  openStore: () => void;
  closeStore: () => void;
  openProductDetail: (index: number) => void;
  closeProductDetail: () => void;
  selectedProductIndex: number | null;

  // Products
  products: ProductSummary[];
  isLoadingProducts: boolean;
  hasMoreProducts: boolean;
  loadMoreProducts: () => Promise<void>;
  refreshProducts: () => Promise<void>;

  // Product Detail
  currentProduct: Product | null;
  isLoadingProduct: boolean;
  navigateToProduct: (index: number) => void;

  // Filters & Sort
  filters: ProductFilters;
  setFilters: (filters: ProductFilters) => void;
  sort: SortOption;
  setSort: (sort: SortOption) => void;

  // Cart (forwarded from useCart)
  cart: UseCartReturn['cart'];
  cartItemCount: number;
  addToCart: UseCartReturn['addToCart'];
  updateQuantity: UseCartReturn['updateQuantity'];
  removeFromCart: UseCartReturn['removeItem'];
  clearCart: UseCartReturn['clearCart'];
  isInCart: UseCartReturn['isInCart'];

  // Checkout
  isCheckingOut: boolean;
  checkout: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

// ============================================
// Provider Component
// ============================================

export function StoreProvider({ children }: { children: ReactNode }) {
  // Router for URL updates
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Cart hook
  const cartHook = useCart();

  // Store access
  const [isStoreAccessible, setIsStoreAccessible] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  // View state
  const [view, setView] = useState<StoreView>('closed');
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);

  // Track if we've restored from URL (to avoid loops)
  const hasRestoredFromUrl = useRef(false);
  const pendingProductHandle = useRef<string | null>(null);

  // Products
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const endCursorRef = useRef<string | null>(null);

  // Product detail
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const productCacheRef = useRef<Map<string, Product>>(new Map());

  // Filters & Sort
  const [filters, setFilters] = useState<ProductFilters>({});
  const [sort, setSort] = useState<SortOption>('newest');

  // Checkout
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // ============================================
  // Store Access Check
  // ============================================

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch('/api/store/status');
        if (res.ok) {
          const data = await res.json() as { accessGranted: boolean; published: boolean; isAdmin: boolean };
          setIsStoreAccessible(data.accessGranted);
        }
      } catch (error) {
        console.error('Failed to check store access:', error);
        setIsStoreAccessible(false);
      } finally {
        setIsCheckingAccess(false);
      }
    }
    checkAccess();
  }, []);

  // ============================================
  // View Actions
  // ============================================

  const openStore = useCallback(() => {
    if (!isStoreAccessible) return;
    setView('browse');
  }, [isStoreAccessible]);

  const closeStore = useCallback(() => {
    setView('closed');
    setSelectedProductIndex(null);
    setCurrentProduct(null);
  }, []);

  const openProductDetail = useCallback((index: number) => {
    setSelectedProductIndex(index);
    setView('detail');
  }, []);

  const closeProductDetail = useCallback(() => {
    setView('browse');
    setSelectedProductIndex(null);
    setCurrentProduct(null);
  }, []);

  // ============================================
  // Product Fetching
  // ============================================

  const loadProducts = useCallback(async (reset: boolean = false) => {
    if (isLoadingProducts) return;
    
    setIsLoadingProducts(true);
    
    try {
      const cursor = reset ? null : endCursorRef.current;
      const response = await fetchProducts({
        first: 24,
        after: cursor,
        sort,
        filters,
      });
      
      if (reset) {
        setProducts(response.products);
      } else {
        setProducts(prev => [...prev, ...response.products]);
      }
      
      endCursorRef.current = response.pageInfo.endCursor;
      setHasMoreProducts(response.pageInfo.hasNextPage);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [isLoadingProducts, sort, filters]);

  const loadMoreProducts = useCallback(async () => {
    if (!hasMoreProducts || isLoadingProducts) return;
    await loadProducts(false);
  }, [hasMoreProducts, isLoadingProducts, loadProducts]);

  const refreshProducts = useCallback(async () => {
    endCursorRef.current = null;
    await loadProducts(true);
  }, [loadProducts]);

  // Load products when store opens or filters/sort change
  useEffect(() => {
    if (view !== 'closed' && products.length === 0) {
      loadProducts(true);
    }
  }, [view, loadProducts, products.length]);

  // Reload when filters or sort change
  useEffect(() => {
    if (view !== 'closed') {
      endCursorRef.current = null;
      loadProducts(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort]);

  // ============================================
  // Product Detail Loading
  // ============================================

  const loadProductDetail = useCallback(async (handle: string) => {
    // Check cache first
    const cached = productCacheRef.current.get(handle);
    if (cached) {
      setCurrentProduct(cached);
      return;
    }

    setIsLoadingProduct(true);
    
    try {
      const product = await fetchProduct(handle);
      if (product) {
        productCacheRef.current.set(handle, product);
        setCurrentProduct(product);
      }
    } catch (error) {
      console.error('Failed to load product:', error);
    } finally {
      setIsLoadingProduct(false);
    }
  }, []);

  // Load product when index changes
  useEffect(() => {
    if (selectedProductIndex !== null && products[selectedProductIndex]) {
      loadProductDetail(products[selectedProductIndex].handle);
    }
  }, [selectedProductIndex, products, loadProductDetail]);

  const navigateToProduct = useCallback((index: number) => {
    if (index >= 0 && index < products.length) {
      setSelectedProductIndex(index);
    }
  }, [products.length]);

  // ============================================
  // URL Persistence
  // ============================================

  // Check for product param on mount/load
  useEffect(() => {
    if (hasRestoredFromUrl.current) return;

    const productHandle = searchParams.get('product');
    if (productHandle && pathname === '/store') {
      pendingProductHandle.current = productHandle;
    }
  }, [searchParams, pathname]);

  // Restore product from URL once products are loaded
  useEffect(() => {
    if (hasRestoredFromUrl.current || !pendingProductHandle.current) return;
    if (products.length === 0) return;

    const handle = pendingProductHandle.current;
    const index = products.findIndex(p => p.handle === handle);

    if (index !== -1) {
      hasRestoredFromUrl.current = true;
      pendingProductHandle.current = null;
      setSelectedProductIndex(index);
      setView('detail');
    } else {
      // Product not found in current list, try to load it directly
      hasRestoredFromUrl.current = true;
      pendingProductHandle.current = null;
      // Load the product directly and show it
      loadProductDetail(handle).then(() => {
        setView('detail');
      });
    }
  }, [products, loadProductDetail]);

  // Sync URL when product selection changes
  useEffect(() => {
    // Only sync if we're on the store page
    if (pathname !== '/store') return;

    const currentProductParam = searchParams.get('product');
    const selectedHandle = selectedProductIndex !== null && products[selectedProductIndex]
      ? products[selectedProductIndex].handle
      : null;

    // Update URL if product changed
    if (selectedHandle && view === 'detail') {
      if (currentProductParam !== selectedHandle) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('product', selectedHandle);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    } else if (currentProductParam && view !== 'detail') {
      // Remove product param if no longer viewing detail
      const params = new URLSearchParams(searchParams.toString());
      params.delete('product');
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [selectedProductIndex, products, view, pathname, searchParams, router]);

  // ============================================
  // Checkout
  // ============================================

  const checkout = useCallback(async () => {
    if (cartHook.items.length === 0) return;
    
    setIsCheckingOut(true);
    
    try {
      const checkoutUrl = await createCheckout(
        cartHook.items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
        }))
      );
      
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error('Failed to create checkout');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to create checkout. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  }, [cartHook.items]);

  // ============================================
  // Context Value
  // ============================================

  const value: StoreContextValue = useMemo(() => ({
    // Store Access
    isStoreAccessible,
    isCheckingAccess,

    // View State
    view,
    openStore,
    closeStore,
    openProductDetail,
    closeProductDetail,
    selectedProductIndex,

    // Products
    products,
    isLoadingProducts,
    hasMoreProducts,
    loadMoreProducts,
    refreshProducts,

    // Product Detail
    currentProduct,
    isLoadingProduct,
    navigateToProduct,

    // Filters & Sort
    filters,
    setFilters,
    sort,
    setSort,

    // Cart
    cart: cartHook.cart,
    cartItemCount: cartHook.itemCount,
    addToCart: cartHook.addToCart,
    updateQuantity: cartHook.updateQuantity,
    removeFromCart: cartHook.removeItem,
    clearCart: cartHook.clearCart,
    isInCart: cartHook.isInCart,

    // Checkout
    isCheckingOut,
    checkout,
  }), [
    isStoreAccessible,
    isCheckingAccess,
    view,
    openStore,
    closeStore,
    openProductDetail,
    closeProductDetail,
    selectedProductIndex,
    products,
    isLoadingProducts,
    hasMoreProducts,
    loadMoreProducts,
    refreshProducts,
    currentProduct,
    isLoadingProduct,
    navigateToProduct,
    filters,
    sort,
    cartHook,
    isCheckingOut,
    checkout,
  ]);

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
