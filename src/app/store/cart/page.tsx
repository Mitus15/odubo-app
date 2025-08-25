"use client";
import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

export default function CartPage() {
  type CartItem = { variantId: string; qty: number; title: string; price: number; image?: string };
  const [items, setItems] = useState<CartItem[]>([]);

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

  const checkoutUrl = useMemo(() => {
    if (items.length === 0) return 'https://odubostudio.myshopify.com/cart';
    const pairs = items.map(i => {
      const numericId = (i.variantId.split('/').pop() || '').replace(/[^0-9]/g, '');
      return `${numericId}:${i.qty}`;
    }).join(',');
    return `https://odubostudio.myshopify.com/cart/${pairs}`;
  }, [items]);

  return (
    <ScreenLayout>
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
      <ScrollContainer>
        <div className="max-w-3xl mx-auto p-4">
          <h1 className="text-2xl font-bold mb-4">Your Cart</h1>
          {items.length === 0 ? (
            <div className="glass-surface rounded-2xl p-6 border border-[#502d26]/30 text-[#b2a491]">
              Your cart is empty.
              <div className="mt-3">
                <Link href="/store" className="text-[#ede8df] underline">Continue shopping</Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((it) => (
                <div key={it.variantId} className="glass-surface rounded-2xl p-4 border border-[#502d26]/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {it.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image} alt="item" className="w-14 h-14 rounded-lg object-cover" />
                    )}
                    <div>
                      <div className="text-[#ede8df] font-medium max-w-xs line-clamp-2">{it.title}</div>
                      <div className="text-[#b2a491] text-sm">${Number(it.price).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => dec(it.variantId)} className="w-8 h-8 rounded-full bg-[#302927]/60 hover:bg-[#502d26]/60 text-[#ede8df]">-</button>
                    <span className="text-[#ede8df] w-6 text-center">{it.qty}</span>
                    <button onClick={() => inc(it.variantId)} className="w-8 h-8 rounded-full bg-[#302927]/60 hover:bg-[#502d26]/60 text-[#ede8df]">+</button>
                    <button onClick={() => remove(it.variantId)} className="ml-2 text-[#b2a491] hover:text-red-400">Remove</button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-4 border-t border-[#502d26]/30">
                <div className="text-[#b2a491]">Subtotal</div>
                <div className="text-[#ede8df] font-medium">${subtotal.toFixed(2)}</div>
              </div>
              <a href={checkoutUrl} className="block text-center py-3 rounded-xl bg-[#843c2d] text-[#ede8df] hover:bg-[#a0472f] transition-colors">Checkout</a>
            </div>
          )}
        </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}



