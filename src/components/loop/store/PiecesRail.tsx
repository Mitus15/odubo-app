"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProductSummary } from "@/lib/store/types";
import { formatMoney } from "@/lib/store/money";
import { useLoopCart } from "@/hooks/useLoopCart";
import AddToBagSheet from "@/components/loop/store/AddToBagSheet";
import LoopBag from "@/components/loop/store/LoopBag";

/**
 * The shelf, on the front door. Four pieces from the `loop-soul` collection,
 * image only — the garment is its own name, the sheet says the rest. The
 * photos are cut-outs (transparent PNG), so nothing is painted behind them:
 * the garment sits on the sand like everything else on the poster. Tapping
 * one opens the same AddToBagSheet and bag `/loop/store` uses, over the same
 * `loop_soul_cart`, so a bag started here is the bag found there.
 *
 * Typography and a hairline, no bubbles: the pass button stays the only drawn
 * shape on the poster. The right-hand line is the route to the full shelf
 * until something is in the bag, and then it is the bag.
 */
export function PiecesRail({ pieces }: { pieces: ProductSummary[] }) {
  const [adding, setAdding] = useState<string | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const { cart, isHydrated, addItem, setQuantity, removeItem } = useLoopCart();

  if (pieces.length === 0) return null;
  const hasBag = isHydrated && cart.itemCount > 0;

  return (
    <section aria-labelledby="pieces-heading" className="w-full border-t border-ink/15 pt-2.5">
      <div className="flex items-baseline justify-between">
        <h2
          id="pieces-heading"
          className="text-[10px] font-semibold uppercase tracking-[0.3em] opacity-55"
        >
          Pieces
        </h2>
        {hasBag ? (
          <button
            type="button"
            onClick={() => setBagOpen(true)}
            className="text-[10px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
          >
            Bag · <span className="tabular-nums">{cart.itemCount}</span>
          </button>
        ) : (
          <Link
            href="/loop/store"
            className="loop-muted text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-100"
          >
            The Store →
          </Link>
        )}
      </div>

      <ul className="mt-2 grid grid-cols-4 gap-2">
        {pieces.slice(0, 4).map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={!p.available}
              onClick={() => setAdding(p.handle)}
              aria-label={`${p.title} · ${formatMoney(p.price, p.currency)}`}
              className="group block w-full text-left disabled:cursor-not-allowed"
            >
              <div className="relative aspect-square">
                {p.image?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image.url}
                    alt={p.image.altText || p.title}
                    className="piece piece-sm h-full w-full object-contain"
                    loading="lazy"
                  />
                ) : null}
                {!p.available && (
                  <div className="absolute inset-0 flex items-center justify-center bg-sand/70 text-[9px] font-bold uppercase tracking-[0.2em]">
                    Sold out
                  </div>
                )}
              </div>
              <p className="mt-1 text-center text-[10px] tabular-nums opacity-70">
                {formatMoney(p.price, p.currency)}
              </p>
            </button>
          </li>
        ))}
      </ul>

      {adding && (
        <AddToBagSheet
          handle={adding}
          onAdd={(item) => {
            addItem(item);
            setBagOpen(true);
          }}
          onClose={() => setAdding(null)}
        />
      )}

      {bagOpen && (
        <LoopBag
          cart={cart}
          onSetQuantity={setQuantity}
          onRemove={removeItem}
          onClose={() => setBagOpen(false)}
        />
      )}
    </section>
  );
}

export default PiecesRail;
