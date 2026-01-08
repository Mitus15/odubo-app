'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/contexts/StoreContext';
import { useCartOverlay } from './StoreOrchestrator';
import type { SortOption } from '@/lib/store/types';

// ============================================
// Filter & Sort UI
// ============================================

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'title-asc', label: 'A - Z' },
  { value: 'title-desc', label: 'Z - A' },
];

function FilterSortBar() {
  const { sort, setSort, filters, setFilters, cartItemCount, products } = useStore();
  const [showSort, setShowSort] = useState(false);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
      {/* Product count */}
      <span className="text-sm text-white/50">
        {products.length} item{products.length !== 1 ? 's' : ''}
      </span>

      {/* Sort dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowSort(!showSort)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-sm text-white/70"
        >
          <span>{SORT_OPTIONS.find(o => o.value === sort)?.label || 'Sort'}</span>
          <svg
            className={`w-4 h-4 transition-transform ${showSort ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <AnimatePresence>
          {showSort && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute right-0 top-full mt-2 py-2 min-w-[160px] rounded-xl bg-[#252220] border border-white/10 shadow-xl z-10"
            >
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSort(option.value);
                    setShowSort(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                    sort === option.value
                      ? 'text-white bg-white/10'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================
// Product Grid Item
// ============================================

interface ProductGridItemProps {
  product: {
    id: string;
    handle: string;
    title: string;
    image: { url: string; altText?: string } | null;
    price: number;
    compareAtPrice?: number | null;
    currency: string;
    available: boolean;
  };
  index: number;
  onSelect: (index: number) => void;
}

function ProductGridItem({ product, index, onSelect }: ProductGridItemProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const isOnSale = product.compareAtPrice && product.compareAtPrice > product.price;
  const savingsPercent = isOnSale ? Math.round((1 - product.price / product.compareAtPrice!) * 100) : 0;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.2 }}
      onClick={() => onSelect(index)}
      className="relative w-full overflow-hidden rounded-lg bg-[#1a1817] group text-left"
    >
      {/* Image container */}
      <div className="aspect-square relative">
        {product.image ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0 animate-pulse" />
            )}
            <img
              src={product.image.url}
              alt={product.image.altText || product.title}
              className={`w-full h-full object-cover transition-all duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              } group-hover:scale-105 group-active:scale-100`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Sale badge */}
        {isOnSale && product.available && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
            -{savingsPercent}%
          </div>
        )}

        {/* Sold out overlay */}
        {!product.available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white/80 text-sm font-medium tracking-wide">SOLD OUT</span>
          </div>
        )}
      </div>

      {/* Product info - always visible */}
      <div className="p-2">
        <h3 className="text-white/90 text-xs font-medium line-clamp-1 mb-1">{product.title}</h3>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold ${isOnSale ? 'text-red-400' : 'text-white'}`}>
            ${product.price.toFixed(2)}
          </span>
          {isOnSale && (
            <span className="text-white/40 text-xs line-through">
              ${product.compareAtPrice!.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ============================================
// Main ProductBrowse Component
// ============================================

export default function ProductBrowse() {
  const {
    products,
    isLoadingProducts,
    hasMoreProducts,
    loadMoreProducts,
    openProductDetail,
    closeStore,
    cartItemCount,
  } = useStore();
  
  const { openCart } = useCartOverlay();

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMoreProducts || isLoadingProducts) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMoreProducts();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMoreProducts, isLoadingProducts, loadMoreProducts]);

  const handleProductSelect = useCallback((index: number) => {
    openProductDetail(index);
  }, [openProductDetail]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-[#0d0c0b]"
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0d0c0b]/95 backdrop-blur-sm"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        {/* Close button */}
        <button
          onClick={closeStore}
          className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/5"
          aria-label="Close store"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Brand logo */}
        <div className="flex items-center">
          <img
            src="/brand-logos/baad.png"
            alt="B.A.A.D"
            className="h-6 w-auto"
            draggable={false}
          />
        </div>

        {/* Cart button */}
        <button
          onClick={openCart}
          className="relative w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/5"
          aria-label="Open cart"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          {cartItemCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-black bg-white rounded-full px-1">
              {cartItemCount > 99 ? '99+' : cartItemCount}
            </span>
          )}
        </button>
      </header>

      {/* Filter/Sort bar */}
      <FilterSortBar />

      {/* Product Grid */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(44px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        {/* Initial loading state */}
        {isLoadingProducts && products.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-lg bg-[#1a1817] overflow-hidden">
                <div className="aspect-square bg-white/5 animate-pulse" />
                <div className="p-2 space-y-2">
                  <div className="h-3 w-3/4 bg-white/5 rounded animate-pulse" />
                  <div className="h-4 w-1/3 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/50">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p>No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-2">
            {products.map((product, index) => (
              <ProductGridItem
                key={product.id}
                product={product}
                index={index}
                onSelect={handleProductSelect}
              />
            ))}
          </div>
        )}

        {/* Load more trigger */}
        {hasMoreProducts && (
          <div
            ref={loadMoreRef}
            className="flex items-center justify-center py-8"
          >
            {isLoadingProducts && (
              <div className="flex items-center gap-2 text-white/50">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Loading more...</span>
              </div>
            )}
          </div>
        )}

        {/* Bottom safe area */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </motion.div>
  );
}
