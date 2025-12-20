'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useOmniShop, type ProductCard } from '@/contexts/OmniShopContext';
import { useShopifyAuth } from '@/hooks/useShopifyAuth';

const PRODUCTS_PER_PAGE = 12;

export default function MaisonModal() {
  const { products, setProducts, openProduct, openCart, closeAll, cartCount } = useOmniShop();
  const { customer, isLoggedIn, login: shopifyLogin } = useShopifyAuth();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [endCursor, setEndCursor] = useState<string | null>(null);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Fetch products with optional cursor for pagination
  const fetchProducts = useCallback(async (cursor?: string | null) => {
    const isInitialLoad = !cursor;

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const STORE_URL = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
      const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

      if (!PUBLIC_TOKEN) throw new Error('Store configuration error');

      const query = `#graphql
        query Products($first: Int!, $after: String) {
          products(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                handle
                availableForSale
                images(first: 1) { edges { node { url } } }
                variants(first: 1) { edges { node { price { amount } } } }
              }
            }
          }
        }`;

      const res = await fetch(`${STORE_URL}/api/2024-07/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
        },
        body: JSON.stringify({
          query,
          variables: {
            first: PRODUCTS_PER_PAGE,
            after: cursor || null,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to load products');
      const data = await res.json();

      const pageInfo = data?.data?.products?.pageInfo;
      const mapped: ProductCard[] = data?.data?.products?.edges?.map(({ node: p }: any) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        image: p.images?.edges?.[0]?.node?.url || null,
        price: p.variants?.edges?.[0]?.node?.price?.amount
          ? parseFloat(p.variants.edges[0].node.price.amount)
          : null,
        available: p.availableForSale,
      })) || [];

      if (isInitialLoad) {
        setProducts(mapped);
      } else {
        setProducts((prev) => [...prev, ...mapped]);
      }

      setHasNextPage(pageInfo?.hasNextPage ?? false);
      setEndCursor(pageInfo?.endCursor ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [setProducts]);

  // Initial load
  useEffect(() => {
    if (products.length > 0) return;
    fetchProducts();
  }, [products.length, fetchProducts]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || loading || loadingMore) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !loadingMore && endCursor) {
          fetchProducts(endCursor);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasNextPage, loading, loadingMore, endCursor, fetchProducts]);

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[110] flex flex-col bg-gradient-to-br from-[#302927] via-[#1a1817] to-[#302927]"
    >
      {/* Header - glass surface */}
      <header
        className="flex items-center justify-between px-4 py-3 glass-surface border-b border-[#502d26]/30"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={closeAll}
          className="w-10 h-10 flex items-center justify-center text-[#ede8df]/60 hover:text-[#ede8df] transition-colors rounded-full hover:bg-[#843c2d]/10"
          aria-label="Close"
          style={{ touchAction: 'manipulation' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <img
            src="/brand-logos/baad.png"
            alt="B.A.A.D Brand Logo"
            className="h-6 w-auto"
            draggable={false}
          />
          
          {/* Customer indicator */}
          {isLoggedIn && customer?.email && (
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-[#843c2d]/20 rounded-full">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-[#ede8df]/80 text-xs">{customer.email.split('@')[0]}</span>
            </div>
          )}
          
          {!isLoggedIn && (
            <button
              onClick={shopifyLogin}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-xs text-[#ede8df]/70 hover:text-[#ede8df] border border-[#502d26]/50 hover:border-[#843c2d]/50 rounded-full transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Sign In
            </button>
          )}
        </div>

        <button
          onClick={openCart}
          className="relative w-10 h-10 flex items-center justify-center text-[#ede8df]/60 hover:text-[#ede8df] transition-colors rounded-full hover:bg-[#843c2d]/10"
          aria-label="Open cart"
          style={{ touchAction: 'manipulation' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          {cartCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center bg-[#843c2d] text-[#ede8df] text-[9px] font-bold rounded-full">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </button>
      </header>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        {/* Loading state */}
        {loading && (
          <div className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-[1px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                <div key={i} className="aspect-square bg-[#302927]/50 animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
            <p className="text-[#b2a491] text-sm mb-4">{error}</p>
            <button
              onClick={closeAll}
              className="px-5 py-2.5 rounded-xl glass-surface border border-[#502d26]/30 text-[#ede8df] hover:bg-[#843c2d]/10 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        )}

        {/* Product Grid - responsive with desktop scaling */}
        {!loading && !error && products.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-[1px] lg:gap-1 bg-[#502d26]/20">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => openProduct(product.handle)}
                  className="group relative aspect-square bg-gradient-to-br from-[#1a1817] to-[#252220] overflow-hidden focus:outline-none"
                  style={{ touchAction: 'manipulation' }}
                >
                  {/* Product Image */}
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.title}
                      className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.03] group-active:scale-[0.98]"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[#b2a491]/30 text-[10px] uppercase tracking-widest">No Image</span>
                    </div>
                  )}

                  {/* Sold Out Overlay */}
                  {!product.available && (
                    <div className="absolute inset-0 bg-[#1a1817]/80 flex items-center justify-center">
                      <span className="px-3 py-1.5 glass-surface rounded-full text-[#b2a491] text-[10px] uppercase tracking-widest border border-[#502d26]/30">
                        Sold Out
                      </span>
                    </div>
                  )}

                  {/* Hover overlay with title */}
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-[#1a1817]/90 via-[#1a1817]/60 to-transparent opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                    <p className="text-[#ede8df] text-xs font-medium truncate">{product.title}</p>
                    {product.price !== null && (
                      <p className="text-[#b2a491] text-[10px]">${product.price.toFixed(2)}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Infinite scroll trigger */}
            {hasNextPage && (
              <div
                ref={loadMoreRef}
                className="flex justify-center py-8"
              >
                {loadingMore ? (
                  <div className="w-6 h-6 border-2 border-[#843c2d]/30 border-t-[#843c2d] rounded-full animate-spin" />
                ) : (
                  /* Invisible trigger */
                  <div className="h-8" />
                )}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && !error && products.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <p className="text-[#b2a491]/40 text-xs uppercase tracking-widest">No products available</p>
          </div>
        )}

        {/* Legal Footer */}
        <footer className="px-4 py-6 mt-8 border-t border-[#502d26]/20">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4">
            <a
              href="https://odubostudio.myshopify.com/policies/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#b2a491]/60 hover:text-[#b2a491] transition-colors uppercase tracking-wider"
            >
              Privacy
            </a>
            <a
              href="https://odubostudio.myshopify.com/policies/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#b2a491]/60 hover:text-[#b2a491] transition-colors uppercase tracking-wider"
            >
              Terms
            </a>
            <a
              href="https://odubostudio.myshopify.com/policies/shipping-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#b2a491]/60 hover:text-[#b2a491] transition-colors uppercase tracking-wider"
            >
              Shipping
            </a>
            <a
              href="https://odubostudio.myshopify.com/policies/refund-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#b2a491]/60 hover:text-[#b2a491] transition-colors uppercase tracking-wider"
            >
              Refunds
            </a>
          </div>
          <p className="text-center text-[9px] text-[#b2a491]/40 tracking-wider">
            &copy; {new Date().getFullYear()} Odubo Studio. All rights reserved.
          </p>
        </footer>
      </div>
    </motion.div>
  );
}
