/**
 * Pre-order configuration: single source of truth for all pre-order messaging.
 *
 * Two kinds of pre-order. DROP_DATE is a switch for the WHOLE store (every
 * product reads as a pre-order until that date; it passed on 2026-07-15 and is
 * off). A single product can also be a pre-order on its own, by its Shopify
 * tags: `preorder`, and `ships:<when>` for the line under its price. The Loop
 * Soul vinyl is made this way (scripts/shopify/loop-soul-vinyl.ts), so it can
 * be pre-ordered beside pieces that ship now.
 */

export const DROP_DATE = '2026-07-15T00:00:00';

export function isPreorderActive(): boolean {
  return new Date() < new Date(DROP_DATE);
}

export function getTimeUntilDrop(): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const diff = new Date(DROP_DATE).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

// CTA text
export const PREORDER_CTA = 'Pre-Order';
export const PREORDER_CTA_ANOTHER = 'Pre-Order Another';
export const PREORDER_CHECKOUT_CTA = 'Complete Pre-Order';
export const PREORDER_FEEDBACK = 'Pre-ordered';

// Messaging
export const PREORDER_SHIP_TEXT = 'Ships after July 15';
export const PREORDER_DISCLAIMER =
  'Pre-order items ship after July 15. You\u2019ll receive a shipping confirmation when your order is on its way.';

/** A product that is a pre-order on its own, by its tags. */
export const PREORDER_TAG = 'preorder';

export function isPreorderProduct(tags: readonly string[] | null | undefined): boolean {
  return !!tags?.some((t) => t.toLowerCase() === PREORDER_TAG);
}

/** "Ships in December." from the tag `ships:in December`, or null. */
export function preorderShipsLine(tags: readonly string[] | null | undefined): string | null {
  const t = tags?.find((x) => x.toLowerCase().startsWith('ships:'));
  const when = t?.slice('ships:'.length).trim();
  return when ? `Ships ${when}.` : null;
}
