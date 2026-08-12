"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProduct } from "@/lib/store/api";
import { formatMoney, getCountryFromCookie } from "@/lib/store/money";
import type { CartItem, Product, ProductVariant } from "@/lib/store/types";

/**
 * Pick a size, put it in the bag.
 *
 * The grid only ever holds a ProductSummary — one image, one "from" price, no
 * options — so the full product is fetched when the sheet opens. Apparel is the
 * whole point of this store, and a shirt added without a size is a support
 * email, so nothing can be added until a variant actually resolves.
 *
 * X to close, no drag-to-close (house rule).
 */
export function AddToBagSheet({
  handle,
  onAdd,
  onClose,
}: {
  handle: string;
  onAdd: (item: CartItem) => void;
  onClose: () => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<Record<string, string>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let live = true;
    fetchProduct(handle, getCountryFromCookie())
      .then((p) => {
        if (!live) return;
        setProduct(p);
        setFailed(p === null);
        // Preselect the first option value that actually leads to stock, so the
        // common case is one tap and the sheet never opens on a dead variant.
        if (p) {
          const first = p.variants.find((v) => v.available) ?? p.variants[0];
          if (first) setChosen(first.selectedOptions);
        }
      })
      .catch(() => live && setFailed(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [handle]);

  const variant: ProductVariant | null = useMemo(() => {
    if (!product) return null;
    const names = product.options.map((o) => o.name);
    return (
      product.variants.find((v) => names.every((n) => v.selectedOptions[n] === chosen[n])) ?? null
    );
  }, [product, chosen]);

  const canAdd = Boolean(variant?.available);

  const add = () => {
    if (!product || !variant || !variant.available) return;
    onAdd({
      variantId: variant.id,
      productHandle: product.handle,
      title: product.title,
      variantTitle: variant.title,
      price: variant.price,
      currency: variant.currency,
      quantity: 1,
      image: variant.image ?? product.images[0] ?? null,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Add to bag"
      onClick={onClose}
    >
      <div
        className="loop-glass max-h-[88vh] w-full overflow-y-auto rounded-t-3xl p-5 sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold leading-tight">
            {loading ? "Loading…" : (product?.title ?? "Unavailable")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-xl leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>

        {failed && (
          <p className="py-6 text-sm opacity-70">
            This piece couldn&rsquo;t be loaded. It may have sold out or been removed.
          </p>
        )}

        {product && (
          <>
            {product.images[0]?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={variant?.image?.url || product.images[0].url}
                alt={product.images[0].altText || product.title}
                className="mt-4 aspect-square w-full rounded-2xl object-cover"
              />
            )}

            {product.options
              // A single-value option ("Title: Default Title") is Shopify's
              // no-variants placeholder — showing it as a choice is noise.
              .filter((o) => o.values.length > 1)
              .map((option) => (
                <fieldset key={option.name} className="mt-5">
                  <legend className="pb-2 text-xs font-semibold uppercase tracking-[0.2em] opacity-55">
                    {option.name}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const selected = chosen[option.name] === value;
                      // Grey out combinations Shopify has no stock for, rather
                      // than letting someone pick their way into "sold out".
                      const reachable = product.variants.some(
                        (v) => v.selectedOptions[option.name] === value && v.available,
                      );
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setChosen((c) => ({ ...c, [option.name]: value }))}
                          className={[
                            "rounded-full border px-4 py-2 text-sm transition-colors",
                            selected ? "border-ink bg-ink text-sand" : "border-ink/25 hover:border-ink/50",
                            reachable ? "" : "opacity-35 line-through",
                          ].join(" ")}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

            <div className="mt-6 flex items-center justify-between gap-4">
              <span className="text-lg font-bold">
                {formatMoney(
                  variant?.price ?? product.variants[0]?.price ?? 0,
                  variant?.currency ?? product.variants[0]?.currency,
                )}
              </span>
              <button
                type="button"
                onClick={add}
                disabled={!canAdd}
                className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-sand transition-opacity disabled:opacity-40"
              >
                {canAdd ? "Add to bag" : variant ? "Sold out" : "Choose an option"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AddToBagSheet;
