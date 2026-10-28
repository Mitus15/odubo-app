'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { getMeasurementId } from '@/lib/gtag';

// The helpers that report to GA4 live in lib/gtag; kept here for what imported them from this file
export { getMeasurementId, trackEvent, trackPageView, ecommerce } from '@/lib/gtag';

/**
 * Google Analytics 4 Component
 *
 * Add NEXT_PUBLIC_GA_MEASUREMENT_ID to your environment variables.
 * Respects GDPR consent via the existing GDPRConsent component.
 */
export default function GoogleAnalytics() {
  const measurementId = getMeasurementId();
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
