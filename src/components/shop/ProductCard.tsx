'use client';

import { useState, useCallback, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOmniShop, type ProductCard as ProductCardType } from '@/contexts/OmniShopContext';

interface ProductCardProps {
  product: ProductCardType;
  isActive: boolean;
  index: number;
}

/**
 * Full-screen swipeable product card (clips-style)
 * Features:
 * - Full-screen product image with glass overlay
 * - Tap to view details
 * - Swipe up/down navigation handled by parent
 * - Glass aesthetic with gradient overlays
 */
function ProductCardComponent({ product, isActive, index }: ProductCardProps) {
  const { openProduct, addToCart } = useOmniShop();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    lastTapRef.current = now;

    // Double-tap to quick add (if available)
    if (timeSinceLastTap < 300) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      // Double tap - show quick add feedback
      setShowQuickAdd(true);
      setTimeout(() => setShowQuickAdd(false), 1500);
      return;
    }

    // Single tap - navigate to product details
    tapTimeoutRef.current = setTimeout(() => {
      openProduct(product.handle);
      tapTimeoutRef.current = null;
    }, 250);
  }, [openProduct, product.handle]);

  const handleViewDetails = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    openProduct(product.handle);
  }, [openProduct, product.handle]);

  // Format price
  const formattedPrice = product.price !== null 
    ? `$${product.price.toFixed(2)}` 
    : 'Price unavailable';

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{ 
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* Product Image - Full screen background */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-[#1a1817] via-[#252220] to-[#1a1817]"
        onClick={handleTap}
      >
        {product.image && (
          <motion.img
            src={product.image}
            alt={product.title}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ 
              opacity: imageLoaded ? 1 : 0, 
              scale: imageLoaded && isActive ? 1 : 1.02 
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            onLoad={() => setImageLoaded(true)}
            draggable={false}
            loading={index < 3 ? 'eager' : 'lazy'}
          />
        )}

        {/* Loading shimmer */}
        {!imageLoaded && product.image && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#302927]/50 to-[#1a1817]/50 animate-pulse" />
        )}

        {/* No image placeholder */}
        {!product.image && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[#b2a491]/20 text-center">
              <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={0.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span className="text-xs uppercase tracking-[0.2em]">No Image</span>
            </div>
          </div>
        )}
      </div>

      {/* Top gradient for header space */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 via-black/20 to-transparent pointer-events-none" />

      {/* Bottom gradient for text readability */}
      <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      {/* Product Info - Bottom glass overlay */}
      <div 
        className="absolute inset-x-0 bottom-0 p-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}
      >
        {/* Glass card for product info */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: isActive ? 1 : 0.7 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="glass-surface-light rounded-2xl p-5 border border-white/10"
        >
          {/* Product title */}
          <h2 className="text-[#ede8df] text-xl font-medium leading-tight mb-2 line-clamp-2">
            {product.title}
          </h2>

          {/* Price & availability */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[#ede8df]/90 text-lg font-light">
              {formattedPrice}
            </span>
            {!product.available && (
              <span className="text-[#843c2d] text-xs uppercase tracking-[0.15em] px-2 py-1 glass-surface rounded-lg">
                Sold Out
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleViewDetails}
              className="flex-1 py-3.5 px-5 bg-[#ede8df] text-[#302927] rounded-xl text-sm font-medium uppercase tracking-[0.1em] active:scale-[0.98] transition-transform"
              style={{ touchAction: 'manipulation' }}
            >
              View Details
            </button>
            {product.available && (
              <button
                type="button"
                onClick={handleViewDetails}
                className="w-14 h-14 flex items-center justify-center glass-surface border border-white/10 rounded-xl text-[#ede8df]/80 hover:text-[#ede8df] active:scale-[0.95] transition-all"
                style={{ touchAction: 'manipulation' }}
                aria-label="Quick add to cart"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick add feedback overlay */}
      <AnimatePresence>
        {showQuickAdd && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <div className="glass-surface rounded-2xl p-6 text-center">
              <svg className="w-12 h-12 mx-auto mb-2 text-[#ede8df]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-[#ede8df] text-sm uppercase tracking-[0.15em]">
                Tap for details
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product number indicator (top-right) */}
      <div className="absolute top-4 right-4" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="glass-surface-light px-3 py-1.5 rounded-full">
          <span className="text-[#ede8df]/60 text-xs font-light">
            #{index + 1}
          </span>
        </div>
      </div>

      {/* Swipe hint for first product */}
      {index === 0 && isActive && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.5 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center text-[#ede8df]/40 pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </motion.div>
          <span className="text-[10px] uppercase tracking-[0.2em] mt-1">Swipe up</span>
        </motion.div>
      )}
    </div>
  );
}

export const ProductCard = memo(ProductCardComponent);
export default ProductCard;
