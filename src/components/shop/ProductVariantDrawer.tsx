'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOmniShop, type ProductDetail } from '@/contexts/OmniShopContext';

interface ProductVariantDrawerProps {
  productHandle: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductVariantDrawer({ productHandle, isOpen, onClose }: ProductVariantDrawerProps) {
  const { addToCart, openCart, getCachedProduct, cacheProduct } = useOmniShop();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [addFeedback, setAddFeedback] = useState<string | null>(null);

  // Fetch product details
  useEffect(() => {
    if (!isOpen || !productHandle) return;

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
        const data: any = await res.json();
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
  }, [productHandle, isOpen, getCachedProduct, cacheProduct]);

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

  const handleAddToBag = useCallback(() => {
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-lg max-h-[85vh] glass-surface-light border-t border-white/10 rounded-t-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="text-[#ede8df] text-sm font-medium">Select Options</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-[#b2a491]/60 hover:text-[#ede8df] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading && (
                <div className="p-6 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#b2a491]/20 border-t-[#b2a491]"></div>
                  <p className="text-[#b2a491]/60 text-xs mt-2 uppercase tracking-wide">Loading...</p>
                </div>
              )}

              {error && (
                <div className="p-6 text-center">
                  <p className="text-[#843c2d] text-sm">{error}</p>
                </div>
              )}

              {product && !loading && !error && (
                <div className="p-6 space-y-6">
                  {/* Product Image & Info */}
                  <div className="flex gap-4">
                    {displayImage && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#302927]/20">
                        <img
                          src={displayImage}
                          alt={product.title}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="text-[#ede8df] text-base font-medium leading-tight mb-1">
                        {product.title}
                      </h4>
                      {selectedVariant && (
                        <p className="text-[#b2a491] text-sm">
                          ${selectedVariant.price.toFixed(2)} USD
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Availability */}
                  {selectedVariant?.available === false && (
                    <p className="text-[#843c2d]/60 text-xs uppercase tracking-[0.15em]">
                      Currently unavailable
                    </p>
                  )}

                  {/* Options */}
                  {product.options?.length > 0 && (
                    <div className="space-y-4">
                      {product.options.map((opt) => (
                        <div key={opt.name}>
                          <label className="text-xs uppercase tracking-[0.2em] text-[#b2a491]/60 mb-2 block">
                            {opt.name}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {opt.values?.map((val) => {
                              const active = selectedOptions[opt.name] === val;
                              
                              // Check if this option combination results in an available variant
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
                                  className={`min-w-[44px] px-3 py-2 rounded-lg text-xs uppercase tracking-[0.1em] transition-all border ${
                                    active
                                      ? 'bg-[#ede8df] text-[#302927] border-[#ede8df]'
                                      : isAvailable
                                        ? 'glass-surface border-[#502d26]/30 text-[#ede8df]/80 hover:bg-[#843c2d]/10'
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
                </div>
              )}
            </div>

            {/* Fixed bottom CTA */}
            {product && !loading && !error && (
              <div className="p-4 border-t border-white/5">
                <button
                  onClick={handleAddToBag}
                  disabled={!selectedVariant || selectedVariant.available === false}
                  className={`w-full py-3 rounded-xl text-xs uppercase tracking-[0.2em] font-medium transition-all ${
                    selectedVariant?.available !== false
                      ? addFeedback === 'Added — Go to Bag'
                        ? 'bg-[#52814a] text-[#ede8df] border border-[#52814a]'
                        : 'bg-[#ede8df] text-[#302927] hover:bg-[#ede8df]/90 active:scale-[0.98]'
                      : 'bg-[#302927]/50 text-[#b2a491]/30 border border-[#502d26]/20 cursor-not-allowed'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  {addFeedback || 'Add to Bag'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}