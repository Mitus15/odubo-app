"use client";
import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export const runtime = 'edge';

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description?: string;
  images?: { src: string }[];
  options?: { name: string; values: string[] }[];
  variants?: { id: string; title: string; price: string; currency?: string; available?: boolean; quantityAvailable?: number; image?: { src: string } | null; selectedOptions?: Record<string, string> }[];
}

async function fetchShopifyProduct(handle: string, apiKey: string): Promise<ShopifyProduct | null> {
  try {
    const res = await fetch(`/api/shopify/product?handle=${encodeURIComponent(handle)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function ProductDetailPage() {
  const params = useParams<{ handle: string }>();
  const [product, setProduct] = useState<ShopifyProduct | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [qty, setQty] = useState<number>(1);

  useEffect(() => {
    if (!params?.handle) return;
    fetchShopifyProduct(params.handle, process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '').then(setProduct);
  }, [params?.handle]);

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

  return (
    <ScreenLayout>
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
      <ScrollContainer>
        <div className="w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-10" style={{maxWidth: 'min(1280px, 92vw)'}}>
          {/* Media */}
          <div className="rounded-2xl overflow-hidden border border-[#502d26]/30 aspect-square bg-[#302927]/60">
            {(() => {
              const v = product?.variants?.find(v => v.id === selectedVariantId);
              const src = v?.image?.src || product?.images?.[0]?.src;
              if (!src) return null;
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
            {selectedVariantId && (
              <div className="mb-4 text-[#ede8df]">
                {(() => {
                  const v = product?.variants?.find(v => v.id === selectedVariantId);
                  if (!v) return null;
                  return (
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-semibold">{v.currency ? `${v.currency} ` : '$'}{v.price}</span>
                      <span className={`text-sm ${v.available ? 'text-green-400' : 'text-red-400'}`}>
                        {v.available ? (v.quantityAvailable != null ? `${v.quantityAvailable} available` : 'In stock') : 'Sold out'}
                      </span>
                    </div>
                  );
                })()}
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
                onClick={() => {
                  let variantId = selectedVariantId;
                  if (!variantId && product?.variants && product.variants.length === 1) {
                    variantId = product.variants[0].id;
                    setSelectedVariantId(variantId);
                  }
                  if (!variantId) {
                    alert('Please select options');
                    return;
                  }
                  const cartRaw = localStorage.getItem('cart') || '[]';
                  const cart = JSON.parse(cartRaw) as Array<{ variantId: string; qty: number; title: string; price: number; image?: string }>;
                  const v = product?.variants?.find(v => v.id === variantId);
                  if (!v) return;
                  const existing = cart.find(c => c.variantId === variantId);
                  if (existing) existing.qty += qty; else cart.push({ variantId: variantId, qty, title: `${product?.title} — ${v.title}`, price: parseFloat(String(v.price)), image: v.image?.src || product?.images?.[0]?.src });
                  localStorage.setItem('cart', JSON.stringify(cart));
                }}
                className={`px-4 py-2 rounded-xl ${ (selectedVariantId || (product?.variants?.length === 1)) ? 'bg-[#843c2d] hover:bg-[#a0472f]' : 'bg-[#502d26]/60 hover:bg-[#502d26]/70'} text-[#ede8df] transition-colors`}
              >
                Add to cart
              </button>
            </div>

            <div className="mt-2">
              <a
                href="/store/cart"
                className="inline-block px-4 py-2 rounded-xl border border-[#502d26]/40 text-[#ede8df] hover:border-[#843c2d]/60 transition-colors"
              >
                View cart
              </a>
            </div>
          </div>
        </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}



