/**
 * Talking to GA4 once it is on the page (components/analytics/GoogleAnalytics
 * puts it there, with consent). Kept apart from that component so what only
 * reports an event (the email capture under every room's Save your progress)
 * does not carry next/script with it.
 */

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

type Gtag = (...args: unknown[]) => void;

/** GA4's gtag, once its script is on the page */
function gtag(): Gtag | undefined {
  return typeof window === 'undefined' ? undefined : (window as Window & { gtag?: Gtag }).gtag;
}

/**
 * The GA4 measurement ID from the environment, or null if it is missing or malformed.
 *
 * The ID is written into an inline script, so it must be exactly `G-XXXXXXXXXX`.
 * Production once held it with a trailing newline, which split a string literal
 * and threw a SyntaxError on every page; GA never loaded.
 */
export function getMeasurementId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id && MEASUREMENT_ID_PATTERN.test(id) ? id : null;
}

/**
 * Track custom events in GA4
 * Usage: trackEvent('purchase', { value: 100, currency: 'USD' })
 */
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, string | number | boolean>
) {
  gtag()?.('event', eventName, eventParams);
}

/**
 * Track page views (for SPA navigation)
 * Usage: trackPageView('/store/product/hoodie')
 */
export function trackPageView(url: string) {
  const send = gtag();
  const measurementId = getMeasurementId();
  if (send && measurementId) {
    send('config', measurementId, {
      page_path: url,
    });
  }
}

/**
 * Track e-commerce events
 */
export const ecommerce = {
  viewItem: (item: { id: string; name: string; price: number }) => {
    trackEvent('view_item', {
      currency: 'USD',
      value: item.price,
      items: JSON.stringify([{ item_id: item.id, item_name: item.name, price: item.price }]),
    });
  },

  addToCart: (item: { id: string; name: string; price: number; quantity: number }) => {
    trackEvent('add_to_cart', {
      currency: 'USD',
      value: item.price * item.quantity,
      items: JSON.stringify([{
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      }]),
    });
  },

  beginCheckout: (value: number, itemCount: number) => {
    trackEvent('begin_checkout', {
      currency: 'USD',
      value,
      items_count: itemCount,
    });
  },

  // Track email signup as conversion
  signUp: (method: string = 'email') => {
    trackEvent('sign_up', { method });
  },
};
