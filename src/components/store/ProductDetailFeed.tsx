'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/contexts/StoreContext';
import { useCartOverlay } from './StoreOrchestrator';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import type { Product, ProductVariant } from '@/lib/store/types';

// ============================================
// Variant Selector
// ============================================

interface VariantSelectorProps {
  product: Product;
  selectedOptions: Record<string, string>;
  onSelectOption: (name: string, value: string) => void;
}

function VariantSelector({ product, selectedOptions, onSelectOption }: VariantSelectorProps) {
  if (!product.options || product.options.length === 0) return null;

  return (
    <div className="space-y-4">
      {product.options.map((option) => (
        <div key={option.name}>
          <label className="block text-sm text-white/60 mb-2">{option.name}</label>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const isSelected = selectedOptions[option.name] === value;
              return (
                <button
                  key={value}
                  onClick={() => onSelectOption(option.name, value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Product Image
// ============================================

interface ProductImageProps {
  imageUrl: string | null;
  altText: string;
}

function ProductImage({ imageUrl, altText }: ProductImageProps) {
  if (!imageUrl) {
    return (
      <div className="w-full aspect-square bg-white/5 flex items-center justify-center rounded-lg">
        <svg className="w-16 h-16 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full aspect-square rounded-lg overflow-hidden">
      <img
        src={imageUrl}
        alt={altText}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

// ============================================
// Details Modal
// ============================================

interface DetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  description: string;
  vendor: string;
  productType: string;
}

function DetailsModal({ isOpen, onClose, description, vendor, productType }: DetailsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 z-[151] max-w-lg mx-auto my-auto h-fit bg-[#1a1817] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Product Details</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {description && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-white/80 mb-2">Description</h4>
                  <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                    {description}
                  </p>
                </div>
              )}
              
              {vendor && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-white/80 mb-1">Vendor</h4>
                  <p className="text-sm text-white/60">{vendor}</p>
                </div>
              )}
              
              {productType && (
                <div>
                  <h4 className="text-sm font-medium text-white/80 mb-1">Type</h4>
                  <p className="text-sm text-white/60">{productType}</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Main Product Detail Component
// ============================================

export default function ProductDetailFeed() {
  const {
    currentProduct,
    isLoadingProduct,
    closeProductDetail,
    cartItemCount,
    addToCart,
    isInCart,
  } = useStore();

  const { openCart } = useCartOverlay();
  const analytics = useAnalyticsSafe();

  // Selected options state
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const hasTrackedProductViewRef = useRef<string | null>(null);

  // Initialize options when product changes
  useEffect(() => {
    if (currentProduct?.options && currentProduct.options.length > 0) {
      const initial: Record<string, string> = {};
      currentProduct.options.forEach((opt) => {
        if (opt.values && opt.values.length > 0) {
          initial[opt.name] = opt.values[0];
        }
      });
      setSelectedOptions(initial);
    }
  }, [currentProduct?.id]);

  // Track product view when product loads
  useEffect(() => {
    if (currentProduct && currentProduct.handle !== hasTrackedProductViewRef.current) {
      analytics?.trackProductView(currentProduct.handle);
      hasTrackedProductViewRef.current = currentProduct.handle;
    }
  }, [currentProduct, analytics]);

  // Find selected variant
  const selectedVariant = useMemo(() => {
    if (!currentProduct?.variants || currentProduct.variants.length === 0) return null;

    return currentProduct.variants.find((v) =>
      Object.entries(selectedOptions).every(
        ([name, value]) => v.selectedOptions?.[name] === value
      )
    ) || currentProduct.variants[0];
  }, [currentProduct?.variants, selectedOptions]);

  // Get image for selected variant (use variant image if available, otherwise first product image)
  const displayImage = useMemo(() => {
    return selectedVariant?.image?.url || currentProduct?.images[0]?.url || null;
  }, [selectedVariant?.image, currentProduct?.images]);

  const handleSelectOption = useCallback((name: string, value: string) => {
    setSelectedOptions((prev) => ({ ...prev, [name]: value }));
    setAddedFeedback(false);
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!selectedVariant || !currentProduct) return;

    addToCart({
      variant: selectedVariant,
      productHandle: currentProduct.handle,
      productTitle: currentProduct.title,
      image: currentProduct.images[0] || null,
    });

    // Track add to cart
    analytics?.trackAddToCart(
      currentProduct.handle,
      selectedVariant.price,
      selectedVariant.id
    );

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  }, [selectedVariant, addToCart, currentProduct, analytics]);

  const variantInCart = selectedVariant ? isInCart(selectedVariant.id) : false;

  if (isLoadingProduct || !currentProduct) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-[#0d0c0b] flex items-center justify-center"
      >
        <div className="flex items-center gap-2 text-white/50">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-[110] bg-[#0d0c0b] flex flex-col"
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-white/10"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        {/* Back button */}
        <button
          onClick={closeProductDetail}
          className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/5"
          aria-label="Back to browse"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Brand logo */}
        <img
          src="/brand-logos/baad.png"
          alt="B.A.A.D"
          className="h-6 w-auto"
          draggable={false}
        />

        {/* Account & Cart buttons */}
        <div className="flex items-center gap-1">
          {/* Account button */}
          <a
            href="https://account.odubo.studio"
            className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/5"
            aria-label="Account"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </a>

          {/* Cart button */}
          <button
            onClick={openCart}
            className="relative w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/5"
            aria-label="Open cart"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            {cartItemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-black bg-white rounded-full px-1">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Content - scrollable */}
      <div 
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-4xl mx-auto p-4">
          {/* Product image */}
          <div className="mb-6">
            <ProductImage 
              imageUrl={displayImage} 
              altText={`${currentProduct.title}${selectedVariant ? ` - ${Object.values(selectedOptions).join(' ')}` : ''}`}
            />
          </div>

          {/* Title & Price */}
          <div className="mb-4">
            <h1 className="text-2xl font-semibold text-white mb-2">{currentProduct.title}</h1>
            {selectedVariant && (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-2xl font-bold ${selectedVariant.compareAtPrice && selectedVariant.compareAtPrice > selectedVariant.price ? 'text-red-400' : 'text-white'}`}>
                    ${selectedVariant.price.toFixed(2)}
                  </span>
                  {selectedVariant.compareAtPrice && selectedVariant.compareAtPrice > selectedVariant.price && (
                    <>
                      <span className="text-lg text-white/40 line-through">
                        ${selectedVariant.compareAtPrice.toFixed(2)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                        Save ${(selectedVariant.compareAtPrice - selectedVariant.price).toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
                {!selectedVariant.available && (
                  <p className="text-red-400/80 text-sm mt-2">This option is currently unavailable</p>
                )}
              </>
            )}
          </div>

          {/* View Details Button */}
          <button
            onClick={() => setShowDetails(true)}
            className="mb-6 flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            View Details
          </button>

          {/* Variant selector */}
          {currentProduct.options && currentProduct.options.length > 0 && (
            <div className="mb-6">
              <VariantSelector
                product={currentProduct}
                selectedOptions={selectedOptions}
                onSelectOption={handleSelectOption}
              />
            </div>
          )}

        </div>
      </div>

      {/* Add to cart button - fixed above footer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[112] bg-gradient-to-t from-[#0d0c0b] via-[#0d0c0b]/98 to-[#0d0c0b]/95 border-t border-white/5"
        style={{ 
          paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
          paddingTop: '16px',
          paddingLeft: '16px',
          paddingRight: '16px'
        }}
      >
        <div className="max-w-4xl mx-auto">
          <motion.button
            onClick={handleAddToCart}
            disabled={!selectedVariant?.available}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 shadow-lg ${
              !selectedVariant?.available
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : addedFeedback
                ? 'bg-green-500 text-white shadow-green-500/20'
                : variantInCart
                ? 'bg-white/20 text-white hover:bg-white/30'
                : 'bg-white text-black hover:bg-white/90 active:bg-white/80 shadow-white/10'
            }`}
          >
            {!selectedVariant?.available ? (
              'Sold Out'
            ) : addedFeedback ? (
              <>✓ Added to Bag</>
            ) : (
              <span>{variantInCart ? 'Add Another' : 'Add to Bag'}</span>
            )}
          </motion.button>
        </div>
      </div>

      {/* Details Modal */}
      <DetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        description={currentProduct.description}
        vendor={currentProduct.vendor}
        productType={currentProduct.productType}
      />
    </motion.div>
  );
}

// ============================================
