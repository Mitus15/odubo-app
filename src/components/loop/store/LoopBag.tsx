"use client";

import { useEffect, useState } from "react";
import { createCheckout } from "@/lib/store/api";
import { formatMoney, getCountryFromCookie } from "@/lib/store/money";
import type { Cart } from "@/lib/store/types";

/**
 * The Loop Soul bag.
 *
 * Checkout stamps `_source: loop_soul_store` so Loop sales are separable from
 * odubo's in reporting — same Shopify store, two businesses.
 *
 * The bag is NOT cleared on checkout. The redirect hands off to Shopify and we
 * never hear whether the buyer paid or hit back; clearing on the way out means
 * anyone who returns to adjust an order finds an empty bag and has to rebuild
 * it. Shopify owns the cart from the redirect on.
 */
export function LoopBag({
  cart,
  onSetQuantity,
  onRemove,
  onClose,
}: {
  cart: Cart;
  onSetQuantity: (variantId: string, quantity: number) => void;
  onRemove: (variantId: string) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await createCheckout(
        cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        { source: "loop_soul_store", entryPath: "/loop/store" },
        getCountryFromCookie(),
      );
      if (!url) throw new Error("no checkout url");
      window.location.href = url;
    } catch {
      // Never strand someone holding a bag they can't pay for.
      setError("Checkout couldn't start. Your bag is safe — try again.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Your bag"
      onClick={onClose}
    >
      <aside
        className="loop-glass flex h-full w-full max-w-sm flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 className="text-base font-bold">
            Your bag{cart.itemCount > 0 && ` · ${cart.itemCount}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bag"
            className="rounded-full p-2 text-xl leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.items.length === 0 ? (
            <p className="py-10 text-center text-sm opacity-60">Nothing in the bag yet.</p>
          ) : (
            <ul className="space-y-4">
              {cart.items.map((item) => (
                <li key={item.variantId} className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink/10">
                    {item.image?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image.url}
                        alt={item.image.altText || item.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{item.title}</p>
                    {item.variantTitle && item.variantTitle !== "Default Title" && (
                      <p className="mt-0.5 text-xs opacity-65">{item.variantTitle}</p>
                    )}
                    <p className="mt-1 text-sm">{formatMoney(item.price, item.currency)}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center rounded-full border border-ink/20">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${item.title}`}
                          onClick={() => onSetQuantity(item.variantId, item.quantity - 1)}
                          className="px-3 py-1 text-sm"
                        >
                          −
                        </button>
                        <span className="min-w-[1.5rem] text-center text-sm tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.title}`}
                          onClick={() => onSetQuantity(item.variantId, item.quantity + 1)}
                          className="px-3 py-1 text-sm"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(item.variantId)}
                        className="text-xs underline opacity-55 hover:opacity-100"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.items.length > 0 && (
          <footer className="border-t border-ink/10 px-5 py-4">
            <div className="flex items-center justify-between pb-3 text-sm">
              <span className="opacity-70">Subtotal</span>
              <span className="font-bold">{formatMoney(cart.subtotal, cart.currency)}</span>
            </div>
            {error && <p className="pb-3 text-xs text-ink/80">{error}</p>}
            <button
              type="button"
              onClick={checkout}
              disabled={busy}
              className="w-full rounded-full bg-ink py-3.5 text-sm font-bold text-sand transition-opacity disabled:opacity-50"
            >
              {busy ? "Starting checkout…" : "Checkout"}
            </button>
            <p className="pt-2 text-center text-[11px] opacity-50">
              Shipping and taxes calculated at checkout.
            </p>
          </footer>
        )}
      </aside>
    </div>
  );
}

export default LoopBag;
