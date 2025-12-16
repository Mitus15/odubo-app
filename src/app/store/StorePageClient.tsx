'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';
import Link from 'next/link';

interface ProductCard {
  id: string;
  title: string;
  handle: string;
  image: string | null;
  price: number | null;
  available: boolean;
  createdAt: string;
}

interface StorePageClientProps {
  isStoreOpen: boolean;
  initialProducts: ProductCard[];
}

export default function StorePageClient({ isStoreOpen, initialProducts }: StorePageClientProps) {
  const [timeLeft, setTimeLeft] = useState({
    weeks: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [products, setProducts] = useState<ProductCard[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [productDetails, setProductDetails] = useState<Record<string, any>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [openOption, setOpenOption] = useState<string | null>(null);
  const [optionsHandle, setOptionsHandle] = useState<string | null>(null);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);
  const [ctaReady, setCtaReady] = useState(false);
  const prevSelectedIndex = useRef<number | null>(null);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'odubo') {
      setIsUnlocked(true);
      setUnlockError('');
    } else {
      setUnlockError('Incorrect password');
    }
  };

  useEffect(() => {
    const targetDate = new Date('2026-03-14T00:00:00').getTime();
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;
      
      if (difference > 0) {
        const weeks = Math.floor(difference / (1000 * 60 * 60 * 24 * 7));
        const days = Math.floor((difference % (1000 * 60 * 60 * 24 * 7)) / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft({ weeks, days, hours, minutes, seconds });
      } else {
        setTimeLeft({ weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const filteredProducts = useMemo(() => products.filter(Boolean), [products]);

  const selectedProduct = selectedIndex !== null ? filteredProducts[selectedIndex] : null;
  const selectedDetail = selectedProduct ? productDetails[selectedProduct.handle] : null;

  const selectedVariant = useMemo(() => {
    if (!selectedDetail?.variants?.length || !selectedDetail?.options) return null;
    return selectedDetail.variants.find((v: any) => {
      return Object.entries(selectedOptions).every(([k, val]) => v.selectedOptions?.[k] === val);
    }) || selectedDetail.variants[0];
  }, [selectedDetail, selectedOptions]);

  const ensureDetail = async (handle: string) => {
    if (productDetails[handle]) return;
    try {
      setDetailLoading(true);
      setDetailError(null);
      const STORE_URL = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
      const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
      if (!PUBLIC_TOKEN) throw new Error('Missing Shopify token');

      const query = `#graphql\n        query Product($handle: String!) {\n          product(handle: $handle) {\n            id title handle description availableForSale\n            images(first: 10) { edges { node { url } } }\n            options { name values }\n            variants(first: 30) { edges { node {\n              id title availableForSale quantityAvailable\n              price { amount currencyCode }\n              selectedOptions { name value }\n              image { url }\n            }}}\n          }\n        }`;

      const res = await fetch(`${STORE_URL}/api/2024-07/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
        },
        body: JSON.stringify({ query, variables: { handle } }),
      });

      if (!res.ok) throw new Error(`Shopify ${res.status}`);
      const data = await res.json();
      const p = data?.data?.product;
      if (!p) throw new Error('Product not found');

      const detail = {
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
          selectedOptions: v.selectedOptions?.reduce((acc: any, cur: any) => ({ ...acc, [cur.name]: cur.value }), {}),
          image: v.image?.url || null,
        })) || [],
      };

      setProductDetails(prev => ({ ...prev, [handle]: detail }));
      // Initialize options to first variant
      if (detail.options?.length) {
        const initial: Record<string, string> = {};
        detail.options.forEach((opt: any) => { initial[opt.name] = opt.values?.[0]; });
        setSelectedOptions(initial);
        setOpenOption(detail.options[0]?.name || null);
      }
    } catch (e: any) {
      setDetailError(e?.message || 'Failed to load product');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProduct) {
      ensureDetail(selectedProduct.handle);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.handle]);

  // Reset ALL modal state when selectedIndex changes (open, close, or switch)
  useEffect(() => {
    // Always reset on any change to selectedIndex
    setOpenOption(null);
    setCtaReady(false);
    setAddFeedback(null);
    setSelectedOptions({});
  }, [selectedIndex]);

  // Initialize default options when product details load (after reset above)
  useEffect(() => {
    if (!selectedProduct) return;

    const detail = productDetails[selectedProduct.handle];
    if (!detail?.options?.length) return;

    // Set defaults for this product
    const defaults: Record<string, string> = {};
    detail.options.forEach((opt: any) => {
      defaults[opt.name] = opt.values?.[0];
    });
    setSelectedOptions(defaults);
  }, [selectedProduct?.handle, productDetails]);

  const updateOption = (name: string, value: string) => {
    setSelectedOptions(prev => ({ ...prev, [name]: value }));
  };

  const addToCart = () => {
    if (!selectedProduct || !selectedVariant) return;
    try {
      const raw = localStorage.getItem('cart') || '[]';
      const parsed = JSON.parse(raw);
      const cart: any[] = Array.isArray(parsed) ? parsed : [];
      const existing = cart.find((c) => c.variantId === selectedVariant.id);
      const base = {
        variantId: selectedVariant.id,
        qty: 1,
        title: `${selectedProduct.title} — ${selectedVariant.title}`,
        price: selectedVariant.price,
        image: selectedVariant.image || selectedProduct.image,
      };
      const nextCart = existing
        ? cart.map(c => c.variantId === selectedVariant.id ? { ...c, qty: c.qty + 1 } : c)
        : [...cart, base];
      localStorage.setItem('cart', JSON.stringify(nextCart));
      setAddFeedback('✓ Added to bag');
      setTimeout(() => setAddFeedback(null), 1800);
    } catch (e) {
      console.error('Add to cart failed', e);
    }
  };

  if (!isStoreOpen && !isUnlocked) {
    return (
      <ScreenLayout>
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
        <ScrollContainer>
          <div className="max-w-4xl mx-auto px-6 py-20 text-center">
            <div className="glass-surface rounded-3xl border border-[#502d26]/30 p-10 backdrop-blur-md bg-[#1c1a19]/80">
              <h1 className="text-3xl sm:text-4xl font-bold text-[#ede8df] mb-8 tracking-tight">Store Opening Soon</h1>
              
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
                {Object.entries(timeLeft).map(([unit, value]) => (
                  <div key={unit} className="glass-surface rounded-2xl border border-[#502d26]/20 p-4 bg-[#302927]/20">
                    <div className="text-3xl sm:text-4xl font-bold text-[#ede8df] tabular-nums">{value}</div>
                    <div className="text-xs text-[#b2a491] mt-1 uppercase tracking-wider">{unit}</div>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                <Link href="/" className="px-6 py-3 rounded-xl bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60 hover:text-[#ede8df] transition-all duration-300">
                  Return Home
                </Link>
              </div>

              {/* Designer Access */}
              <form onSubmit={handleUnlock} className="max-w-xs mx-auto mt-12 pt-8 border-t border-[#502d26]/20">
                <p className="text-[10px] text-[#b2a491] mb-3 uppercase tracking-[0.2em]">Designer Access</p>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password"
                    className="flex-1 bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d] transition-colors placeholder:text-[#502d26]"
                  />
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-[#843c2d]/20 text-[#ede8df] rounded-lg hover:bg-[#843c2d]/40 text-sm font-medium transition-colors"
                  >
                    Enter
                  </button>
                </div>
                {unlockError && <p className="text-red-400 text-xs mt-2">{unlockError}</p>}
              </form>
            </div>
          </div>
        </ScrollContainer>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      {/* BAAD by Odubo background: soft gradients and glow lights */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0b0b0b] via-[#111111] to-[#0b0b0b]" />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-[#843c2d33] via-[#ff8a4a22] to-transparent blur-3xl" />
        <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-gradient-to-br from-[#b2a49122] via-[#ede8df1a] to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-96 w-[36rem] rounded-[999px] bg-gradient-to-tr from-[#843c2d22] via-transparent to-[#ede8df11] blur-3xl" />
      </div>
      <ScrollContainer>
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-6">
          {/* Brand row under nav */}
          <header className="mb-6 mt-2">
            <div className="flex items-center justify-between px-1 sm:px-2 lg:px-4">
              <div className="flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand-logos/baad.png" alt="B.A.A.D" className="h-8 sm:h-10 w-auto" />
              </div>
              <Link
                href="/store/cart"
                className="text-[10px] sm:text-xs uppercase tracking-widest text-[#ede8df]/80 hover:text-[#ede8df] transition-colors"
              >
                Bag
              </Link>
            </div>
          </header>

          {/* Product Grid - bottom padding accounts for fixed footer (~140px) + safe area */}
          <div className="min-h-[60vh] max-w-7xl mx-auto" style={{ paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 0px))' }}>
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0.5 sm:gap-x-5 sm:gap-y-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="aspect-[3/4] bg-[#1c1a19]/20 animate-pulse rounded-sm" />
                ))}
              </div>
            )}
            
            {!loading && filteredProducts.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0.5 sm:gap-x-5 sm:gap-y-1">
                {filteredProducts.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`group block text-left w-full ${p.available === false ? 'opacity-60' : ''}`}
                  >
                    {/* Image only, no card background */}
                    <div className="relative aspect-[3/4] overflow-hidden mb-1 sm:mb-2 flex items-center justify-center bg-transparent isolate">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={p.image} 
                          alt={p.title} 
                          className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-[1.02] mix-blend-multiply brightness-[1.05] contrast-[1.1]" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#502d26] bg-[#1c1a19]/20">
                          <span className="uppercase tracking-widest text-xs">No Image</span>
                        </div>
                      )}
                      {/* New Badge */}
                      {p.available && (new Date(p.createdAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000) && (
                        <div className="absolute top-0 left-0 p-2 sm:p-3">
                          <span className="px-2 py-1 rounded-full bg-gradient-to-r from-[#843c2d] to-[#b26a4a] text-[#ede8df] text-[9px] sm:text-[10px] uppercase tracking-widest">
                            New
                          </span>
                        </div>
                      )}

                      {!p.available && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="px-3 py-1.5 sm:px-3 sm:py-1 bg-[#1c1a19]/80 rounded-full text-[#ede8df] text-[10px] sm:text-xs uppercase tracking-widest border border-[#502d26]">
                            Sold Out
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {!loading && !error && filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-[#502d26]">
                <p className="uppercase tracking-widest text-sm">No products available</p>
              </div>
            )}
            
            {error && (
              <div className="text-center text-red-400 py-8">{error}</div>
            )}
          </div>
        </div>
      </ScrollContainer>

      {/* Footer - OUTSIDE ScrollContainer, truly fixed at bottom with safe area */}
      <footer 
        className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="pointer-events-auto max-w-7xl mx-auto px-4 sm:px-6">
          <div className="rounded-t-2xl border border-[#502d26]/25 bg-[#0b0b0b]/95 backdrop-blur-xl px-4 sm:px-6 py-4 text-center space-y-3">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#b2a491]/70">
              B.A.A.D by Odubo
            </p>
            <div className="flex items-center justify-center gap-6 text-[10px] sm:text-xs text-[#b2a491]/60">
              <Link href="/legal" className="hover:text-[#ede8df] transition-colors">
                Privacy Policy
              </Link>
              <span className="text-[#502d26]/30">•</span>
              <Link href="/legal?tab=terms" className="hover:text-[#ede8df] transition-colors">
                Terms of Service
              </Link>
              <span className="text-[#502d26]/30">•</span>
              <Link href="/legal?tab=shipping" className="hover:text-[#ede8df] transition-colors">
                Shipping & Returns
              </Link>
            </div>
            <p className="text-[9px] text-[#502d26]/40">
              © {new Date().getFullYear()} Odubo Studio. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Modal viewer (rebuilt) - accounts for safe viewport areas on mobile Safari/Chrome */}
      {selectedIndex !== null && filteredProducts[selectedIndex] && (
        <div 
          key={`modal-${selectedIndex}`} 
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center" 
          role="dialog" 
          aria-modal="true" 
          aria-label={selectedProduct?.title || 'Product detail'}
          style={{ 
            paddingTop: 'max(1rem, env(safe-area-inset-top, 16px))', 
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 16px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 16px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 16px))'
          }}
        >
          <div className="absolute inset-0 bg-black/85" aria-hidden onClick={() => setSelectedIndex(null)} />
          <div className="absolute inset-0 backdrop-blur-xl" aria-hidden />

          <div className="relative w-full max-w-6xl max-h-full flex flex-col">
            {/* Close button - fixed at top right, always visible above modal content */}
            <button
              aria-label="Close"
              onClick={() => setSelectedIndex(null)}
              className="absolute top-0 right-0 z-30 text-[#0b0b0b] bg-[#f8f2ea] hover:bg-white rounded-full p-3 border border-white/60 shadow-2xl"
              style={{ marginTop: '0.5rem', marginRight: '0.5rem' }}
            >
              ✕
            </button>
            
            <div className="relative w-full max-h-[calc(100dvh-4rem)] sm:max-h-[90vh] overflow-y-auto rounded-3xl glass-surface border border-white/10 bg-[#0f0b0b]/95 shadow-[0_30px_120px_rgba(0,0,0,0.45)] pt-12 sm:pt-4">

              <div className="grid md:grid-cols-[1.1fr_1fr] gap-0">
                <div className="w-full h-full bg-[#0f0b0b] flex items-center justify-center p-4 sm:p-8">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(selectedVariant?.image || selectedProduct?.image || selectedDetail?.images?.[0]) ?? ''}
                    alt={selectedProduct?.title || ''}
                    className="w-full h-full max-h-[70vh] object-contain"
                  />
                </div>

                <div className="w-full p-6 sm:p-8 text-[#ede8df] space-y-5 pb-10">
                  <div className="space-y-1">
                    <h2 className="text-base sm:text-lg font-semibold leading-tight text-[#f7f3ec] line-clamp-2">{selectedProduct?.title}</h2>
                    {selectedVariant && (
                      <p className="text-sm sm:text-base font-medium text-[#f7f3ec]">{selectedVariant.price !== null ? `$${selectedVariant.price.toFixed(2)}` : 'Price on request'}</p>
                    )}
                    {selectedVariant?.available === false && (
                      <p className="text-xs text-red-200/80">Currently unavailable</p>
                    )}
                  </div>

                  <div className="space-y-3 pb-4">
                    {selectedDetail?.options?.map((opt: any) => {
                      const open = openOption === opt.name;
                      return (
                        <div key={opt.name} className="glass-surface border border-white/10 rounded-2xl bg-white/5 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenOption(open ? null : opt.name);
                              setCtaReady(true);
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[#f7f3ec]"
                          >
                            <span>{opt.name}</span>
                            <span className="text-[#d7cfc3] text-xs">{open ? '−' : '+'}</span>
                          </button>
                          {open && (
                            <div className="px-4 pb-3 flex flex-wrap gap-2">
                              {opt.values?.map((val: string) => {
                                const active = selectedOptions[opt.name] === val;
                                return (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => updateOption(opt.name, val)}
                                    className={`px-3 py-1.5 rounded-xl text-sm transition-all border ${active ? 'bg-gradient-to-r from-[#843c2d] via-[#a44e3a] to-[#52241d] text-[#f8f2ea] border-[#c58a70]/60 shadow-[0_10px_28px_rgba(0,0,0,0.35)]' : 'text-[#e1d6c8] border-white/15 bg-white/5 hover:bg-white/10'}`}
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

                  {detailLoading && (
                    <p className="text-xs text-[#c7b8a8]">Loading variants…</p>
                  )}
                  {detailError && (
                    <p className="text-xs text-red-300">{detailError}</p>
                  )}

                  {ctaReady && openOption === null && (
                    <div className="flex flex-wrap justify-center gap-3 text-center">
                      <button
                        type="button"
                        onClick={addToCart}
                        disabled={!selectedVariant || selectedVariant.available === false}
                        className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all border ${selectedVariant?.available !== false ? 'bg-gradient-to-r from-[#843c2d] via-[#a44e3a] to-[#52241d] text-[#f8f2ea] border-[#c58a70]/50 shadow-[0_12px_30px_rgba(0,0,0,0.35)] hover:scale-[1.02]' : 'bg-white/5 text-[#c7b8a8] border-white/10 cursor-not-allowed'}`}
                      >
                        {addFeedback || (selectedVariant?.available === false ? 'Unavailable' : 'Add to Bag')}
                      </button>

                      <Link
                        href="/store/cart"
                        className="px-5 py-3 rounded-xl border border-white/20 text-[#f8f2ea] bg-white/5 hover:bg-white/10 transition-colors text-sm"
                        onClick={() => setSelectedIndex(null)}
                      >
                        Go to Bag
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ScreenLayout>
  );
}
