'use client';

import { useState, useEffect, useMemo } from 'react';
import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/store/money';

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Canada');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cart') || '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setItems(parsed);
      } else {
        router.push('/store/cart');
      }
    } catch {
      router.push('/store/cart');
    }
  }, [router]);

  const subtotal = useMemo(() => items.reduce((sum, it) => sum + (Number(it.price) || 0) * it.qty, 0), [items]);
  const total = subtotal; // Tax/Shipping logic can be added here
  const cartCurrency = useMemo(() => items.find((it) => it.currency)?.currency || undefined, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            email,
            firstName,
            lastName,
            address: {
              line1: address,
              city,
              postalCode,
              country
            }
          },
          items,
          subtotal,
          total
        })
      });

      const data: any = await res.json();

      if (data.success) {
        // Clear cart
        localStorage.removeItem('cart');
        // Redirect to success (we'll just show an alert and go to store for now)
        alert(`Order #${data.orderNumber} placed successfully!`);
        router.push('/store');
      } else {
        alert('Failed to place order: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout>
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
      <ScrollContainer>
        <div className="max-w-4xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="lg:order-2">
            <div className="glass-surface rounded-2xl p-6 border border-[#502d26]/30 sticky top-4">
              <h2 className="text-xl font-semibold text-[#ede8df] mb-4">Order Summary</h2>
              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {items.map((it, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-12 h-12 bg-[#302927] rounded-lg overflow-hidden flex-shrink-0">
                      {it.image && <img src={it.image} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[#ede8df] text-sm truncate">{it.title}</div>
                      <div className="text-[#b2a491] text-xs">Qty: {it.qty}</div>
                    </div>
                    <div className="text-[#ede8df] text-sm">{formatMoney(it.price * it.qty, it.currency || cartCurrency)}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#502d26]/30 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-[#b2a491]">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal, cartCurrency)}</span>
                </div>
                <div className="flex justify-between text-[#b2a491]">
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
                <div className="flex justify-between text-[#ede8df] font-bold text-lg pt-2">
                  <span>Total</span>
                  <span>{formatMoney(total, cartCurrency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="lg:order-1">
            <h1 className="text-2xl font-bold mb-6">Checkout</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-[#ede8df] font-medium">Contact</h3>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#171616] border border-[#502d26]/30 rounded-xl px-4 py-3 text-[#ede8df]"
                  required
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-[#ede8df] font-medium">Shipping Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full bg-[#171616] border border-[#502d26]/30 rounded-xl px-4 py-3 text-[#ede8df]"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full bg-[#171616] border border-[#502d26]/30 rounded-xl px-4 py-3 text-[#ede8df]"
                    required
                  />
                </div>
                <input
                  type="text"
                  placeholder="Address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-[#171616] border border-[#502d26]/30 rounded-xl px-4 py-3 text-[#ede8df]"
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="City"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full bg-[#171616] border border-[#502d26]/30 rounded-xl px-4 py-3 text-[#ede8df]"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Postal Code"
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    className="w-full bg-[#171616] border border-[#502d26]/30 rounded-xl px-4 py-3 text-[#ede8df]"
                    required
                  />
                </div>
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full bg-[#171616] border border-[#502d26]/30 rounded-xl px-4 py-3 text-[#ede8df]"
                >
                  <option value="Canada">Canada</option>
                  <option value="United States">United States</option>
                </select>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-[#843c2d] text-[#ede8df] rounded-xl hover:bg-[#a0472f] transition-colors font-bold text-lg disabled:opacity-50"
                >
                  {loading ? 'Processing...' : `Pay ${formatMoney(total, cartCurrency)}`}
                </button>
                <p className="text-center text-xs text-[#b2a491] mt-4">
                  This is a demo checkout. No payment will be processed.
                </p>
              </div>
            </form>
          </div>
        </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}