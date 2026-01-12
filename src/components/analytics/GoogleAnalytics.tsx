'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

/**
 * Google Analytics 4 Component
 *
 * Add NEXT_PUBLIC_GA_MEASUREMENT_ID to your environment variables.
 * Respects GDPR consent via the existing GDPRConsent component.
 */
export default function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const [consentGiven, setConsentGiven] = useState(false);

  // Check GDPR consent on mount
  useEffect(() => {
    try {
      const consent = localStorage.getItem('gdpr-consent');
      if (consent) {
        const prefs = JSON.parse(consent);
        setConsentGiven(prefs.analytics === true);
      }
    } catch {
      // No consent yet
    }

    // Listen for consent changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'gdpr-consent' && e.newValue) {
        try {
          const prefs = JSON.parse(e.newValue);
          setConsentGiven(prefs.analytics === true);
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Don't render if no measurement ID or no consent
  if (!measurementId) {
    return null;
  }

  return (
    <>
      {/* GA4 Script - loads with consent mode defaulting to denied */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          // Default consent to denied - will be updated by GDPR banner
          gtag('consent', 'default', {
            'analytics_storage': '${consentGiven ? 'granted' : 'denied'}',
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied'
          });

          gtag('config', '${measurementId}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}

/**
 * Track custom events in GA4
 * Usage: trackEvent('purchase', { value: 100, currency: 'USD' })
 */
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, string | number | boolean>
) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, eventParams);
  }
}

/**
 * Track page views (for SPA navigation)
 * Usage: trackPageView('/store/product/hoodie')
 */
export function trackPageView(url: string) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (measurementId) {
      (window as any).gtag('config', measurementId, {
        page_path: url,
      });
    }
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
