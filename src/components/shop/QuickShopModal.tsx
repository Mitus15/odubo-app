'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuickShop } from '@/contexts/QuickShopContext';
import Link from 'next/link';

interface ProductDetail {
  id: string;
  title: string;
  handle: string;
  images: string[];
  options: { name: string; values: string[] }[];
  variants: {
    id: string;
    title: string;
    price: number;
    currency: string;
    available: boolean;
    quantityAvailable: number;
    selectedOptions: Record<string, string>;
    image: string | null;
  }[];
}

export default function QuickShopModal() {
  const { isOpen, productHandle, closeQuickShop } = useQuickShop();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [openOption, setOpenOption] = useState<string | null>(null);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);

  // Fetch product when handle changes
  useEffect(() => {
    if (!productHandle || !isOpen) {
      setProduct(null);
      setSelectedOptions({});
      setOpenOption(null);
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

        if (!res.ok) throw new Error(`Failed to load product`);
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

        // Initialize options to first variant
        if (detail.options?.length) {
          const initial: Record<string, string> = {};
          detail.options.forEach((opt) => {
            initial[opt.name] = opt.values?.[0];
          });
          setSelectedOptions(initial);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productHandle, isOpen]);

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
  }, []);

  const addToCart = useCallback(() => {
    if (!product || !selectedVariant) return;
    try {
      const raw = localStorage.getItem('cart') || '[]';
      const parsed = JSON.parse(raw);
      const cart: any[] = Array.isArray(parsed) ? parsed : [];
      const existing = cart.find((c) => c.variantId === selectedVariant.id);
      const base = {
        variantId: selectedVariant.id,
        qty: 1,
        title: `${product.title} — ${selectedVariant.title}`,
        price: selectedVariant.price,
        image: selectedVariant.image || product.images[0],
      };
      const nextCart = existing
        ? cart.map((c) =>
            c.variantId === selectedVariant.id ? { ...c, qty: c.qty + 1 } : c
          )
        : [...cart, base];
      localStorage.setItem('cart', JSON.stringify(nextCart));
      setAddFeedback('Added to bag');
      setTimeout(() => setAddFeedback(null), 1800);
    } catch (e) {
      console.error('Add to cart failed', e);
    }
  }, [product, selectedVariant]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeQuickShop();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeQuickShop]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{
            paddingTop: 'calc(80px + env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 16px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 16px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 16px))',
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90"
            onClick={closeQuickShop}
          />
          <div className="absolute inset-0 backdrop-blur-xl pointer-events-none" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-lg max-h-full flex flex-col"
          >
            {/* Close button */}
            <button
              onClick={closeQuickShop}
              className="absolute -top-2 -right-2 z-30 text-[#0b0b0b] bg-[#f8f2ea] hover:bg-white rounded-full p-2.5 border border-white/60 shadow-2xl transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="relative w-full max-h-[calc(100dvh-140px)] overflow-y-auto rounded-2xl glass-surface border border-white/10 bg-[#0f0b0b]/95 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
              {/* Loading state */}
              {loading && (
                <div className="flex items-center justify-center p-12">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {/* Error state */}
              {error && !loading && (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <p className="text-red-300 text-sm mb-4">{error}</p>
                  <button
                    onClick={closeQuickShop}
                    className="px-4 py-2 rounded-lg border border-white/20 text-[#f8f2ea] bg-white/5 hover:bg-white/10 transition-colors text-sm"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Product content */}
              {product && !loading && !error && (
                <div className="p-4 sm:p-6 text-[#ede8df] space-y-4">
                  {/* Product image */}
                  <div className="w-full bg-[#0f0b0b] rounded-xl flex items-center justify-center p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedVariant?.image || product.images[0] || ''}
                      alt={product.title}
                      className="w-full max-h-[30vh] object-contain"
                    />
                  </div>

                  {/* Title and price */}
                  <div className="space-y-1">
                    <h2 className="text-base sm:text-lg font-semibold leading-tight text-[#f7f3ec]">
                      {product.title}
                    </h2>
                    {selectedVariant && (
                      <p className="text-sm font-medium text-[#f7f3ec]">
                        ${selectedVariant.price.toFixed(2)}
                      </p>
                    )}
                    {selectedVariant?.available === false && (
                      <p className="text-xs text-red-200/80">Currently unavailable</p>
                    )}
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    {product.options?.map((opt) => {
                      const open = openOption === opt.name;
                      return (
                        <div
                          key={opt.name}
                          className="glass-surface border border-white/10 rounded-xl bg-white/5 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setOpenOption(open ? null : opt.name)}
                            className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-semibold text-[#f7f3ec]"
                          >
                            <span>{opt.name}</span>
                            <span className="text-[#d7cfc3] text-xs">{open ? '−' : '+'}</span>
                          </button>
                          {open && (
                            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                              {opt.values?.map((val) => {
                                const active = selectedOptions[opt.name] === val;
                                return (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => updateOption(opt.name, val)}
                                    className={`px-2.5 py-1 rounded-lg text-xs transition-all border ${
                                      active
                                        ? 'bg-gradient-to-r from-[#843c2d] via-[#a44e3a] to-[#52241d] text-[#f8f2ea] border-[#c58a70]/60 shadow-[0_10px_28px_rgba(0,0,0,0.35)]'
                                        : 'text-[#e1d6c8] border-white/15 bg-white/5 hover:bg-white/10'
                                    }`}
                                  >
                                    {val}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* CTA buttons - visible when options closed */}
                  {openOption === null && (
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={addToCart}
                        disabled={!selectedVariant || selectedVariant.available === false}
                        className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border ${
                          selectedVariant?.available !== false
                            ? 'bg-gradient-to-r from-[#843c2d] via-[#a44e3a] to-[#52241d] text-[#f8f2ea] border-[#c58a70]/50 shadow-[0_12px_30px_rgba(0,0,0,0.35)] hover:scale-[1.02] active:scale-[0.98]'
                            : 'bg-white/5 text-[#c7b8a8] border-white/10 cursor-not-allowed'
                        }`}
                      >
                        {addFeedback || (selectedVariant?.available === false ? 'Unavailable' : 'Add to Bag')}
                      </button>

                      <Link
                        href="/store/cart"
                        className="px-4 py-2.5 rounded-lg border border-white/20 text-[#f8f2ea] bg-white/5 hover:bg-white/10 transition-colors text-sm text-center"
                        onClick={closeQuickShop}
                      >
                        Go to Bag
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
