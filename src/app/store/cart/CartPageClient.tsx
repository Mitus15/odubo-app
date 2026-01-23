"use client";
import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePageAnalytics } from '@/hooks/usePageAnalytics';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import { createCheckout, type CheckoutAttribution } from '@/lib/store/api';

export default function CartPage() {
  type CartItem = { variantId: string; qty: number; title: string; price: number; image?: string };
  const [items, setItems] = useState<CartItem[]>([]);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const searchParams = useSearchParams();

  // Page analytics
  usePageAnalytics({ title: 'Cart | Odubo Studio' });
  const analytics = useAnalyticsSafe();

  // Get attribution data
  const getAttribution = (): CheckoutAttribution => {
    const sessionId = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('odubo_session_id') || undefined
      : undefined;
    const visitorId = typeof localStorage !== 'undefined'
      ? localStorage.getItem('odubo_visitor_id') || undefined
      : undefined;

    return {
      sessionId,
      visitorId,
      utmSource: searchParams?.get('utm_source') || undefined,
      utmMedium: searchParams?.get('utm_medium') || undefined,
      utmCampaign: searchParams?.get('utm_campaign') || undefined,
    };
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cart') || '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {}
  }, []);

  const subtotal = useMemo(() => items.reduce((sum, it) => sum + (Number(it.price) || 0) * it.qty, 0), [items]);

  const save = (next: CartItem[]) => {
    setItems(next);
    try { localStorage.setItem('cart', JSON.stringify(next)); } catch {}
  };

  const inc = (variantId: string) => {
    save(items.map(i => i.variantId === variantId ? { ...i, qty: i.qty + 1 } : i));
  };
  const dec = (variantId: string) => {
    save(items.flatMap(i => {
      if (i.variantId !== variantId) return i as any;
      const nextQty = i.qty - 1;
      return nextQty <= 0 ? [] : [{ ...i, qty: nextQty }];
    }));
  };
  const remove = (variantId: string) => {
    save(items.filter(i => i.variantId !== variantId));
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setInventoryError(null);
    setIsChecking(true);

    try {
      // Step 1: Check inventory
      const variantIds = items.map(i => i.variantId);
      const inventoryRes = await fetch('/api/store/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantIds }),
      });

      if (inventoryRes.ok) {
        const inventoryData = await inventoryRes.json();
        if (!inventoryData.valid && inventoryData.outOfStock?.length > 0) {
          const outOfStockNames = inventoryData.outOfStock
            .map((item: any) => `${item.productTitle} - ${item.title}`)
            .join(', ');
          setInventoryError(`Out of stock: ${outOfStockNames}`);
          setIsChecking(false);
          return;
        }
      }

      // Step 2: Track checkout start
      setIsRedirecting(true);
      analytics?.trackCheckoutStart(subtotal, items.reduce((sum, i) => sum + i.qty, 0));

      // Step 3: Create checkout with attribution via Shopify API
      const checkoutItems = items.map(i => ({
        variantId: i.variantId,
        quantity: i.qty,
      }));

      const checkoutUrl = await createCheckout(checkoutItems, getAttribution());

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        // Fallback to cart permalink if createCheckout fails
        const shopUrl = 'odubostudio.myshopify.com';
        const variantString = items.map(i => {
          const id = i.variantId.split('/').pop();
          return `${id}:${i.qty}`;
        }).join(',');
        window.location.href = `https://${shopUrl}/cart/${variantString}`;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      // Fallback to cart permalink on any error
      setIsRedirecting(true);
      const shopUrl = 'odubostudio.myshopify.com';
      const variantString = items.map(i => {
        const id = i.variantId.split('/').pop();
        return `${id}:${i.qty}`;
      }).join(',');
      window.location.href = `https://${shopUrl}/cart/${variantString}`;
    }
  };

  return (
    <ScreenLayout>
      <div className="fixed inset-0 -z-10 bg-[#0c0a09]" />
      <ScrollContainer>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-12">
            <h1 className="text-3xl font-medium text-[#ede8df] tracking-wide">Your Cart</h1>
            <Link href="/store" className="text-xs uppercase tracking-widest text-[#b2a491] hover:text-[#ede8df] transition-colors">
              Continue Shopping
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-[#502d26]/20 rounded-sm bg-[#1c1a19]/20">
              <p className="text-[#b2a491] uppercase tracking-widest text-sm mb-6">Your cart is empty</p>
              <Link 
                href="/store" 
                className="px-8 py-3 bg-[#302927] text-[#ede8df] text-xs uppercase tracking-widest hover:bg-[#502d26] transition-colors"
              >
                Browse Store
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-8">
                {items.map((it) => (
                  <div key={it.variantId} className="flex gap-6 py-6 border-b border-[#502d26]/20 first:pt-0">
                    <div className="w-24 h-32 bg-[#1c1a19]/20 flex-shrink-0">
                      {it.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image} alt={it.title} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#502d26] text-[10px] uppercase">No Image</div>
                      )}
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-[#ede8df] font-medium text-lg tracking-wide">{it.title.split('—')[0]}</h3>
                          <p className="text-[#ede8df] font-light tracking-widest">${(Number(it.price) * it.qty).toFixed(2)}</p>
                        </div>
                        <p className="text-[#b2a491] text-xs uppercase tracking-widest mb-4">{it.title.split('—')[1] || 'Default'}</p>
                      </div>

                      <div className="flex justify-between items-end">
                        <div className="flex items-center border border-[#502d26]/40">
                          <button 
                            onClick={() => dec(it.variantId)} 
                            className="w-8 h-8 flex items-center justify-center text-[#b2a491] hover:text-[#ede8df] hover:bg-[#502d26]/20 transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-[#ede8df] text-sm">{it.qty}</span>
                          <button 
                            onClick={() => inc(it.variantId)} 
                            className="w-8 h-8 flex items-center justify-center text-[#b2a491] hover:text-[#ede8df] hover:bg-[#502d26]/20 transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <button 
                          onClick={() => remove(it.variantId)} 
                          className="text-[10px] uppercase tracking-widest text-[#502d26] hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="lg:col-span-1">
                <div className="bg-[#1c1a19]/40 p-8 border border-[#502d26]/20 sticky top-24">
                  <h2 className="text-[#ede8df] text-sm uppercase tracking-widest mb-6 pb-4 border-b border-[#502d26]/20">Order Summary</h2>
                  
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[#b2a491] text-sm">Subtotal</span>
                    <span className="text-[#ede8df] tracking-widest">${subtotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mb-8">
                    <span className="text-[#b2a491] text-sm">Shipping</span>
                    <span className="text-[#b2a491] text-[10px] uppercase tracking-widest text-right leading-tight">Calculated at<br/>checkout</span>
                  </div>

                  {inventoryError && (
                    <div className="mb-4 p-3 rounded border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
                      {inventoryError}
                    </div>
                  )}

                  <button
                    onClick={handleCheckout}
                    disabled={isRedirecting || isChecking}
                    className="w-full py-4 bg-[#843c2d] text-[#ede8df] text-sm uppercase tracking-[0.2em] hover:bg-[#a0472f] transition-colors disabled:opacity-50 disabled:cursor-wait"
                  >
                    {isChecking ? 'Checking...' : isRedirecting ? 'Redirecting...' : 'Checkout'}
                  </button>
                  
                  <p className="mt-4 text-center text-[10px] text-[#502d26] uppercase tracking-widest">
                    Secure checkout via Shopify
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}



