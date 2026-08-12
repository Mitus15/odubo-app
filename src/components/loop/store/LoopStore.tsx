"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProductSummary } from "@/lib/store/types";
import { LOOP_PASS_TAG } from "@/lib/store/brands";
import { formatMoney } from "@/lib/store/money";
import GetPassModal from "@/components/loop/gathering/GetPassModal";

type Capacity = { total: number; sold: number; remaining: number };

/**
 * The Loop Soul shelf.
 *
 * Two kinds of thing live here and they do NOT behave alike. Merch is
 * ordinary commerce — pick it up, it goes in the bag. A pass is admission to a
 * room with a hard capacity, sold through the configured Shopify checkout and
 * counted by the order webhook, so it keeps its own flow (GetPassModal) rather
 * than being dropped in a bag where the count could drift between adding and
 * paying. The tag is what tells them apart.
 */
export function LoopStore({
  products,
  collectionMissing,
  capacity,
  checkoutUrl,
  price,
  currency,
  eventTitle,
  theme,
  venue,
  dateLabel,
  timeLabel,
}: {
  products: ProductSummary[];
  /** True when the Shopify collection itself is absent — not merely empty. */
  collectionMissing: boolean;
  capacity: Capacity;
  checkoutUrl?: string | null;
  price?: string | null;
  currency?: string | null;
  eventTitle: string;
  theme: string;
  venue: string;
  dateLabel: string;
  timeLabel: string;
}) {
  const [passOpen, setPassOpen] = useState(false);

  const { passes, merch } = useMemo(() => {
    const isPass = (p: ProductSummary) => p.tags?.includes(LOOP_PASS_TAG);
    return {
      passes: products.filter(isPass),
      merch: products.filter((p) => !isPass(p)),
    };
  }, [products]);

  // The pass is buyable even when Shopify has nothing set up yet: the checkout
  // link and capacity come from loop_settings, not from the collection. A
  // half-configured store must never be a closed door.
  const showPassCard = passes.length > 0 || Boolean(checkoutUrl);
  const passProduct = passes[0];
  const soldOut = capacity.remaining <= 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-2">
      <header className="pb-8 pt-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Store</h1>
        <p className="mt-2 max-w-md text-sm opacity-70">
          Passes and pieces for {eventTitle} · {theme}. Everything else the studio
          makes lives at odubo.
        </p>
      </header>

      {showPassCard && (
        <section aria-labelledby="pass-heading" className="pb-12">
          <h2 id="pass-heading" className="pb-3 text-xs font-semibold uppercase tracking-[0.3em] opacity-55">
            Admission
          </h2>
          <button
            type="button"
            onClick={() => setPassOpen(true)}
            className="group flex w-full items-stretch gap-4 overflow-hidden rounded-2xl border border-ink/15 bg-ink/[0.04] text-left transition-colors hover:bg-ink/[0.07] sm:gap-6"
          >
            <div className="relative aspect-square w-32 shrink-0 overflow-hidden bg-ink/10 sm:w-44">
              {passProduct?.image?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={passProduct.image.url}
                  alt={passProduct.image.altText || `${eventTitle} pass`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] opacity-45">
                  Admits one
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center py-4 pr-4 sm:py-6">
              <h3 className="truncate text-lg font-bold sm:text-xl">
                {passProduct?.title || `${eventTitle} — Pass`}
              </h3>
              <p className="mt-1 text-sm opacity-70">
                {dateLabel} · {timeLabel} · {venue}
              </p>
              <p className="mt-3 text-sm font-semibold">
                {soldOut
                  ? "Sold out"
                  : `${price ? formatMoney(price, currency) : "Get a pass"} · ${capacity.remaining} of ${capacity.total} left`}
              </p>
            </div>
          </button>
        </section>
      )}

      <section aria-labelledby="merch-heading">
        <h2 id="merch-heading" className="pb-3 text-xs font-semibold uppercase tracking-[0.3em] opacity-55">
          Pieces
        </h2>

        {merch.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/20 px-5 py-8 text-center text-sm opacity-60">
            {collectionMissing
              ? "The shelf isn't built yet — no loop-soul collection in Shopify."
              : "Nothing on the shelf yet. Pieces drop with the volume."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {merch.map((p) => (
              <Link
                key={p.id}
                href={`/store/product/${p.handle}`}
                className="group block overflow-hidden rounded-xl border border-ink/10 bg-ink/[0.03] transition-colors hover:bg-ink/[0.06]"
              >
                <div className="relative aspect-square overflow-hidden bg-ink/10">
                  {p.image?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image.url}
                      alt={p.image.altText || p.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : null}
                  {!p.available && (
                    <div className="absolute inset-0 flex items-center justify-center bg-sand/70 text-[10px] font-bold uppercase tracking-[0.2em]">
                      Sold out
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="mt-0.5 text-xs opacity-70">{formatMoney(p.price, p.currency)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Back to the studio — quiet on purpose. Loop Soul is the room you are
          standing in; odubo is the rest of the building, not a competing sale. */}
      <footer className="mt-16 border-t border-ink/10 pt-6">
        <Link
          href="/store"
          className="group inline-flex items-center gap-1.5 text-sm opacity-60 transition-opacity hover:opacity-100"
        >
          The rest of the studio
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </footer>

      {passOpen && (
        <GetPassModal
          capacity={capacity}
          checkoutUrl={checkoutUrl}
          price={price}
          currency={currency}
          eventTitle={eventTitle}
          theme={theme}
          venue={venue}
          dateLabel={dateLabel}
          timeLabel={timeLabel}
          onClose={() => setPassOpen(false)}
        />
      )}
    </main>
  );
}

export default LoopStore;
