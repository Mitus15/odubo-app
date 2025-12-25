'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useOmniShop, type ProductDetail } from '@/contexts/OmniShopContext';

interface ProductDetailModalProps {
  productHandle: string;
}

export default function ProductDetailModal({ productHandle }: ProductDetailModalProps) {
  const {
    modalStack,
    goBack,
    closeAll,
    addToCart,
    openCart,
    getCachedProduct,
    cacheProduct,
  } = useOmniShop();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [addFeedback, setAddFeedback] = useState<string | null>(null);

  // Check if we came from Maison (show back button) or directly (show close)
  const hasBackStack = modalStack.length > 1;

  // Fetch product
  useEffect(() => {
    // Check cache first
    const cached = getCachedProduct(productHandle);
    if (cached) {
      setProduct(cached);
      initializeOptions(cached);
      return;
    }

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);

      try {
        const STORE_URL = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
        const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

        if (!PUBLIC_TOKEN) throw new Error('Store configuration error');

        const query = `#graphql
          query Product($handle: String!) {
            product(handle: $handle) {
              id title handle description availableForSale
              images(first: 10) { edges { node { url } } }
              options { name values }
              variants(first: 30) { edges { node {
                id title availableForSale quantityAvailable
                price { amount currencyCode }
                selectedOptions { name value }
                image { url }
              }}}
            }
          }`;

        const res = await fetch(`${STORE_URL}/api/2024-07/graphql.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
          },
          body: JSON.stringify({ query, variables: { handle: productHandle } }),
        });

        if (!res.ok) throw new Error('Failed to load product');
        const data = await res.json();
        const p = data?.data?.product;
        if (!p) throw new Error('Product not found');

        const detail: ProductDetail = {
          id: p.id,
          title: p.title,
          handle: p.handle,
          images: p.images?.edges?.map((e: any) => e.node.url) || [],
          options: p.options || [],
          variants: p.variants?.edges?.map(({ node: v }: any) => ({
            id: v.id,
            title: v.title,
            price: parseFloat(v.price.amount),
            currency: v.price.currencyCode,
            available: v.availableForSale,
            quantityAvailable: v.quantityAvailable,
            selectedOptions: v.selectedOptions?.reduce(
              (acc: any, cur: any) => ({ ...acc, [cur.name]: cur.value }),
              {}
            ),
            image: v.image?.url || null,
          })) || [],
        };

        setProduct(detail);
        cacheProduct(productHandle, detail);
        initializeOptions(detail);
      } catch (e: any) {
        setError(e?.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productHandle, getCachedProduct, cacheProduct]);

  const initializeOptions = (detail: ProductDetail) => {
    if (detail.options?.length) {
      const initial: Record<string, string> = {};
      detail.options.forEach((opt) => {
        initial[opt.name] = opt.values?.[0];
      });
      setSelectedOptions(initial);
    }
  };

  // Find selected variant
  const selectedVariant = useMemo(() => {
    if (!product?.variants?.length || !product?.options) return null;
    return (
      product.variants.find((v) =>
        Object.entries(selectedOptions).every(
          ([k, val]) => v.selectedOptions?.[k] === val
        )
      ) || product.variants[0]
    );
  }, [product, selectedOptions]);

  const updateOption = useCallback((name: string, value: string) => {
    setSelectedOptions((prev) => ({ ...prev, [name]: value }));
    setAddFeedback(null); // Reset so user can add the new variant
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!product || !selectedVariant) return;

    // If already added, go to cart
    if (addFeedback === 'Added — Go to Bag') {
      openCart();
      return;
    }

    addToCart({
      variantId: selectedVariant.id,
      title: `${product.title} — ${selectedVariant.title}`,
      price: selectedVariant.price,
      image: selectedVariant.image || product.images[0],
    });
    setAddFeedback('Added — Go to Bag');
  }, [product, selectedVariant, addToCart, addFeedback, openCart]);

  // Image for display - variant image or first product image
  const displayImage = selectedVariant?.image || product?.images[0] || null;

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[120] flex flex-col bg-gradient-to-br from-[#302927]/95 via-[#1a1817] to-[#302927]/95"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Header - glass surface */}
      <header
        className="relative flex items-center justify-between px-4 py-3 glass-surface-light border-b border-white/5"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={hasBackStack ? goBack : closeAll}
          className="w-10 h-10 flex items-center justify-center text-[#ede8df]/60 hover:text-[#ede8df] transition-colors rounded-full hover:bg-white/5"
          aria-label={hasBackStack ? 'Back' : 'Close'}
          style={{ touchAction: 'manipulation' }}
        >
          {hasBackStack ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>

        {/* Centered logo */}
        <img
          src="/brand-logos/baad.png"
          alt="B.A.A.D Brand Logo"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-auto"
          style={{ marginTop: 'calc(env(safe-area-inset-top, 0px) / 2)' }}
          draggable={false}
        />

        <div className="w-10" />
      </header>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="w-8 h-8 border-2 border-[#843c2d]/30 border-t-[#843c2d] rounded-full animate-spin" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
            <p className="text-[#b2a491] text-sm mb-4">{error}</p>
            <button
              onClick={hasBackStack ? goBack : closeAll}
              className="px-5 py-2.5 rounded-xl glass-surface border border-[#502d26]/30 text-[#ede8df] hover:bg-[#843c2d]/10 transition-colors text-sm"
            >
              {hasBackStack ? 'Go Back' : 'Close'}
            </button>
          </div>
        )}

        {/* Product content */}
        {product && !loading && !error && (
          <div className="flex flex-col md:flex-row md:gap-6 md:p-6">
            {/* Product Image - responsive sizing */}
            <div className="w-full md:w-1/2 md:max-w-md aspect-[4/5] md:aspect-square md:rounded-xl bg-gradient-to-b from-[#1a1817] to-[#252220] flex items-center justify-center relative overflow-hidden md:sticky md:top-0">
              {displayImage ? (
                <motion.img
                  key={displayImage}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  src={displayImage}
                  alt={product.title}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              ) : (
                <span className="text-[#b2a491]/30 text-[10px] uppercase tracking-[0.2em]">
                  No Image
                </span>
              )}
            </div>

            {/* Product Info - responsive layout */}
            <div className="px-5 py-6 space-y-6 md:flex-1 md:px-0">
              {/* Title and price */}
              <div className="space-y-2">
                <h2 className="text-[#ede8df] text-lg font-medium tracking-wide">{product.title}</h2>
                {selectedVariant && (
                  <p className="text-[#b2a491] text-base tracking-wide">
                    ${selectedVariant.price.toFixed(2)} USD
                  </p>
                )}
              </div>

              {/* Availability */}
              {selectedVariant?.available === false && (
                <p className="text-[#843c2d]/60 text-xs uppercase tracking-[0.15em]">
                  Currently unavailable
                </p>
              )}

              {/* Options - glass pill buttons */}
              {product.options?.length > 0 && (
                <div className="space-y-5">
                  {product.options.map((opt) => (
                    <div key={opt.name}>
                      <label className="text-[10px] uppercase tracking-[0.2em] text-[#b2a491]/60 mb-3 block">
                        {opt.name}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {opt.values?.map((val) => {
                          const active = selectedOptions[opt.name] === val;
                          const testOptions = { ...selectedOptions, [opt.name]: val };
                          const testVariant = product.variants.find((v) =>
                            Object.entries(testOptions).every(
                              ([k, testVal]) => v.selectedOptions?.[k] === testVal
                            )
                          );
                          const isAvailable = testVariant?.available !== false;

                          return (
                            <button
                              key={val}
                              onClick={() => updateOption(opt.name, val)}
                              className={`min-w-[44px] px-4 py-2.5 rounded-xl text-xs uppercase tracking-[0.1em] transition-all border ${
                                active
                                  ? 'bg-[#ede8df] text-[#302927] border-[#ede8df]'
                                  : isAvailable
                                    ? 'glass-surface border-[#502d26]/30 text-[#ede8df]/80 hover:bg-[#843c2d]/10 active:scale-95'
                                    : 'bg-[#302927]/50 text-[#b2a491]/30 border-[#502d26]/20 line-through cursor-not-allowed'
                              }`}
                              style={{ touchAction: 'manipulation' }}
                              disabled={!isAvailable}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add to Bag Button - moved from bottom */}
              <div className="pt-6 mt-6">
                <button
                  onClick={handleAddToCart}
                  disabled={!selectedVariant || selectedVariant.available === false}
                  className={`w-full py-4 rounded-xl text-xs uppercase tracking-[0.2em] font-medium transition-all ${
                    selectedVariant?.available !== false
                      ? 'bg-[#ede8df] text-[#302927] active:scale-[0.98] hover:bg-[#ede8df]/90'
                      : 'bg-[#302927]/50 text-[#b2a491]/30 cursor-not-allowed'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  {addFeedback || (selectedVariant?.available === false ? 'Sold Out' : 'Add to Bag')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom Legal Links - moved from middle */}
      {product && !loading && !error && (
        <div
          className="px-5 py-4 glass-surface-light border-t border-white/5"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <a
              href="https://odubostudio.myshopify.com/policies/shipping-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#b2a491]/50 hover:text-[#b2a491] transition-colors uppercase tracking-wider"
            >
              Shipping & Returns
            </a>
            <a
              href="https://odubostudio.myshopify.com/policies/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#b2a491]/50 hover:text-[#b2a491] transition-colors uppercase tracking-wider"
            >
              Privacy
            </a>
            <a
              href="https://odubostudio.myshopify.com/policies/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#b2a491]/50 hover:text-[#b2a491] transition-colors uppercase tracking-wider"
            >
              Terms
            </a>
          </div>
        </div>
      )}
    </motion.div>
  );
}
