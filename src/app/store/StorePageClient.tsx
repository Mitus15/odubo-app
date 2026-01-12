'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
  category: string;
}

// Shopify productType → Display category (case-insensitive matching)
const CATEGORY_GROUPS: Record<string, string> = {
  // Pants group
  'jeans': 'Pants',
  'trousers': 'Pants',
  'pants': 'Pants',
  // Hoodies group
  'hoodies': 'Hoodies',
  'hoodie': 'Hoodies',
  'sweatshirt': 'Hoodies',
  'sweatshirts': 'Hoodies',
  // T-Shirts (standalone)
  't-shirts': 'T-Shirts',
  't-shirt': 'T-Shirts',
  'tee': 'T-Shirts',
  'tees': 'T-Shirts',
  // Vests (standalone)
  'vests': 'Vests',
  'vest': 'Vests',
};

// Display order for filter pills
const CATEGORY_ORDER = ['All', 'T-Shirts', 'Pants', 'Hoodies', 'Vests'];

// Helper to normalize and map category
function getDisplayCategory(productType: string): string {
  if (!productType) return '';
  const normalized = productType.toLowerCase().trim();
  return CATEGORY_GROUPS[normalized] || productType;
}

interface StorePageClientProps {
  isStoreOpen: boolean;
  isAdmin: boolean;
  initialProducts: ProductCard[];
}

interface ProductFeedModalProps {
  products: ProductCard[];
  selectedHandle: string | null;
  onClose: () => void;
  productDetails: Record<string, any>;
  ensureDetail: (handle: string) => void;
  detailLoading: boolean;
  detailError: string | null;
  selectedOptions: Record<string, string>;
  updateOption: (name: string, value: string) => void;
  openOption: string | null;
  setOpenOption: (opt: string | null) => void;
  addToCart: () => void;
  addFeedback: string | null;
}

/**
 * ProductModal - Simple single product view
 * Shows the selected product directly. No scroll complexity.
 */
function ProductFeedModal({
  products,
  selectedHandle,
  onClose,
  productDetails,
  ensureDetail,
  detailLoading,
  detailError,
  selectedOptions,
  updateOption,
  openOption,
  setOpenOption,
  addToCart,
  addFeedback,
}: ProductFeedModalProps) {
  // Get the product by handle (stable identifier)
  const product = selectedHandle ? products.find(p => p.handle === selectedHandle) : null;
  const detail = product ? productDetails[product.handle] : null;

  // Selected variant
  const selectedVariant = useMemo(() => {
    if (!detail?.variants?.length) return null;
    return detail.variants.find((v: any) => {
      return Object.entries(selectedOptions).every(([k, val]) => v.selectedOptions?.[k] === val);
    }) || detail.variants[0];
  }, [detail, selectedOptions]);

  // Load product details when modal opens
  useEffect(() => {
    if (product && !productDetails[product.handle]) {
      ensureDetail(product.handle);
    }
  }, [product, productDetails, ensureDetail]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (selectedHandle === null || !product) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={product.title}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

      {/* Close button */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 z-50 text-[#0b0b0b] bg-[#f8f2ea] hover:bg-white rounded-full p-2.5 border border-white/60 shadow-2xl"
        style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        ✕
      </button>

      {/* Product counter */}
      <div
        className="absolute left-4 z-50 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white/80 text-xs font-medium"
        style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        {product ? products.findIndex(p => p.handle === product.handle) + 1 : 0} / {products.length}
      </div>

      {/* Product content - centered, no scroll */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-y-auto"
        style={{
          paddingTop: 'calc(60px + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left, 16px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 16px))',
        }}
      >
        <div className="w-full max-w-6xl">
          <div className="rounded-2xl sm:rounded-3xl glass-surface border border-white/10 bg-[#0f0b0b]/95 shadow-[0_30px_120px_rgba(0,0,0,0.45)] overflow-hidden">
            <div className="grid md:grid-cols-[1fr_1fr] gap-0">
              {/* Product Image */}
              <div className="w-full bg-[#0f0b0b] flex items-center justify-center p-3 sm:p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(selectedVariant?.image || product.image || detail?.images?.[0]) ?? ''}
                  alt={product.title || ''}
                  className="w-full max-h-[35vh] sm:max-h-[45vh] object-contain"
                />
              </div>

              {/* Product Info */}
              <div className="w-full p-4 sm:p-6 text-[#ede8df] space-y-3 pb-6">
                <div className="space-y-0.5">
                  <h2 className="text-sm sm:text-base font-semibold leading-tight text-[#f7f3ec] line-clamp-2">
                    {product.title}
                  </h2>
                  {selectedVariant && (
                    <p className="text-sm font-medium text-[#f7f3ec]">
                      {selectedVariant.price !== null ? `$${selectedVariant.price.toFixed(2)}` : 'Price on request'}
                    </p>
                  )}
                  {selectedVariant?.available === false && (
                    <p className="text-xs text-red-200/80">Currently unavailable</p>
                  )}
                </div>

                {/* Options */}
                {detail?.options?.map((opt: any) => {
                  const open = openOption === opt.name;
                  return (
                    <div key={opt.name} className="glass-surface border border-white/10 rounded-xl bg-white/5 overflow-hidden">
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
                          {opt.values?.map((val: string) => {
                            const active = selectedOptions[opt.name] === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => updateOption(opt.name, val)}
                                className={`px-2.5 py-1 rounded-lg text-xs transition-all border ${active ? 'bg-gradient-to-r from-[#843c2d] via-[#a44e3a] to-[#52241d] text-[#f8f2ea] border-[#c58a70]/60 shadow-[0_10px_28px_rgba(0,0,0,0.35)]' : 'text-[#e1d6c8] border-white/15 bg-white/5 hover:bg-white/10'}`}
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

                {/* Loading/Error states */}
                {detailLoading && <p className="text-xs text-[#c7b8a8]">Loading variants…</p>}
                {detailError && <p className="text-xs text-red-300">{detailError}</p>}

                {/* CTA buttons */}
                {openOption === null && (
                  <div className="flex flex-wrap justify-center gap-2 text-center pt-2">
                    <button
                      type="button"
                      onClick={addToCart}
                      disabled={!selectedVariant || selectedVariant.available === false}
                      className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border ${selectedVariant?.available !== false ? 'bg-gradient-to-r from-[#843c2d] via-[#a44e3a] to-[#52241d] text-[#f8f2ea] border-[#c58a70]/50 shadow-[0_12px_30px_rgba(0,0,0,0.35)] hover:scale-[1.02]' : 'bg-white/5 text-[#c7b8a8] border-white/10 cursor-not-allowed'}`}
                    >
                      {addFeedback || (selectedVariant?.available === false ? 'Unavailable' : 'Add to Bag')}
                    </button>

                    <Link
                      href="/store/cart"
                      className="px-4 py-2.5 rounded-lg border border-white/20 text-[#f8f2ea] bg-white/5 hover:bg-white/10 transition-colors text-sm"
                      onClick={onClose}
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
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [productDetails, setProductDetails] = useState<Record<string, any>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [openOption, setOpenOption] = useState<string | null>(null);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Cart state for sticky button
  const [cartCount, setCartCount] = useState(0);
  const [quickAddFeedback, setQuickAddFeedback] = useState<string | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);

  // Track cart count from localStorage
  useEffect(() => {
    const updateCartCount = () => {
      try {
        const raw = localStorage.getItem('cart') || '[]';
        const cart = JSON.parse(raw);
        const count = Array.isArray(cart) ? cart.reduce((sum: number, item: any) => sum + (item.qty || 1), 0) : 0;
        setCartCount(count);
      } catch {
        setCartCount(0);
      }
    };
    updateCartCount();
    window.addEventListener('storage', updateCartCount);
    // Custom event for same-tab updates
    window.addEventListener('cartUpdated', updateCartCount);
    return () => {
      window.removeEventListener('storage', updateCartCount);
      window.removeEventListener('cartUpdated', updateCartCount);
    };
  }, []);

  // Quick add to cart (adds default variant)
  const quickAddToCart = useCallback(async (e: React.MouseEvent, product: ProductCard) => {
    e.stopPropagation();
    if (!product.available) return;

    try {
      // Fetch product details if not cached
      let detail = productDetails[product.handle];
      if (!detail) {
        const STORE_URL = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
        const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
        if (!PUBLIC_TOKEN) throw new Error('Missing token');

        const query = `#graphql
          query Product($handle: String!) {
            product(handle: $handle) {
              variants(first: 1) { edges { node {
                id title availableForSale
                price { amount }
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
          body: JSON.stringify({ query, variables: { handle: product.handle } }),
        });

        const data = await res.json();
        const v = data?.data?.product?.variants?.edges?.[0]?.node;
        if (!v) throw new Error('No variant');

        detail = {
          variants: [{
            id: v.id,
            title: v.title,
            price: parseFloat(v.price.amount),
            available: v.availableForSale,
            image: v.image?.url || null,
          }]
        };
      }

      const variant = detail.variants[0];
      if (!variant) throw new Error('No variant');

      const raw = localStorage.getItem('cart') || '[]';
      const cart: any[] = JSON.parse(raw);
      const existing = cart.find(c => c.variantId === variant.id);

      const base = {
        variantId: variant.id,
        qty: 1,
        title: variant.title === 'Default Title' ? product.title : `${product.title} — ${variant.title}`,
        price: variant.price,
        image: variant.image || product.image,
      };

      const nextCart = existing
        ? cart.map(c => c.variantId === variant.id ? { ...c, qty: c.qty + 1 } : c)
        : [...cart, base];

      localStorage.setItem('cart', JSON.stringify(nextCart));
      window.dispatchEvent(new Event('cartUpdated'));

      setQuickAddFeedback(product.handle);
      setTimeout(() => setQuickAddFeedback(null), 1200);
    } catch (err) {
      console.error('Quick add failed:', err);
    }
  }, [productDetails]);

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

  // Derive available categories from products (only show categories that have products)
  const availableCategories = useMemo(() => {
    const seen = new Set<string>();
    products.forEach(p => {
      if (p?.category) {
        const displayCat = getDisplayCategory(p.category);
        if (displayCat) seen.add(displayCat);
      }
    });
    // Return ordered categories, with unmapped ones at the end
    const ordered = CATEGORY_ORDER.filter(c => c === 'All' || seen.has(c));
    const unmapped = [...seen].filter(c => !CATEGORY_ORDER.includes(c)).sort();
    return [...ordered, ...unmapped];
  }, [products]);

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (!p) return false;
      if (activeCategory === 'All') return true;
      const productGroup = getDisplayCategory(p.category);
      return productGroup === activeCategory;
    });
  }, [products, activeCategory]);

  const selectedProduct = selectedHandle ? filteredProducts.find(p => p.handle === selectedHandle) : null;
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

  // Reset ALL modal state when selectedHandle changes (open, close, or switch)
  useEffect(() => {
    setOpenOption(null);
    setAddFeedback(null);
    setSelectedOptions({});
  }, [selectedHandle]);

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
      window.dispatchEvent(new Event('cartUpdated'));
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
        {/* Category Filter Pills */}
        {availableCategories.length > 1 && (
          <div className="sticky top-0 z-20 bg-[#0b0b0b]/95 backdrop-blur-sm border-b border-white/5">
            <div className="overflow-x-auto scrollbar-hide px-3 py-2.5">
              <div className="flex gap-2">
                {availableCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                      activeCategory === cat
                        ? 'bg-[#843c2d] text-[#f8f2ea] border-[#843c2d]'
                        : 'bg-white/5 text-[#b2a491] border-white/10 hover:bg-white/10 hover:text-[#ede8df]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content area with consistent spacing */}
        <div
          className="pt-4 pb-40"
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
                  <div
                    key={p.id}
                    className="group relative aspect-square rounded-lg overflow-hidden bg-[#0d0b0a]"
                  >
                    {/* Main clickable area for product details */}
                    <button
                      type="button"
                      onClick={() => setSelectedHandle(p.handle)}
                      className="absolute inset-0 w-full h-full focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50"
                      aria-label={`View ${p.title}`}
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
                    </button>

                    {/* Sold Out Overlay */}
                    {!p.available && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                        <span className="px-3 py-1.5 bg-[#0d0b0a]/90 rounded-full text-[#ede8df] text-[10px] uppercase tracking-widest border border-[#502d26]/50">
                          Sold Out
                        </span>
                      </div>
                    )}

                    {/* Quick Add Button - bottom right */}
                    {p.available && (
                      <button
                        type="button"
                        onClick={(e) => quickAddToCart(e, p)}
                        className={`absolute bottom-2 right-2 z-10 w-10 h-10 rounded-full
                          flex items-center justify-center transition-all duration-200
                          ${quickAddFeedback === p.handle
                            ? 'bg-green-500 scale-110'
                            : 'bg-[#843c2d] hover:bg-[#a44e3a] active:scale-95'
                          }
                          text-white shadow-lg`}
                        aria-label={quickAddFeedback === p.handle ? 'Added to bag' : 'Quick add to bag'}
                      >
                        {quickAddFeedback === p.handle ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        )}
                      </button>
                    )}

                    {/* Subtle hover glow */}
                    <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/5 group-hover:ring-[#843c2d]/30 transition-all duration-300 pointer-events-none" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-[#502d26]">
              <p className="text-xs uppercase tracking-widest">
                {activeCategory === 'All' ? 'No products available' : `No ${activeCategory.toLowerCase()} available`}
              </p>
              {activeCategory !== 'All' && (
                <button
                  onClick={() => setActiveCategory('All')}
                  className="mt-4 px-4 py-2 text-xs uppercase tracking-widest text-[#b2a491] hover:text-[#ede8df] transition-colors"
                >
                  View all products
                </button>
              )}
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

      {/* Sticky Cart Button - shows when cart has items */}
      {cartCount > 0 && (
        <Link
          href="/store/cart"
          className="fixed z-40 flex items-center gap-2 px-4 py-3 rounded-full
            bg-[#843c2d] hover:bg-[#a44e3a] text-white font-semibold text-sm
            shadow-[0_8px_30px_rgba(132,60,45,0.4)] transition-all duration-200
            active:scale-95"
          style={{
            right: '1rem',
            bottom: 'calc(140px + env(safe-area-inset-bottom, 0px))'
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <span>Bag ({cartCount})</span>
        </Link>
      )}

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

      {/* Product Modal */}
      <ProductFeedModal
        products={filteredProducts}
        selectedHandle={selectedHandle}
        onClose={() => setSelectedHandle(null)}
        productDetails={productDetails}
        ensureDetail={ensureDetail}
        detailLoading={detailLoading}
        detailError={detailError}
        selectedOptions={selectedOptions}
        updateOption={updateOption}
        openOption={openOption}
        setOpenOption={setOpenOption}
        addToCart={addToCart}
        addFeedback={addFeedback}
      />
    </ScreenLayout>
  );
}
