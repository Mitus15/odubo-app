/** Pre-order configuration — single source of truth for all pre-order messaging */

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
