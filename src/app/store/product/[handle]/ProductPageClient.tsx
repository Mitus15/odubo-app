'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { labelCredit, labelLockup } from '@/lib/store/brands';
import { usePageAnalytics } from '@/hooks/usePageAnalytics';
import { useAnalyticsSafe } from '@/contexts/AnalyticsContext';
import { useStore } from '@/contexts/StoreContext';
import { MADE_TO_ORDER_LINK, MADE_TO_ORDER_LINK_TEXT, MADE_TO_ORDER_TEXT } from '@/lib/store/madeToOrder';
import { isPreorderActive, PREORDER_CTA, PREORDER_FEEDBACK, PREORDER_SHIP_TEXT } from '@/config/preorder';
import { formatMoney } from '@/lib/store/money';
import { onRoom, ROOM_DARK } from '@/lib/room';
import type { PieceBounds } from '@/lib/store/pieceLook';
import { RoomShell, Symbol } from '@/components/room/RoomParts';
import { Cutout, Piece, sized } from '@/components/room/PieceOnFloor';
import { fly, useLanding } from '@/components/room/flight';

// Define the shape of the product data
interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description?: string;
  descriptionHtml?: string;
  vendor?: string;
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
  /** The piece's room, the same colour it stands in on /gear (lib/store/pieceLook); null: the house's dark */
  room: string | null;
  /** Each photo's crop to what is visible in it, by its address without the query */
  bounds: Record<string, PieceBounds | null>;
}

/** A line drawn in the room's writing, faint */
const HAIRLINE = 'color-mix(in srgb, currentColor 35%, transparent)';

/**
 * A piece's own page, in its room: the colour it has in /gear, the piece
 * standing on the same floor, and under it its name, the label, the price,
 * the sizes and the one drawn shape, Add to bag. The hanger at the top goes
 * back to the gear, opened on this piece; the bag, once something is in it,
 * stands beside the hanger. The danceman goes home.
 *
 * From /gear the piece flies in (components/room/flight), and the hanger
 * flies it back; the gear's page is fetched while this one is read, so the
 * way back has nothing to wait for.
 */
export default function ProductPageClient({ product, room, bounds }: ProductPageClientProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<boolean>(false);
  // The one bag (lib/store/bag.ts): the same one the grid, QuickShop and the badge read.
  const { addToCart: addToBag, cartItemCount } = useStore();
  const hasCartItems = cartItemCount > 0;

  const colour = room || ROOM_DARK;
  const on = onRoom(colour);
  const lockup = labelLockup(product?.vendor);
  const credit = labelCredit(product?.vendor);
  const bagHref = `/store/cart?room=${colour.slice(1)}`;
  const gearHref = `/gear?piece=${encodeURIComponent(product.handle)}`;
  const router = useRouter();
  const floor = useRef<HTMLDivElement>(null);
  const standing = () => floor.current?.querySelector<HTMLElement>('[data-piece]') ?? null;
  useLanding(standing);
  // The way back, fetched while this page is read
  useEffect(() => {
    const t = window.setTimeout(() => router.prefetch(gearHref), 600);
    return () => window.clearTimeout(t);
  }, [gearHref, router]);

  // Page analytics
  usePageAnalytics({ title: `${product?.title} | Odubo Studio` });
  const analytics = useAnalyticsSafe();

  // Track product view on mount
  useEffect(() => {
    if (product?.handle) {
      analytics?.trackProductView(product.handle);
    }
  }, [product?.handle, analytics]);

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

  // Sync active image with selected variant
  useEffect(() => {
    if (selectedVariant?.image?.src) {
      setActiveImage(selectedVariant.image.src);
    }
  }, [selectedVariant]);

  const handleThumbnailClick = (src: string) => {
    setActiveImage(src);
    // Find if this image belongs to a specific variant
    const variant = product.variants?.find(v => v.image?.src === src);
    if (variant && variant.available !== false) {
      if (variant.selectedOptions) {
        setSelectedOptions(variant.selectedOptions);
      }
    }
  };

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
      const v = product?.variants?.find(v => v.id === variantId);
      if (!v) return;
      const imageSrc = v.image?.src || product?.images?.[0]?.src;
      addToBag({
        variant: {
          id: v.id,
          title: v.title,
          price: parseFloat(String(v.price)),
          currency: v.currency || '',
          image: imageSrc ? { url: imageSrc } : null,
        },
        productHandle: product?.handle || '',
        productTitle: product?.title || '',
        quantity: 1,
      });

      // Track add to cart
      analytics?.trackAddToCart(product?.handle || '', parseFloat(String(v.price)), variantId);

      // update UI state
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    } catch (e) {
      console.warn('Failed to update cart', e);
    }
  };

  const images = product?.images || [];
  const shown = activeImage || selectedVariant?.image?.src || images[0]?.src || null;
  const boundsOf = (src: string) => bounds[src.split('?')[0]] ?? null;
  const available = !!selectedVariant?.available;
  const choices = (product?.options || []).filter((o) => o.values.length > 1);

  const corner = (
    <div className="flex items-center">
      {hasCartItems && (
        <Link
          href={bagHref}
          aria-label={`Your bag, ${cartItemCount} ${cartItemCount === 1 ? 'piece' : 'pieces'}`}
          className="relative flex h-11 w-11 items-center justify-center transition-[opacity,transform] hover:opacity-70 active:scale-95"
        >
          <Symbol name="bag" className="h-6 w-6" />
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold" style={{ background: on, color: colour }}>
            {cartItemCount}
          </span>
        </Link>
      )}
      <Link
        href={gearHref}
        onClick={(e) => {
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          fly(standing(), () => router.push(gearHref));
        }}
        aria-label="Back to the gear"
        title="The gear"
        className="flex h-11 w-11 items-center justify-center transition-[opacity,transform] hover:opacity-70 active:scale-95"
      >
        <Symbol name="gear" className="h-6 w-6" />
      </Link>
    </div>
  );

  return (
    <RoomShell colour={colour} on={on} corner={corner}>
      <main
        className="room-fade mx-auto w-full max-w-5xl px-5 lg:grid lg:min-h-[calc(100%-var(--room-top))] lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-10"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}
      >
        {/* The piece, on its floor */}
        <div>
          <div ref={floor} className="product-floor flex items-center justify-center [container-type:size]">
            {shown && <Piece key={shown} src={sized(shown)} alt={product.title} bounds={boundsOf(shown)} eager stands={72} />}
          </div>
          {/* Its other photos: small, cut out, no frames */}
          {images.length > 1 && (
            <ul className="mt-1 flex justify-center gap-2" aria-label="Photos of the piece">
              {images.slice(0, 6).map((img, i) => {
                const here = shown?.split('?')[0] === img.src.split('?')[0];
                return (
                  <li key={img.src}>
                    <button
                      type="button"
                      onClick={() => handleThumbnailClick(img.src)}
                      aria-label={`Photo ${i + 1}`}
                      aria-pressed={here}
                      className={`flex h-12 w-12 flex-col items-center justify-end gap-1 pb-0.5 transition-opacity ${here ? 'opacity-100' : 'opacity-55 hover:opacity-90'}`}
                    >
                      <span className="flex h-9 w-11 items-end justify-center [container-type:size]">
                        <Cutout src={sized(img.src, 120)} alt="" bounds={boundsOf(img.src)} size="min(100cqw, calc(100cqh * var(--ratio)))" eager={false} />
                      </span>
                      <span className={`h-[2px] w-4 rounded-full bg-current transition-opacity ${here ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Under it: what it is, and how to get it */}
        <div className="mt-4 text-center lg:mt-0 lg:text-left">
          <h1 className="room-display text-[clamp(24px,7vw,40px)] uppercase leading-[0.95] [text-wrap:balance]">{product?.title || 'Product'}</h1>
          {/* The full lockup: the label's full name, and the house's signature on its own line */}
          <p className="mt-2 text-[10px] uppercase tracking-[0.22em] opacity-80">
            {lockup.name}
            {lockup.signature && <span className="mt-1 block text-[9px] normal-case tracking-[0.18em]">{lockup.signature}</span>}
          </p>
          {selectedVariant && <p className="mt-3 text-[17px]">{formatMoney(parseFloat(selectedVariant.price), selectedVariant.currency)}</p>}

          {/* Options: only the ones with a choice in them (a piece in one colour does not ask for it) */}
          {choices.length > 0 && (
            <div className="mt-6 space-y-5">
              {choices.map((opt) => (
                <fieldset key={opt.name}>
                  <legend className="room-eyebrow mx-auto mb-2.5 lg:mx-0">{opt.name}</legend>
                  <div className="flex flex-wrap justify-center gap-1.5 lg:justify-start">
                    {opt.values.map(val => {
                      const isSelected = selectedOptions[opt.name] === val;
                      // Determine availability
                      const tentative = { ...selectedOptions, [opt.name]: val };
                      const anyMatch = product?.variants?.some(v => {
                        const isInStock = (v.available !== false) && (v.quantityAvailable == null || v.quantityAvailable > 0);
                        if (!isInStock) return false;
                        const so = v.selectedOptions || {};
                        return (product?.options || []).every(o => tentative[o.name] ? so[o.name] === tentative[o.name] : true);
                      });
                      const disabled = !anyMatch;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => !disabled && setSelectedOptions(prev => ({ ...prev, [opt.name]: val }))}
                          disabled={disabled}
                          aria-pressed={isSelected}
                          className={`min-h-[44px] min-w-[46px] rounded-full border px-3 text-[14px] transition-[background-color,color,border-color,opacity] duration-300 ${disabled ? 'cursor-not-allowed line-through opacity-35' : 'active:scale-95'}`}
                          style={(isSelected ? { background: on, color: colour, borderColor: on } : { borderColor: HAIRLINE }) as CSSProperties}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          {/* The room's one drawn shape, and the way to the bag once something is in it */}
          <div className="mx-auto mt-7 flex max-w-sm flex-col gap-3 lg:mx-0">
            <button
              type="button"
              onClick={addToCart}
              disabled={!available}
              className="flex min-h-[52px] w-full items-center justify-center rounded-full text-[15px] font-semibold tracking-wide transition-[transform,opacity] duration-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: on, color: colour }}
            >
              {justAdded ? (isPreorderActive() ? PREORDER_FEEDBACK : 'In your bag') : (!available ? 'Sold out' : (isPreorderActive() ? PREORDER_CTA : 'Add to bag'))}
            </button>
            {hasCartItems && (
              <Link
                href={bagHref}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border text-[14px] transition-opacity hover:opacity-80"
                style={{ borderColor: HAIRLINE }}
              >
                <Symbol name="bag" className="h-[18px] w-[18px]" />
                Go to bag
              </Link>
            )}
          </div>

          {/* The description (the fabric, the care, the size guide) waits behind
              one line: the page shows the piece and how to get it, and the
              rest is there for whoever asks (owner, 2026-10-26: "ugly and
              mechanical looking"). A native <details>, so it opens without
              script and reads as a button to a screen reader. */}
          {(product?.descriptionHtml || product?.description) && (
            <details className="group mx-auto mt-8 max-w-md text-left lg:mx-0">
              <summary className="room-eyebrow mx-auto flex min-h-[44px] w-fit cursor-pointer select-none list-none items-center gap-2 lg:mx-0 [&::-webkit-details-marker]:hidden">
                <span className="underline underline-offset-4 group-open:hidden">See details</span>
                <span className="hidden underline underline-offset-4 group-open:inline">Hide details</span>
                <span aria-hidden className="text-sm leading-none transition-transform group-open:rotate-45">+</span>
              </summary>
              {product?.descriptionHtml ? (
                <div className="product-details mt-4" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
              ) : (
                <p className="product-details mt-4">{product?.description}</p>
              )}
              {/* The credit, where a hang tag's inside would say who made it */}
              {credit && <p className="product-details product-credit mt-5">{credit}</p>}
            </details>
          )}

          {/* Made to order, in the policy's own words. The two lines that stood
              here ("Free shipping on orders over $150", "Ships from Canada")
              were promises nothing backed: the rates are Shopify's and the
              clothes are made and shipped by the fulfilment partner. */}
          <div className="mx-auto mt-8 max-w-md space-y-2 border-t pt-6 text-[10px] uppercase tracking-[0.18em] opacity-80 lg:mx-0" style={{ borderColor: HAIRLINE }}>
            {isPreorderActive() && <p>{PREORDER_SHIP_TEXT}</p>}
            <p>
              {MADE_TO_ORDER_TEXT}{' '}
              <a href={MADE_TO_ORDER_LINK} className="underline underline-offset-4 hover:opacity-70">
                {MADE_TO_ORDER_LINK_TEXT}
              </a>
            </p>
          </div>
        </div>
      </main>
    </RoomShell>
  );
}
