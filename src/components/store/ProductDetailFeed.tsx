'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/contexts/StoreContext';
import { useCartOverlay } from './StoreOrchestrator';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import type { Product, ProductVariant } from '@/lib/store/types';
import { isPreorderActive, PREORDER_CTA, PREORDER_CTA_ANOTHER, PREORDER_FEEDBACK, PREORDER_SHIP_TEXT } from '@/config/preorder';

// Helper to extract image filename for comparison
// Shopify URLs can differ between list and detail views even for same image
function getImageIdentifier(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || '';
    // Remove size suffixes like _100x, _200x200, etc.
    return filename.replace(/_\d+x\d*|\?\S+$/g, '');
  } catch {
    return url;
  }
}

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
  descriptionHtml: string;
}

// Parse Shopify descriptionHtml into care instructions + size table HTML
function parseDescriptionHtml(html: string): {
  careInstructions: string[];
  sizeTableHtml: string | null;
  general: string[];
} {
  // Remove hidden item-id divs
  let cleaned = html.replace(/<div[^>]*display:\s*none[^>]*>.*?<\/div>/gi, '');

  // Extract the size chart table HTML before stripping
  let sizeTableHtml: string | null = null;
  const tableMatch = cleaned.match(/<table[\s\S]*?<\/table>/i);
  if (tableMatch) {
    sizeTableHtml = tableMatch[0];
    // Remove everything from "Size Chart" header through end of table wrapper
    cleaned = cleaned.replace(/<span[^>]*>Size Chart<\/span>/i, '');
    cleaned = cleaned.replace(/<div[^>]*>[\s]*<table[\s\S]*?<\/table>[\s]*<\/div>/i, '');
    cleaned = cleaned.replace(/<table[\s\S]*?<\/table>/i, '');
  }

  // Now parse the remaining text for care instructions
  const careInstructions: string[] = [];
  const general: string[] = [];

  // Strip remaining HTML tags to get text blocks
  const blocks = cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/<\/?(?:p|div|span|h[1-6])[^>]*>/gi)
    .map(b => b.replace(/<[^>]*>/g, '').trim())
    .filter(Boolean);

  let inCare = false;

  for (const block of blocks) {
    const lower = block.toLowerCase();

    // Detect "Care Instructions:" header
    if (/care\s*instruction/i.test(block) || /^care:/i.test(block)) {
      inCare = true;
      // Content after the colon (e.g. "Care Instructions:Machine wash...")
      const afterColon = block.replace(/^[^:]*:\s*/, '');
      if (afterColon && afterColon !== block) {
        // Split on semicolons — Shopify uses ";" to separate care items
        afterColon.split(/;\s*/).map(s => s.trim()).filter(Boolean).forEach(s => careInstructions.push(s));
      }
      continue;
    }

    if (inCare) {
      block.split(/;\s*/).map(s => s.trim()).filter(Boolean).forEach(s => careInstructions.push(s));
    } else if (block.length > 1) {
      general.push(block);
    }
  }

  return { careInstructions, sizeTableHtml, general };
}

function DetailsModal({ isOpen, onClose, descriptionHtml }: DetailsModalProps) {
  const sections = descriptionHtml ? parseDescriptionHtml(descriptionHtml) : null;
  const hasContent = sections && (sections.general.length > 0 || sections.careInstructions.length > 0 || sections.sizeTableHtml);

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
              <h3 className="text-lg font-semibold text-white">Details</h3>
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
            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-5">
              {!hasContent && (
                <p className="text-sm text-white/40">No details available.</p>
              )}

              {sections && sections.general.length > 0 && (
                <div>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {sections.general.join(' ')}
                  </p>
                </div>
              )}

              {sections && sections.careInstructions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V6.836a2.25 2.25 0 00-.659-1.591L15 2" />
                    </svg>
                    <h4 className="text-xs uppercase tracking-widest text-white/50 font-medium">Care Instructions</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {sections.careInstructions.map((line, i) => (
                      <li key={i} className="text-sm text-white/60 leading-relaxed flex items-start gap-2">
                        <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-white/30" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sections && sections.sizeTableHtml && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                    </svg>
                    <h4 className="text-xs uppercase tracking-widest text-white/50 font-medium">Size Guide</h4>
                  </div>
                  <div
                    className="overflow-x-auto rounded-lg [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_td]:px-2 [&_td]:py-1.5 [&_td]:border [&_td]:border-white/10 [&_td]:text-white/60 [&_td]:text-center [&_tr:first-child_td]:text-white/80 [&_tr:first-child_td]:font-medium [&_tr:nth-child(2)_td]:text-white/40 [&_tr:nth-child(2)_td]:text-[10px] [&_td:first-child]:text-left [&_td:first-child]:text-white/70 [&_td:first-child]:font-medium"
                    dangerouslySetInnerHTML={{
                      __html: sections.sizeTableHtml
                        .replace(/style="[^"]*"/gi, '')
                        .replace(/width="[^"]*"/gi, '')
                        .replace(/colspan/gi, 'colSpan'),
                    }}
                  />
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
    products,
    selectedProductIndex,
  } = useStore();

  const { openCart } = useCartOverlay();
  const analytics = useAnalyticsSafe();

  // Selected options state
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const hasTrackedProductViewRef = useRef<string | null>(null);

  // Initialize options when product changes - match variant to grid image
  useEffect(() => {
    if (!currentProduct?.options || currentProduct.options.length === 0) return;

    // Get the grid image from the product summary (what user clicked on)
    const gridProduct = selectedProductIndex !== null ? products[selectedProductIndex] : null;
    const gridImageId = gridProduct?.image?.url ? getImageIdentifier(gridProduct.image.url) : '';

    // Find variant whose image matches the grid image
    let matchingVariant: ProductVariant | null = null;
    if (gridImageId && currentProduct.variants?.length) {
      matchingVariant = currentProduct.variants.find((v) => {
        const variantImageId = getImageIdentifier(v.image?.url);
        return variantImageId && variantImageId === gridImageId;
      }) || null;
    }

    // Initialize options from matching variant, or fall back to first option values
    const initial: Record<string, string> = {};
    if (matchingVariant?.selectedOptions) {
      // Use the matched variant's options (for color, etc.)
      Object.assign(initial, matchingVariant.selectedOptions);
    } else {
      // Fall back to first value for each option
      currentProduct.options.forEach((opt) => {
        if (opt.values && opt.values.length > 0) {
          initial[opt.name] = opt.values[0];
        }
      });
    }

    // Override size to Medium if available
    const sizeOption = currentProduct.options.find(
      (opt) => opt.name.toLowerCase() === 'size'
    );
    if (sizeOption?.values) {
      const mediumValue = sizeOption.values.find(
        (v) => v.toLowerCase() === 'medium' || v.toLowerCase() === 'm'
      );
      if (mediumValue) {
        initial[sizeOption.name] = mediumValue;
      }
    }

    setSelectedOptions(initial);
  }, [currentProduct?.id, products, selectedProductIndex]);

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
          src="/brand-logos/odubo-brand/odubo.svg"
          alt="Odubo"
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
                {isPreorderActive() && selectedVariant.available && (
                  <p className="text-[#b2a491] text-sm mt-2">{PREORDER_SHIP_TEXT}</p>
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
                ? 'bg-[#843c2d] text-white shadow-[#843c2d]/20'
                : variantInCart
                ? 'bg-white/20 text-white hover:bg-white/30'
                : 'bg-white text-black hover:bg-white/90 active:bg-white/80 shadow-white/10'
            }`}
          >
            {!selectedVariant?.available ? (
              'Sold Out'
            ) : addedFeedback ? (
              <>✓ {isPreorderActive() ? PREORDER_FEEDBACK : 'Added to Bag'}</>
            ) : (
              <span>{variantInCart ? (isPreorderActive() ? PREORDER_CTA_ANOTHER : 'Add Another') : (isPreorderActive() ? PREORDER_CTA : 'Add to Bag')}</span>
            )}
          </motion.button>
        </div>
      </div>

      {/* Details Modal */}
      <DetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        descriptionHtml={currentProduct.descriptionHtml}
      />
    </motion.div>
  );
}

// ============================================
