"use client";

import { useState, useEffect } from 'react';
import { isMonitoringEnabled } from '../config/monitoring';
import { CONSENT_KEY, notifyConsentChange } from '@/lib/consent';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

interface GDPRConsentProps {
  onConsentChange?: (preferences: CookiePreferences) => void;
}

export default function GDPRConsent({ onConsentChange }: GDPRConsentProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always true
    analytics: false,
    marketing: false,
    functional: false,
  });
  
  // Use monitoring configuration
  const isEnabled = isMonitoringEnabled('gdpr');

  useEffect(() => {
    // Check if user has already given consent
    const hasConsent = localStorage.getItem(CONSENT_KEY);
    if (!hasConsent) {
      setShowBanner(true);
    } else {
      try {
        const savedPreferences = JSON.parse(hasConsent);
        setPreferences(savedPreferences);
        onConsentChange?.(savedPreferences);
      } catch (error) {
        console.error('Error parsing GDPR consent:', error);
        setShowBanner(true);
      }
    }
  }, [onConsentChange]);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    };
    
    setPreferences(allAccepted);
    localStorage.setItem(CONSENT_KEY, JSON.stringify(allAccepted));
    notifyConsentChange();
    setShowBanner(false);
    onConsentChange?.(allAccepted);
    
    // Apply analytics and marketing cookies
    enableAnalytics();
    enableMarketing();
    enableFunctional();
  };

  const handleAcceptNecessary = () => {
    const necessaryOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    };
    
    setPreferences(necessaryOnly);
    localStorage.setItem(CONSENT_KEY, JSON.stringify(necessaryOnly));
    notifyConsentChange();
    setShowBanner(false);
    onConsentChange?.(necessaryOnly);
    
    // Disable non-necessary cookies
    disableAnalytics();
    disableMarketing();
    disableFunctional();
  };

  const handleSavePreferences = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(preferences));
    notifyConsentChange();
    setShowPreferences(false);
    onConsentChange?.(preferences);
    
    // Apply cookie preferences
    if (preferences.analytics) enableAnalytics();
    else disableAnalytics();
    
    if (preferences.marketing) enableMarketing();
    else disableMarketing();
    
    if (preferences.functional) enableFunctional();
    else disableFunctional();
  };

  const handlePreferenceChange = (key: keyof CookiePreferences, value: boolean) => {
    if (key === 'necessary') return; // Cannot disable necessary cookies
    
    setPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Cookie management functions
  const enableAnalytics = () => {
    // Enable Google Analytics, etc.
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted',
      });
    }
  };

  const disableAnalytics = () => {
    // Disable Google Analytics, etc.
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'denied',
      });
    }
  };

  const enableMarketing = () => {
    // Enable marketing cookies
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
      });
    }
  };

  const disableMarketing = () => {
    // Disable marketing cookies
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
    }
  };

  const enableFunctional = () => {
    // Enable functional cookies (preferences, etc.)
    console.log('Functional cookies enabled');
  };

  const disableFunctional = () => {
    // Disable functional cookies
    console.log('Functional cookies disabled');
  };

  const openPreferences = () => {
    setShowPreferences(true);
  };

  const closePreferences = () => {
    setShowPreferences(false);
  };

  // Don't render anything if not enabled
  if (!isEnabled) {
    return null;
  }

  // Don't render anything if consent already given
  if (!showBanner && !showPreferences) {
    return null;
  }

  if (showPreferences) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="glass-surface border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto text-[#ede8df]">
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-[#ede8df]">🍪 Cookie Preferences</h2>
            <p className="text-sm text-stone-300 mt-2">
              Manage your cookie preferences and data processing consent.
            </p>
          </div>

          {/* Cookie Categories */}
          <div className="p-6 space-y-4">
            {/* Necessary Cookies */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[#ede8df]">Necessary Cookies</h3>
                <p className="text-sm text-stone-300">
                  Required for the website to function properly.
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.necessary}
                  disabled
                  className="w-4 h-4 text-[#843c2d] bg-white/10 border-white/20 rounded focus:ring-[#843c2d]"
                />
                <span className="ml-2 text-sm text-stone-400">Always Active</span>
              </div>
            </div>

            {/* Analytics Cookies */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[#ede8df]">Analytics Cookies</h3>
                <p className="text-sm text-stone-300">
                  Help us understand how visitors interact with our website.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) => handlePreferenceChange('analytics', e.target.checked)}
                className="w-4 h-4 text-[#843c2d] bg-white/10 border-white/20 rounded focus:ring-[#843c2d]"
              />
            </div>

            {/* Marketing Cookies */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[#ede8df]">Marketing Cookies</h3>
                <p className="text-sm text-stone-300">
                  Used to deliver personalized advertisements.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={(e) => handlePreferenceChange('marketing', e.target.checked)}
                className="w-4 h-4 text-[#843c2d] bg-white/10 border-white/20 rounded focus:ring-[#843c2d]"
              />
            </div>

            {/* Functional Cookies */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-[#ede8df]">Functional Cookies</h3>
                <p className="text-sm text-stone-300">
                  Remember your preferences and settings.
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.functional}
                onChange={(e) => handlePreferenceChange('functional', e.target.checked)}
                className="w-4 h-4 text-[#843c2d] bg-white/10 border-white/20 rounded focus:ring-[#843c2d]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-white/10 flex space-x-3">
            <button
              onClick={closePreferences}
              className="flex-1 px-4 py-2 text-stone-300 border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePreferences}
              className="flex-1 px-4 py-2 bg-[#843c2d] text-white rounded-lg hover:bg-[#6f2f23] transition-colors border border-white/10"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Small, clean consent banner - positioned in center of page
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-surface border border-white/10 rounded-xl shadow-lg p-6 max-w-sm">
        <div className="text-center space-y-4">
          <div className="text-3xl">🍪</div>
          <h3 className="text-lg font-semibold text-[#ede8df]">We use cookies</h3>
          <p className="text-sm text-stone-300 leading-relaxed">
            To enhance your experience and analyze site usage
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleAcceptAll}
              className="w-full px-4 py-2 text-sm bg-[#843c2d] text-white rounded-lg hover:bg-[#6f2f23] transition-colors"
            >
              Accept All
            </button>
            <button
              onClick={handleAcceptNecessary}
              className="w-full px-4 py-2 text-sm text-stone-300 border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
            >
              Necessary Only
            </button>
            <button
              onClick={openPreferences}
              className="w-full px-4 py-2 text-sm text-stone-300 border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
            >
              Customize
            </button>
          </div>
          
          <a 
            href="/legal/privacy" 
            className="block text-xs text-stone-400 hover:text-[#d2a79a] transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}
