'use client';

import { useState, useEffect, useMemo } from 'react';
import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';
import { usePageAnalytics } from '@/hooks/usePageAnalytics';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import { isPreorderActive, PREORDER_CTA, PREORDER_FEEDBACK, PREORDER_SHIP_TEXT } from '@/config/preorder';

// Define the shape of the product data
interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description?: string;
  images?: { src: string }[];
  options?: { name: string; values: string[] }[];
  variants?: { 
    id: string; 
    title: string; 
    price: string; 
    currency?: string;
    available?: boolean; 
    quantityAvailable?: number;
    image?: { src: string } | null; 
    selectedOptions?: Record<string, string> 
  }[];
}

interface ProductPageClientProps {
  product: ShopifyProduct;
}

export default function ProductPageClient({ product }: ProductPageClientProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [hasCartItems, setHasCartItems] = useState<boolean>(false);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  // Page analytics
  usePageAnalytics({ title: `${product?.title} | Odubo Studio` });
  const analytics = useAnalyticsSafe();

  // Track product view on mount
  useEffect(() => {
    if (product?.handle) {
      analytics?.trackProductView(product.handle);
    }
  }, [product?.handle, analytics]);

  // Initialize cart presence from localStorage
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('cart') : null;
      if (raw) {
        const cart = JSON.parse(raw) as Array<any>;
        setHasCartItems(Array.isArray(cart) && cart.length > 0);
      } else {
        setHasCartItems(false);
      }
    } catch (e) {
      setHasCartItems(false);
    }
  }, []);

  // Initialize default selections when product loads
  useEffect(() => {
    if (!product) return;
    // Prefer first available variant as the default selection
    const firstAvailable = product.variants?.find(v => (v.available !== false) && (v.quantityAvailable == null || v.quantityAvailable > 0)) || product.variants?.[0];
    if (firstAvailable?.selectedOptions && Object.keys(firstAvailable.selectedOptions).length > 0) {
      setSelectedOptions({ ...firstAvailable.selectedOptions });
      setSelectedVariantId(firstAvailable.id);
    } else {
      const initial: Record<string, string> = {};
      for (const opt of product.options || []) {
        initial[opt.name] = opt.values?.[0] || '';
      }
      setSelectedOptions(initial);
      // If no options, select first variant by default
      if ((!product.options || product.options.length === 0) && product.variants && product.variants.length > 0) {
        setSelectedVariantId(product.variants[0].id);
      }
    }
  }, [product?.id]);

  // Derive selected variant based on selectedOptions
  useEffect(() => {
    if (!product?.variants) return;
    if (!product.options || product.options.length === 0) return; // handled by load effect
    const match = product.variants.find(v => {
      const so = v.selectedOptions || {};
      return product.options!.every(o => so[o.name] === selectedOptions[o.name]);
    });
    setSelectedVariantId(match?.id || '');
  }, [selectedOptions, product?.id]);

  const selectedVariant = useMemo(() => {
    return product.variants?.find(v => v.id === selectedVariantId);
  }, [selectedVariantId, product.variants]);

  // Sync active image with selected variant
  useEffect(() => {
    if (selectedVariant?.image?.src) {
      setActiveImage(selectedVariant.image.src);
    }
  }, [selectedVariant]);

  // Set initial image
  useEffect(() => {
    if (!activeImage && product?.images?.[0]?.src) {
      setActiveImage(product.images[0].src);
    }
  }, [product, activeImage]);

  const handleThumbnailClick = (src: string) => {
    setActiveImage(src);
    // Find if this image belongs to a specific variant
    const variant = product.variants?.find(v => v.image?.src === src);
    if (variant && variant.available !== false) {
      if (variant.selectedOptions) {
        setSelectedOptions(variant.selectedOptions);
      }
    }
  };

  const addToCart = () => {
    let variantId = selectedVariantId;
    if (!variantId && product?.variants && product.variants.length === 1) {
      variantId = product.variants[0].id;
      setSelectedVariantId(variantId);
    }
    if (!variantId) {
      alert('Please select options');
      return;
    }
    try {
      const cartRaw = localStorage.getItem('cart') || '[]';
      const cart = JSON.parse(cartRaw) as Array<{ variantId: string; qty: number; title: string; price: number; image?: string }>;
      const v = product?.variants?.find(v => v.id === variantId);
      if (!v) return;
      const existing = cart.find(c => c.variantId === variantId);
      if (existing) existing.qty += qty; else cart.push({ variantId: variantId, qty, title: `${product?.title} — ${v.title}`, price: parseFloat(String(v.price)), image: v.image?.src || product?.images?.[0]?.src });
      localStorage.setItem('cart', JSON.stringify(cart));

      // Track add to cart
      analytics?.trackAddToCart(product?.handle || '', parseFloat(String(v.price)), variantId);

      // update UI state
      setHasCartItems(true);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    } catch (e) {
      console.warn('Failed to update cart', e);
    }
  };

  return (
    <ScreenLayout>
      {/* BAAD by Odubo product background with soft lights */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0b0b0b] via-[#111111] to-[#0b0b0b]" />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-64 w-[36rem] rounded-[999px] bg-gradient-to-tr from-[#843c2d22] via-transparent to-[#ede8df11] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-gradient-to-tr from-[#b2a49122] via-[#ede8df14] to-transparent blur-3xl" />
      </div>
      <ScrollContainer>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[env(safe-area-inset-bottom)]">
          {/* Breadcrumb / Back */}
          <div className="mb-4 sm:mb-8 flex items-center justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand-logos/baad@odubo.png" alt="B.A.A.D" className="h-8 sm:h-10 w-auto opacity-90" />
            <a href="/store" className="text-xs uppercase tracking-widest text-[#b2a491] hover:text-[#ede8df] transition-colors">
              Back to Shop
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Media Gallery */}
            <div className="space-y-3 sm:space-y-4">
              <div className="h-[60svh] sm:h-auto sm:aspect-[3/4] overflow-hidden flex items-center justify-center rounded-2xl p-[1px] bg-gradient-to-br from-[#ffffff0a] via-[#843c2d33] to-[#ffffff08]">
                <div className="relative w-full h-full rounded-2xl bg-[#0e0d0d]/60 backdrop-blur-sm flex items-center justify-center">
                {(() => {
                  const src = activeImage || selectedVariant?.image?.src || product?.images?.[0]?.src;
                  if (!src) return <div className="text-[#502d26] text-xs uppercase tracking-widest">No Image</div>;
                  return <img src={src} alt={product?.title || 'Product'} className="w-full h-full object-contain transition-all duration-500 drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)]" />;
                })()}
                </div>
              </div>
              {/* Thumbnails if multiple images exist */}
              {product?.images && product.images.length > 1 && (
                <div className="grid grid-cols-4 gap-3 sm:gap-4 max-w-[92vw] mx-auto pb-[env(safe-area-inset-bottom)]">
                  {product.images.slice(0, 4).map((img, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleThumbnailClick(img.src)}
                      className={`aspect-square overflow-hidden rounded-xl border transition-all duration-300 ${
                        activeImage === img.src ? 'border-[#843c2d] opacity-100' : 'border-[#1c1a19] opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img.src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col justify-center">
              <h1 className="text-3xl sm:text-4xl font-medium text-[#ede8df] mb-2 tracking-wide drop-shadow-[0_2px_12px_rgba(132,60,45,0.35)]">{product?.title || 'Product'}</h1>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#b2a491] mb-4">B.A.A.D by Odubo · Fashion</p>
              
              {selectedVariant && (
                <div className="text-xl text-[#b2a491] font-light tracking-widest mb-8">
                  {selectedVariant.currency ? `${selectedVariant.currency} ` : '$'}{parseFloat(selectedVariant.price).toFixed(2)}
                </div>
              )}

              <div className="prose prose-invert prose-sm text-[#b2a491] mb-10 max-w-md font-light leading-relaxed">
                {product?.description || 'No description available.'}
              </div>

              {/* Options */}
              {product?.options && product.options.length > 0 && (
                <div className="space-y-6 mb-10">
                  {product.options.map((opt) => (
                    <div key={opt.name}>
                      <div className="text-xs uppercase tracking-widest text-[#b2a491] mb-3">{opt.name}</div>
                      <div className="flex flex-wrap gap-3">
                        {opt.values.map(val => {
                          const isSelected = selectedOptions[opt.name] === val;
                          // Determine availability
                          const tentative = { ...selectedOptions, [opt.name]: val };
                          const anyMatch = product?.variants?.some(v => {
                            const isInStock = (v.available !== false) && (v.quantityAvailable == null || v.quantityAvailable > 0);
                            if (!isInStock) return false;
                            const so = v.selectedOptions || {};
                            return (product?.options || []).every(o => tentative[o.name] ? so[o.name] === tentative[o.name] : true);
                          });
                          const disabled = !anyMatch;
                          
                          return (
                            <button
                              key={val}
                              onClick={() => !disabled && setSelectedOptions(prev => ({ ...prev, [opt.name]: val }))}
                              className={`min-w-[3rem] px-4 py-2 text-sm rounded-full transition-all duration-300 border ${
                                isSelected 
                                  ? 'border-transparent bg-gradient-to-r from-[#843c2d] to-[#b26a4a] text-[#ede8df] shadow-[0_0_20px_#843c2d55]'
                                  : disabled 
                                    ? 'border-[#302927] text-[#302927] cursor-not-allowed decoration-slice line-through' 
                                    : 'border-[#502d26] text-[#b2a491] hover:border-[#b2a491] hover:text-[#ede8df]'
                              }`}
                              disabled={disabled}
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

              {/* Actions */}
              <div className="flex flex-col gap-4 max-w-xs">
                <button
                  onClick={addToCart}
                  disabled={!selectedVariant?.available}
                  className={`w-full py-4 text-sm uppercase tracking-[0.2em] rounded-full transition-all duration-300 ${
                    !selectedVariant?.available 
                      ? 'bg-[#1c1a19] text-[#502d26] cursor-not-allowed border border-[#302927]'
                      : justAdded
                        ? 'bg-[#502d26] text-[#ede8df]'
                        : 'bg-gradient-to-r from-[#843c2d] to-[#b26a4a] text-[#ede8df] shadow-[0_10px_30px_#843c2d40] hover:shadow-[0_12px_36px_#843c2d55]'
                  }`}
                >
                  {justAdded ? (isPreorderActive() ? PREORDER_FEEDBACK : 'Added to Cart') : (!selectedVariant?.available ? 'Sold Out' : (isPreorderActive() ? PREORDER_CTA : 'Add to Cart'))}
                </button>
                
                {hasCartItems && (
                  <a
                    href="/store/cart"
                    className="w-full py-4 text-center text-sm uppercase tracking-[0.2em] rounded-full border border-[#502d26] text-[#b2a491] hover:text-[#ede8df] hover:border-[#b2a491] transition-all duration-300"
                  >
                    View Cart
                  </a>
                )}
              </div>

              {/* Shipping Info */}
              <div className="mt-12 pt-8 border-t border-[#502d26]/20 text-xs text-[#b2a491] uppercase tracking-widest space-y-2">
                {isPreorderActive() && <p>{PREORDER_SHIP_TEXT}</p>}
                <p>Free shipping on orders over $150</p>
                <p>Ships from Canada</p>
              </div>
            </div>
          </div>
        </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}
