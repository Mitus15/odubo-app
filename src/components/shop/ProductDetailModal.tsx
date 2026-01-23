'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useOmniShop, type ProductDetail } from '@/contexts/OmniShopContext';
import { extractColorsFromImage, type ExtractedColors } from '@/lib/colorExtraction';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';

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
  const analytics = useAnalyticsSafe();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [addFeedback, setAddFeedback] = useState<string | null>(null);
  const [colors, setColors] = useState<ExtractedColors | null>(null);

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
      title: product.title,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      image: selectedVariant.image || product.images[0],
    });
    setAddFeedback('Added — Go to Bag');
  }, [product, selectedVariant, addToCart, addFeedback, openCart]);

  // Image for display - variant image or first product image
  const displayImage = selectedVariant?.image || product?.images[0] || null;

  // Extract colors from product image for dynamic background
  useEffect(() => {
    if (!displayImage) {
      setColors(null);
      return;
    }

    extractColorsFromImage(displayImage).then(setColors);
  }, [displayImage]);

  // Modal analytics tracking
  const openTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    openTimeRef.current = Date.now();
    analytics?.trackModalOpen('store', { tab: 'product' });

    return () => {
      const duration = Date.now() - openTimeRef.current;
      analytics?.trackModalClose('store', duration, 'unmount');
    };
  }, [analytics]);

  // Dynamic styles based on extracted colors
  const dynamicStyles = useMemo(() => {
    if (!colors) {
      // Default neutral style while loading
      return {
        background: 'linear-gradient(135deg, #f5f3f0 0%, #e8e4df 50%, #ddd8d2 100%)',
        textPrimary: '#1a1817',
        textSecondary: '#4a4540',
        buttonBg: '#1a1817',
        buttonText: '#f5f3f0',
        headerBg: 'rgba(255, 255, 255, 0.8)',
        borderColor: 'rgba(0, 0, 0, 0.08)',
      };
    }

    if (colors.isLight) {
      // Light product → dark UI
      return {
        background: colors.background,
        textPrimary: '#ede8df',
        textSecondary: '#b2a491',
        buttonBg: '#ede8df',
        buttonText: '#1a1817',
        headerBg: 'rgba(30, 28, 26, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      };
    } else {
      // Dark product → light UI
      return {
        background: colors.background,
        textPrimary: '#1a1817',
        textSecondary: '#5a5550',
        buttonBg: '#1a1817',
        buttonText: '#f5f3f0',
        headerBg: 'rgba(255, 255, 255, 0.9)',
        borderColor: 'rgba(0, 0, 0, 0.08)',
      };
    }
  }, [colors]);

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[120] flex flex-col"
      style={{
        touchAction: 'pan-y',
        height: '100dvh',
        overflow: 'hidden',
        background: dynamicStyles.background,
        transition: 'background 500ms ease-out',
      }}
    >
      {/* Header - adapts to product colors */}
      <header
        className="relative flex items-center justify-between px-4 py-3 backdrop-blur-xl"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          backgroundColor: dynamicStyles.headerBg,
          borderBottom: `1px solid ${dynamicStyles.borderColor}`,
          transition: 'background-color 500ms ease-out, border-color 500ms ease-out',
        }}
      >
        <button
          onClick={hasBackStack ? goBack : closeAll}
          className="w-10 h-10 flex items-center justify-center transition-colors rounded-full"
          aria-label={hasBackStack ? 'Back' : 'Close'}
          style={{
            touchAction: 'manipulation',
            color: dynamicStyles.textSecondary,
          }}
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

        {/* Centered logo - inverts based on background */}
        <img
          src="/brand-logos/baad.png"
          alt="B.A.A.D Brand Logo"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-auto transition-all duration-500"
          style={{
            marginTop: 'calc(env(safe-area-inset-top, 0px) / 2)',
            filter: colors?.isLight ? 'invert(0)' : 'invert(1)',
          }}
          draggable={false}
        />

        <div className="w-10" />
      </header>

      {/* Content */}
      <div
        className="flex-1 overscroll-contain"
        style={{
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          minHeight: 0,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          touchAction: 'pan-y',
        }}
      >
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div
              className="w-8 h-8 rounded-full animate-spin"
              style={{
                borderWidth: 2,
                borderColor: `${dynamicStyles.textSecondary}30`,
                borderTopColor: dynamicStyles.textSecondary,
              }}
            />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
            <p className="text-sm mb-4" style={{ color: dynamicStyles.textSecondary }}>{error}</p>
            <button
              onClick={hasBackStack ? goBack : closeAll}
              className="px-5 py-2.5 rounded-xl transition-colors text-sm"
              style={{
                backgroundColor: `${dynamicStyles.textPrimary}10`,
                border: `1px solid ${dynamicStyles.borderColor}`,
                color: dynamicStyles.textPrimary,
              }}
            >
              {hasBackStack ? 'Go Back' : 'Close'}
            </button>
          </div>
        )}

        {/* Product content */}
        {product && !loading && !error && (
          <div className="flex flex-col md:flex-row md:gap-6 md:p-6">
            {/* Product Image - clean, no background - product floats on dynamic gradient */}
            <div className="w-full md:w-1/2 md:max-w-md aspect-[4/5] md:aspect-square md:rounded-xl flex items-center justify-center relative overflow-hidden md:sticky md:top-0">
              {displayImage ? (
                <motion.img
                  key={displayImage}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  src={displayImage}
                  alt={product.title}
                  className="w-full h-full object-contain drop-shadow-2xl"
                  draggable={false}
                />
              ) : (
                <span
                  className="text-[10px] uppercase tracking-[0.2em]"
                  style={{ color: dynamicStyles.textSecondary }}
                >
                  No Image
                </span>
              )}
            </div>

            {/* Product Info - responsive layout */}
            <div className="px-5 py-6 space-y-6 md:flex-1 md:px-0">
              {/* Title and price */}
              <div className="space-y-2">
                <h2
                  className="text-lg font-medium tracking-wide transition-colors duration-500"
                  style={{ color: dynamicStyles.textPrimary }}
                >
                  {product.title}
                </h2>
                {selectedVariant && (
                  <p
                    className="text-base tracking-wide transition-colors duration-500"
                    style={{ color: dynamicStyles.textSecondary }}
                  >
                    ${selectedVariant.price.toFixed(2)} USD
                  </p>
                )}
              </div>

              {/* Availability */}
              {selectedVariant?.available === false && (
                <p className="text-red-500/70 text-xs uppercase tracking-[0.15em]">
                  Currently unavailable
                </p>
              )}

              {/* Options - dynamic buttons */}
              {product.options?.length > 0 && (
                <div className="space-y-5">
                  {product.options.map((opt) => (
                    <div key={opt.name}>
                      <label
                        className="text-[10px] uppercase tracking-[0.2em] mb-3 block transition-colors duration-500"
                        style={{ color: `${dynamicStyles.textSecondary}99` }}
                      >
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
                              className="min-w-[44px] px-4 py-2.5 rounded-xl text-xs uppercase tracking-[0.1em] transition-all active:scale-95"
                              style={{
                                touchAction: 'manipulation',
                                backgroundColor: active
                                  ? dynamicStyles.buttonBg
                                  : isAvailable
                                    ? `${dynamicStyles.textPrimary}10`
                                    : `${dynamicStyles.textSecondary}20`,
                                color: active
                                  ? dynamicStyles.buttonText
                                  : isAvailable
                                    ? dynamicStyles.textPrimary
                                    : `${dynamicStyles.textSecondary}50`,
                                border: `1px solid ${active ? dynamicStyles.buttonBg : dynamicStyles.borderColor}`,
                                textDecoration: !isAvailable ? 'line-through' : 'none',
                                cursor: !isAvailable ? 'not-allowed' : 'pointer',
                              }}
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

              {/* Add to Bag Button - dynamic styling */}
              <div className="pt-6 mt-6">
                <button
                  onClick={handleAddToCart}
                  disabled={!selectedVariant || selectedVariant.available === false}
                  className="w-full py-4 rounded-xl text-xs uppercase tracking-[0.2em] font-medium transition-all active:scale-[0.98]"
                  style={{
                    touchAction: 'manipulation',
                    backgroundColor: selectedVariant?.available !== false
                      ? dynamicStyles.buttonBg
                      : `${dynamicStyles.textSecondary}30`,
                    color: selectedVariant?.available !== false
                      ? dynamicStyles.buttonText
                      : `${dynamicStyles.textSecondary}50`,
                    cursor: selectedVariant?.available === false ? 'not-allowed' : 'pointer',
                  }}
                >
                  {addFeedback || (selectedVariant?.available === false ? 'Sold Out' : 'Add to Bag')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom Legal Links - adapts to product colors */}
      {product && !loading && !error && (
        <div
          className="px-5 py-4 backdrop-blur-xl transition-all duration-500"
          style={{
            paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
            backgroundColor: dynamicStyles.headerBg,
            borderTop: `1px solid ${dynamicStyles.borderColor}`,
          }}
        >
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link
              href="/legal?tab=shipping"
              className="text-[10px] uppercase tracking-wider transition-opacity hover:opacity-100"
              style={{ color: dynamicStyles.textSecondary, opacity: 0.5 }}
            >
              Shipping & Returns
            </Link>
            <Link
              href="/legal"
              className="text-[10px] uppercase tracking-wider transition-opacity hover:opacity-100"
              style={{ color: dynamicStyles.textSecondary, opacity: 0.5 }}
            >
              Privacy
            </Link>
            <Link
              href="/legal?tab=terms"
              className="text-[10px] uppercase tracking-wider transition-opacity hover:opacity-100"
              style={{ color: dynamicStyles.textSecondary, opacity: 0.5 }}
            >
              Terms
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}
