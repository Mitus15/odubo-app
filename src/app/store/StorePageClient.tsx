'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';
import VinylMiniPlayer from '@/components/player/VinylMiniPlayer';
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
  isAdmin: boolean;
  initialProducts: ProductCard[];
}

// Full-screen scrollable product viewer (like clips feed)
function ProductFeedModal({
  products,
  initialIndex,
  productDetails,
  onClose,
  onIndexChange,
  selectedOptions,
  openOption,
  setOpenOption,
  updateOption,
  selectedVariant,
  detailLoading,
  detailError,
  addToCart,
  addFeedback,
  setCtaReady,
}: {
  products: ProductCard[];
  initialIndex: number;
  productDetails: Record<string, any>;
  onClose: () => void;
  onIndexChange: (idx: number) => void;
  selectedOptions: Record<string, string>;
  openOption: string | null;
  setOpenOption: (opt: string | null) => void;
  updateOption: (name: string, value: string) => void;
  selectedVariant: any;
  detailLoading: boolean;
  detailError: string | null;
  addToCart: () => void;
  addFeedback: string | null;
  setCtaReady: (ready: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const hasScrolledRef = useRef(false);

  // Scroll to initial product on mount
  useEffect(() => {
    if (!hasScrolledRef.current && containerRef.current) {
      const target = containerRef.current.querySelector(`[data-product-index="${initialIndex}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'instant', block: 'start' });
        hasScrolledRef.current = true;
      }
    }
  }, [initialIndex]);

  // Detect which product is centered after scroll ends
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const containerRect = container.getBoundingClientRect();
        const centerY = containerRect.top + containerRect.height / 2;

        let closestIdx = activeIndex;
        let closestDist = Infinity;

        container.querySelectorAll('[data-product-index]').forEach((el) => {
          const rect = el.getBoundingClientRect();
          const elCenter = rect.top + rect.height / 2;
          const dist = Math.abs(elCenter - centerY);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = parseInt((el as HTMLElement).dataset.productIndex || '0', 10);
          }
        });

        if (closestIdx !== activeIndex) {
          setActiveIndex(closestIdx);
          onIndexChange(closestIdx);
        }
      }, 50);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [activeIndex, onIndexChange]);

  const currentProduct = products[activeIndex];
  const currentDetail = currentProduct ? productDetails[currentProduct.handle] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Close button */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="fixed top-4 right-4 z-[60] text-white bg-black/50 hover:bg-black/70 rounded-full p-3 backdrop-blur-sm border border-white/20"
        style={{ top: 'calc(env(safe-area-inset-top, 16px) + 16px)' }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Product counter */}
      <div
        className="fixed top-4 left-4 z-[60] text-white/60 text-xs font-medium"
        style={{ top: 'calc(env(safe-area-inset-top, 16px) + 20px)' }}
      >
        {activeIndex + 1} / {products.length}
      </div>

      {/* Scrollable product feed */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto overflow-x-hidden"
        style={{
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {products.map((product, idx) => {
          const detail = productDetails[product.handle];
          const isActive = idx === activeIndex;
          const variant = isActive ? selectedVariant : detail?.variants?.[0];

          return (
            <section
              key={product.id}
              data-product-index={idx}
              className="w-full flex flex-col"
              style={{
                height: '100dvh',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
              }}
            >
              {/* Product Image - Top half */}
              <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] p-4">
                {product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={variant?.image || product.image}
                    alt={product.title}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-[#502d26] text-xs uppercase tracking-widest">No Image</div>
                )}
              </div>

              {/* Product Info - Bottom section */}
              <div className="bg-[#0f0b0b] border-t border-white/10 p-4 pb-8 space-y-3" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
                <div>
                  <h2 className="text-lg font-semibold text-[#f7f3ec]">{product.title}</h2>
                  {variant && (
                    <p className="text-base font-medium text-[#b2a491]">
                      ${typeof variant.price === 'number' ? variant.price.toFixed(2) : variant.price}
                    </p>
                  )}
                  {!product.available && (
                    <p className="text-xs text-red-300 mt-1">Sold Out</p>
                  )}
                </div>

                {/* Options - only show for active product */}
                {isActive && detail?.options?.map((opt: any) => {
                  const open = openOption === opt.name;
                  return (
                    <div key={opt.name} className="border border-white/10 rounded-xl bg-white/5 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenOption(open ? null : opt.name);
                          setCtaReady(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-semibold text-[#f7f3ec]"
                      >
                        <span>{opt.name}: {selectedOptions[opt.name] || '—'}</span>
                        <span className="text-[#d7cfc3] text-xs">{open ? '−' : '+'}</span>
                      </button>
                      {open && (
                        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                          {opt.values?.map((val: string) => {
                            const active = selectedOptions[opt.name] === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => updateOption(opt.name, val)}
                                className={`px-2.5 py-1 rounded-lg text-xs transition-all border ${active ? 'bg-gradient-to-r from-[#843c2d] via-[#a44e3a] to-[#52241d] text-[#f8f2ea] border-[#c58a70]/60' : 'text-[#e1d6c8] border-white/15 bg-white/5'}`}
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

                {isActive && detailLoading && (
                  <p className="text-xs text-[#c7b8a8]">Loading…</p>
                )}

                {/* CTA buttons */}
                {isActive && openOption === null && (
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={addToCart}
                      disabled={!selectedVariant || selectedVariant.available === false || !product.available}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${product.available && selectedVariant?.available !== false ? 'bg-gradient-to-r from-[#843c2d] via-[#a44e3a] to-[#52241d] text-[#f8f2ea]' : 'bg-white/5 text-[#666] cursor-not-allowed'}`}
                    >
                      {addFeedback || (!product.available ? 'Sold Out' : 'Add to Bag')}
                    </button>

                    <Link
                      href="/store/cart"
                      className="px-4 py-3 rounded-xl border border-white/20 text-[#f8f2ea] bg-white/5 text-sm font-medium"
                      onClick={onClose}
                    >
                      Bag
                    </Link>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function StorePageClient({ isStoreOpen, isAdmin, initialProducts }: StorePageClientProps) {
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
              {/* Admin viewing badge */}
              {isAdmin && (
                <div className="mb-6 inline-block px-4 py-2 bg-[#843c2d]/20 border border-[#843c2d]/40 rounded-full">
                  <span className="text-xs uppercase tracking-widest text-[#ede8df]">
                    👑 Admin Preview - Store Unpublished
                  </span>
                </div>
              )}
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

              {/* Designer Access - hidden for admins */}
              {!isAdmin && (
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
              )}
            </div>
          </div>
        </ScrollContainer>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      {/* Admin indicator when viewing unpublished store */}
      {isAdmin && !isStoreOpen && (
        <div className="fixed top-20 right-4 z-50 px-3 py-1.5 bg-[#843c2d]/90 border border-[#843c2d] rounded-full shadow-lg">
          <span className="text-[10px] uppercase tracking-widest text-[#ede8df]">
            Admin Preview
          </span>
        </div>
      )}

      {/* BAAD by Odubo background: soft gradients and glow lights */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0b0b0b] via-[#111111] to-[#0b0b0b]" />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-[#843c2d33] via-[#ff8a4a22] to-transparent blur-3xl" />
        <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-gradient-to-br from-[#b2a49122] via-[#ede8df1a] to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-96 w-[36rem] rounded-[999px] bg-gradient-to-tr from-[#843c2d22] via-transparent to-[#ede8df11] blur-3xl" />
      </div>
      {/* Fixed Header - BAAD logo + Bag button - positioned below main AppHeader (56px / h-14) */}
      <header className="fixed left-0 right-0 z-30 bg-[#0b0b0b] top-14">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
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
        </div>
      </header>

      <ScrollContainer>
        {/* Content area with consistent spacing */}
        <div 
          className="pt-16 pb-40"
          style={{ paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* Loading state */}
          {loading && (
            <div className="p-3">
              <div 
                className="grid grid-cols-2 lg:grid-cols-3"
                style={{ gap: '12px' }}
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div 
                    key={i} 
                    className="aspect-square rounded-lg bg-[#1a1614] animate-pulse"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Product Grid */}
          {!loading && filteredProducts.length > 0 && (
            <div className="p-3">
              <div 
                className="grid grid-cols-2 lg:grid-cols-3"
                style={{ gap: '12px' }}
              >
                {filteredProducts.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className="group relative aspect-square rounded-lg overflow-hidden bg-[#0d0b0a] focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50"
                  >
                    {/* Product Image */}
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={p.image} 
                        alt={p.title} 
                        className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.03]" 
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#1a1614]">
                        <span className="text-[#502d26] text-[10px] uppercase tracking-widest">No Image</span>
                      </div>
                    )}

                    {/* Sold Out Overlay */}
                    {!p.available && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="px-3 py-1.5 bg-[#0d0b0a]/90 rounded-full text-[#ede8df] text-[10px] uppercase tracking-widest border border-[#502d26]/50">
                          Sold Out
                        </span>
                      </div>
                    )}

                    {/* Subtle hover glow */}
                    <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/5 group-hover:ring-[#843c2d]/30 transition-all duration-300" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-[#502d26]">
              <p className="text-xs uppercase tracking-widest">No products available</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-center justify-center min-h-[50vh]">
              <p className="text-red-400/80 text-sm">{error}</p>
            </div>
          )}
        </div>
      </ScrollContainer>

      {/* Floating Vinyl Player - shows when music is playing */}
      <div
        className="fixed z-40 pointer-events-auto"
        style={{
          left: '1rem',
          bottom: 'calc(140px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <VinylMiniPlayer />
      </div>

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

      {/* Full-screen product viewer - scrollable like clips feed */}
      {selectedIndex !== null && (
        <ProductFeedModal
          products={filteredProducts}
          initialIndex={selectedIndex}
          productDetails={productDetails}
          onClose={() => setSelectedIndex(null)}
          onIndexChange={(idx) => {
            setSelectedIndex(idx);
            if (filteredProducts[idx]) {
              ensureDetail(filteredProducts[idx].handle);
            }
          }}
          selectedOptions={selectedOptions}
          openOption={openOption}
          setOpenOption={setOpenOption}
          updateOption={updateOption}
          selectedVariant={selectedVariant}
          detailLoading={detailLoading}
          detailError={detailError}
          addToCart={addToCart}
          addFeedback={addFeedback}
          setCtaReady={setCtaReady}
        />
      )}
    </ScreenLayout>
  );
}
