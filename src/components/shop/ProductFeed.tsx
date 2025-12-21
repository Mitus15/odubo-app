'use client';

import React, { useCallback, useMemo, useRef, useEffect, useState, forwardRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { ProductCard } from './ProductCard';
import { type ProductCard as ProductCardType } from '@/contexts/OmniShopContext';

interface ProductFeedProps {
  products: ProductCardType[];
  onClose: () => void;
  initialIndex?: number;
}

/**
 * Virtualized full-screen product feed with snap scrolling
 * Based on the clips feed mechanism with:
 * - Full-screen cards with snap scrolling
 * - IntersectionObserver for active product detection
 * - Optimized for mobile touch gestures
 */
export default function ProductFeed({ products, onClose, initialIndex = 0 }: ProductFeedProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const observersRef = useRef<Map<number, IntersectionObserver>>(new Map());
  const elementRefsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  // Memoize products to prevent unnecessary re-renders and create infinite scroll effect
  const infiniteProducts = useMemo(() => {
    if (products.length === 0) return [];
    
    // Shuffle function
    const shuffle = (array: ProductCardType[]) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Create multiple shuffled copies for infinite scroll effect
    const shuffledProducts = shuffle(products);
    const copies = Array(10).fill(null).map((_, i) => 
      shuffle(shuffledProducts).map((p, idx) => ({
        ...p,
        id: `${p.id}-copy-${i}-${idx}` // Unique ID for virtualization
      }))
    );
    
    return copies.flat();
  }, [products]);

  // Set up IntersectionObserver for each product card
  const setupObserver = useCallback((index: number, element: HTMLDivElement | null) => {
    // Clean up existing observer for this index
    const existingObserver = observersRef.current.get(index);
    if (existingObserver) {
      existingObserver.disconnect();
      observersRef.current.delete(index);
    }

    if (!element) {
      elementRefsRef.current.delete(index);
      return;
    }

    elementRefsRef.current.set(index, element);

    // Create new observer with multiple thresholds for smooth detection
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Product is considered "active" when >60% visible
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveIndex(index);
          }
        });
      },
      {
        root: containerRef.current,
        threshold: [0.5, 0.6, 0.7, 0.8],
      }
    );

    observer.observe(element);
    observersRef.current.set(index, observer);
  }, []);

  // Cleanup observers on unmount
  useEffect(() => {
    return () => {
      observersRef.current.forEach((observer) => observer.disconnect());
      observersRef.current.clear();
    };
  }, []);

  // Scroll to initial index on mount
  useEffect(() => {
    if (initialIndex > 0 && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: initialIndex,
        align: 'start',
        behavior: 'auto',
      });
    }
  }, [initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIndex = activeIndex + 1;
        virtuosoRef.current?.scrollToIndex({ index: nextIndex, align: 'start', behavior: 'smooth' });
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIndex = Math.max(activeIndex - 1, 0);
        virtuosoRef.current?.scrollToIndex({ index: prevIndex, align: 'start', behavior: 'smooth' });
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, onClose]);

  // Item renderer
  const itemContent = useCallback(
    (index: number, product: ProductCardType) => (
      <div
        ref={(el) => setupObserver(index, el)}
        className="w-full h-[100dvh]"
        style={{ scrollSnapAlign: 'start' }}
      >
        <ProductCard
          product={product}
          isActive={index === activeIndex}
          index={index}
        />
      </div>
    ),
    [activeIndex, setupObserver]
  );

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[110] bg-[#1a1817]"
      style={{
        scrollSnapType: 'y mandatory',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Header - floating glass back button */}
      <header
        className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center glass-surface-light rounded-full text-[#ede8df]/70 hover:text-[#ede8df] active:scale-95 transition-all border border-white/10"
          aria-label="Back to grid"
          style={{ touchAction: 'manipulation' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Product count */}
        <div className="glass-surface-light px-4 py-2 rounded-full border border-white/10">
          <span className="text-[#ede8df]/70 text-xs font-light">
            {(activeIndex % products.length) + 1} / {products.length}
          </span>
        </div>

        {/* Spacer */}
        <div className="w-10" />
      </header>

      {/* Virtuoso scroll container */}
      <Virtuoso
        ref={virtuosoRef}
        data={infiniteProducts}
        itemContent={itemContent}
        style={{
          height: '100dvh',
          width: '100%',
          scrollSnapType: 'y mandatory',
          overscrollBehavior: 'contain',
        }}
        components={{
          Scroller: ScrollerWithSnap,
        }}
        initialTopMostItemIndex={initialIndex}
        overscan={2}
      />

      {/* Progress dots (for small number of products) */}
      {/* Removed - no longer needed */}
    </div>
  );
}

// Custom scroller with snap scrolling
const ScrollerWithSnap = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, style, ...props }, ref) => (
    <div
      ref={ref}
      style={{
        ...style,
        scrollSnapType: 'y mandatory',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
      {...props}
    >
      {children}
    </div>
  )
);
ScrollerWithSnap.displayName = 'ScrollerWithSnap';
