'use client';

import { useState, useEffect, useMemo } from 'react';
import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';

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
  const [qty, setQty] = useState<number>(1);
  const [hasCartItems, setHasCartItems] = useState<boolean>(false);
  const [justAdded, setJustAdded] = useState<boolean>(false);

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
      // update UI state
      setHasCartItems(true);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1000);
    } catch (e) {
      console.warn('Failed to update cart', e);
    }
  };

  return (
    <ScreenLayout>
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
      <ScrollContainer>
        <div className="w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-10" style={{maxWidth: 'min(1280px, 92vw)'}}>
          {/* Media */}
          <div className="rounded-2xl overflow-hidden border border-transparent aspect-square bg-transparent">
            {(() => {
              const src = selectedVariant?.image?.src || product?.images?.[0]?.src;
              if (!src) return <div className="w-full h-full bg-stone-800" />;
              return <img src={src} alt={product?.title || 'Product'} className="w-full h-full object-cover" />;
            })()}
          </div>

          {/* Details */}
          <div>
            <h1 className="text-3xl font-bold mb-2">{product?.title || 'Product'}</h1>
            <p className="text-[#b2a491] mb-4">{product?.description || 'Product description coming soon.'}</p>

            {/* Options as pill selectors */}
            {product?.options && product.options.length > 0 && (
              <div className="space-y-4 mb-6">
                {product.options.map((opt) => (
                  <div key={opt.name}>
                    <div className="text-sm text-[#b2a491] mb-2">{opt.name}</div>
                    <div className="flex flex-wrap gap-2">
                      {opt.values.map(val => {
                        const isSelected = selectedOptions[opt.name] === val;
                        // Determine if this value is available given current partial selections
                        const tentative = { ...selectedOptions, [opt.name]: val };
                        const anyMatch = product?.variants?.some(v => {
                          // Treat unknown quantity as available; rely on availableForSale
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
                            className={`px-3 py-1.5 rounded-xl border transition-all text-sm ${
                              isSelected ? 'bg-[#843c2d] text-[#ede8df] border-[#843c2d]' : disabled ? 'border-[#502d26]/20 text-[#726d6c]/60 cursor-not-allowed' : 'border-[#502d26]/40 text-[#ede8df] hover:border-[#843c2d]/50'
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

            {/* Price and availability */}
            {selectedVariant && (
              <div className="mb-4 text-[#ede8df]">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-semibold">{selectedVariant.currency ? `${selectedVariant.currency} ` : '$'}{selectedVariant.price}</span>
                  <span className={`text-sm ${selectedVariant.available ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedVariant.available ? (selectedVariant.quantityAvailable != null ? `${selectedVariant.quantityAvailable} available` : 'In stock') : 'Sold out'}
                  </span>
                </div>
              </div>
            )}

            {/* Quantity & Add to cart */}
            <div className="flex items-center gap-3 mb-4">
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
                className="w-20 bg-transparent border border-[#502d26]/30 rounded-xl p-2 text-[#ede8df]"
              />
              <button
                onClick={addToCart}
                className={`px-4 py-2 rounded-xl ${ (selectedVariantId || (product?.variants?.length === 1)) ? 'bg-[#843c2d] hover:bg-[#a0472f]' : 'bg-[#502d26]/60 hover:bg-[#502d26]/70'} text-[#ede8df] transition-colors`}
              >
                {justAdded ? 'Added' : 'Add to cart'}
              </button>
            </div>

            {hasCartItems && (
              <div className="mt-2">
                <a
                  href="/store/cart"
                  className="inline-block px-4 py-2 rounded-xl border border-[#502d26]/40 text-[#ede8df] hover:border-[#843c2d]/60 transition-colors"
                >
                  View cart
                </a>
              </div>
            )}
          </div>
        </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}
