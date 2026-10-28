"use client";
import Link from 'next/link';
import { RoomShell, Symbol } from '@/components/room/RoomParts';
import { onRoom, ROOM_DARK } from '@/lib/room';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePageAnalytics } from '@/hooks/usePageAnalytics';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import { CHECKOUT_FAILED_MESSAGE, useStore } from '@/contexts/StoreContext';
import { createCheckoutSession, type CheckoutAttribution } from '@/lib/store/api';
import { rememberCheckout } from '@/lib/store/bag';
import { getAttribution as getStoredAttribution, getSessionId } from '@/lib/attribution';
import { getVisitorId } from '@/lib/visitorId';
import { isPreorderActive, PREORDER_CHECKOUT_CTA, PREORDER_DISCLAIMER } from '@/config/preorder';
import { formatMoney, getCountryFromCookie } from '@/lib/store/money';

/** A line drawn in the room's writing, faint */
const HAIRLINE = 'color-mix(in srgb, currentColor 35%, transparent)';

export default function CartPage({ room }: { room: string | null }) {
  // The one bag (lib/store/bag.ts), through the StoreProvider: the same items
  // the grid's panel, QuickShop and the badge hold. This page used to keep its
  // own under another key.
  const { cart, updateQuantity, removeFromCart } = useStore();
  const items = cart.items;
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const searchParams = useSearchParams();

  // Page analytics
  usePageAnalytics({ title: 'Cart | Odubo Studio' });
  const analytics = useAnalyticsSafe();

  // Get attribution data for revenue tracking
  const getAttribution = (): CheckoutAttribution => {
    const attribution = getStoredAttribution();
    const sessionId = getSessionId();
    const visitorId = getVisitorId();

    return {
      sessionId,
      visitorId,
      utmSource: attribution?.source || searchParams?.get('utm_source') || undefined,
      utmMedium: attribution?.medium || searchParams?.get('utm_medium') || undefined,
      utmCampaign: attribution?.campaign || searchParams?.get('utm_campaign') || undefined,
      // Entry content attribution for "which content drove this sale"
      entryClipId: attribution?.entryClipId,
      entryGalleryId: attribution?.entryGalleryId,
      entryAlbumId: attribution?.entryAlbumId,
      entryPath: attribution?.landingPage,
    };
  };

  const subtotal = useMemo(() => items.reduce((sum, it) => sum + (Number(it.price) || 0) * it.quantity, 0), [items]);
  // All items in a session share the visitor's currency; fall back to the first
  // item's stored currency, then to the geo default.
  const cartCurrency = useMemo(() => items.find(it => it.currency)?.currency || undefined, [items]);

  const inc = (variantId: string) => {
    const item = items.find(i => i.variantId === variantId);
    if (item) updateQuantity(variantId, item.quantity + 1);
  };
  const dec = (variantId: string) => {
    const item = items.find(i => i.variantId === variantId);
    if (item) updateQuantity(variantId, item.quantity - 1);  // 0 removes it
  };
  const remove = (variantId: string) => {
    removeFromCart(variantId);
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setInventoryError(null);
    setCheckoutError(null);
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
      analytics?.trackCheckoutStart(subtotal, cart.itemCount);

      // Step 3: Create checkout with attribution via Shopify API
      const checkoutItems = items.map(i => ({
        variantId: i.variantId,
        quantity: i.quantity,
      }));

      const session = await createCheckoutSession(checkoutItems, getAttribution(), getCountryFromCookie());

      if (session) {
        rememberCheckout(session.cartId);  // so the bag can empty itself after the order
        window.location.href = session.checkoutUrl;
      } else {
        throw new Error('Failed to create checkout');
      }
    } catch (error) {
      // In place, with a way to try again. This used to bounce the visitor to a
      // myshopify.com cart permalink, which drops the attribution and can land
      // on the shop's password page.
      console.error('Checkout error:', error);
      setIsRedirecting(false);
      setIsChecking(false);
      setCheckoutError(CHECKOUT_FAILED_MESSAGE);
    }
  };

  const colour = room || ROOM_DARK;
  const on = onRoom(colour);

  return (
    <RoomShell
      colour={colour}
      on={on}
      corner={
        <Link href="/gear" aria-label="Back to the gear" title="The gear" className="flex h-11 w-11 items-center justify-center transition-[opacity,transform] hover:opacity-70 active:scale-95">
          <Symbol name="gear" className="h-6 w-6" />
        </Link>
      }
    >
      <main className="room-fade mx-auto w-full max-w-4xl px-5 pt-2 lg:px-10" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}>
        <h1 className="room-display flex items-center justify-center gap-2.5 text-[clamp(24px,7vw,36px)] uppercase leading-none lg:justify-start">
          <Symbol name="bag" className="h-[0.9em] w-[0.9em]" />
          Your bag
        </h1>

        {items.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <p className="room-eyebrow">Nothing in it yet</p>
            <Link
              href="/gear"
              className="mt-6 flex min-h-[52px] w-full max-w-xs items-center justify-center rounded-full text-[15px] font-semibold tracking-wide active:scale-[0.98]"
              style={{ background: on, color: colour }}
            >
              See the gear
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-14">
            {/* What is in it */}
            <ul className="lg:col-span-2">
              {items.map((it) => (
                <li key={it.variantId} className="flex gap-5 border-b py-5 first:pt-0" style={{ borderColor: HAIRLINE }}>
                  <div className="flex h-28 w-24 shrink-0 items-center justify-center">
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image.url} alt={it.image.altText || it.title} className="h-full w-full object-contain" />
                    ) : (
                      <Symbol name="gear" className="h-8 w-8 opacity-40" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="room-display text-[17px] uppercase leading-tight">{it.title}</h2>
                        <p className="shrink-0 text-[15px]">{formatMoney(Number(it.price) * it.quantity, it.currency || cartCurrency)}</p>
                      </div>
                      {it.variantTitle && it.variantTitle !== 'Default Title' && <p className="room-eyebrow mt-1">{it.variantTitle}</p>}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center rounded-full border" style={{ borderColor: HAIRLINE }}>
                        <button type="button" onClick={() => dec(it.variantId)} aria-label={`One less ${it.title}`} className="flex h-11 w-11 items-center justify-center text-[18px] hover:opacity-70">
                          &minus;
                        </button>
                        <span className="w-6 text-center text-[14px] tabular-nums" aria-label={`${it.quantity} in the bag`}>{it.quantity}</span>
                        <button type="button" onClick={() => inc(it.variantId)} aria-label={`One more ${it.title}`} className="flex h-11 w-11 items-center justify-center text-[18px] hover:opacity-70">
                          +
                        </button>
                      </div>
                      <button type="button" onClick={() => remove(it.variantId)} className="room-eyebrow min-h-[44px] px-1 underline underline-offset-4 hover:opacity-70">
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* What it comes to, and the way out to Shopify's checkout */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-[calc(var(--room-top)+24px)]">
                <div className="flex items-center justify-between text-[15px]">
                  <span className="room-eyebrow">Subtotal</span>
                  <span>{formatMoney(subtotal, cartCurrency)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="room-eyebrow">Shipping</span>
                  <span className="room-eyebrow">At checkout</span>
                </div>

                {inventoryError && (
                  <p className="mt-5 border-l-2 pl-3 text-[14px]" style={{ borderColor: on }} role="alert">
                    {inventoryError}
                  </p>
                )}
                {checkoutError && (
                  <p className="mt-5 border-l-2 pl-3 text-[14px] leading-relaxed" style={{ borderColor: on }} role="alert">
                    {checkoutError}
                  </p>
                )}
                {isPreorderActive() && <p className="mt-5 text-[12px] leading-relaxed opacity-80">{PREORDER_DISCLAIMER}</p>}

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isRedirecting || isChecking}
                  className="mt-7 flex min-h-[52px] w-full items-center justify-center rounded-full text-[15px] font-semibold tracking-wide transition-[transform,opacity] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                  style={{ background: on, color: colour }}
                >
                  {isChecking ? 'Checking' : isRedirecting ? 'On the way' : checkoutError ? 'Try again' : (isPreorderActive() ? PREORDER_CHECKOUT_CTA : 'Checkout')}
                </button>
                <p className="room-eyebrow mt-4 text-center !text-[10px] opacity-70">Secure checkout by Shopify</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </RoomShell>
  );
}
