"use client";

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { isMonitoringEnabled } from '../config/monitoring';
import { CONSENT_KEY, notifyConsentChange } from '@/lib/consent';
import { ROOM_INK, ROOM_SAND } from '@/lib/room';

/** The page's gtag, where Google Analytics has loaded it */
type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

/** A line between rows, in the sheet's own writing colour */
const HAIRLINE = 'color-mix(in srgb, currentColor 35%, transparent)';

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

  // The sheet takes the focus while it is up, and gives it back to Customize
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  // While the strip is up, the rooms stand above it (their frames end at --consent-h), so a
  // stranger's first look still has the room's floor and its doors in sight
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    const root = document.documentElement;
    if (!showBanner || !el) return;
    const measure = () => root.style.setProperty('--consent-h', `${el.offsetHeight}px`);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => {
      watch.disconnect();
      root.style.removeProperty('--consent-h');
    };
  }, [showBanner]);

  useEffect(() => {
    if (!showPreferences) return;
    const back = opener.current;
    closer.current?.focus({ preventScroll: true });
    // Escape is the X: the same as closing without saving
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowPreferences(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      back?.focus({ preventScroll: true });
    };
  }, [showPreferences]);

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
    // Saved is answered: the strip goes too (it came back, and a tap on it overwrote the choices just saved)
    setShowBanner(false);
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
    if (typeof window !== 'undefined' && (window as GtagWindow).gtag) {
      (window as GtagWindow).gtag?.('consent', 'update', {
        analytics_storage: 'granted',
      });
    }
  };

  const disableAnalytics = () => {
    // Disable Google Analytics, etc.
    if (typeof window !== 'undefined' && (window as GtagWindow).gtag) {
      (window as GtagWindow).gtag?.('consent', 'update', {
        analytics_storage: 'denied',
      });
    }
  };

  const enableMarketing = () => {
    // Enable marketing cookies
    if (typeof window !== 'undefined' && (window as GtagWindow).gtag) {
      (window as GtagWindow).gtag?.('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
      });
    }
  };

  const disableMarketing = () => {
    // Disable marketing cookies
    if (typeof window !== 'undefined' && (window as GtagWindow).gtag) {
      (window as GtagWindow).gtag?.('consent', 'update', {
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

  // A strip of the house's ink along the bottom, a bar and not a wall: a
  // stranger scanning the flyer reaches the room first, and the choices are
  // the same Accept / Necessary only / Customize. Above the room pages
  // (z-150) and the store (its details sheet z-151); under the link tree and
  // the music player. One or two lines, so the room's floor (its doors) stays
  // in sight on a phone.
  return (
    <div className="room contents">
      <div
        ref={strip}
        inert={showPreferences}
        className={`fixed inset-x-0 bottom-0 z-[160] transition-opacity duration-300 ${showPreferences ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        style={{ background: ROOM_INK, color: ROOM_SAND, boxShadow: `inset 0 1px 0 ${ROOM_SAND}40`, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <section aria-label="Cookies" className="mx-auto flex max-w-3xl flex-col px-4 pb-2.5 pt-3.5 sm:flex-row sm:items-center sm:gap-6 sm:py-1.5">
          <p className="text-[13px] leading-snug opacity-85 sm:flex-1">
            Cookies help us see how the site is used.{' '}
            <a href="/legal?tab=privacy" className="underline decoration-[#f0d3ad]/50 underline-offset-[3px] hover:decoration-[#f0d3ad]">
              Privacy
            </a>
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-1 sm:mt-0 sm:justify-end">
            <div className="-ml-2.5 flex items-center sm:ml-0">
              <button ref={opener} type="button" onClick={openPreferences} className="min-h-[44px] px-2.5 text-[13px] opacity-75 transition-opacity hover:opacity-100">
                Customize
              </button>
              <button type="button" onClick={handleAcceptNecessary} className="min-h-[44px] px-2.5 text-[13px] opacity-75 transition-opacity hover:opacity-100">
                Necessary only
              </button>
            </div>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="min-h-[44px] rounded-full px-7 text-[14px] font-semibold tracking-wide transition-transform active:scale-[0.98] sm:ml-2"
              style={{ background: ROOM_SAND, color: ROOM_INK }}
            >
              Accept
            </button>
          </div>
        </section>
      </div>

      {/* Customize: the choices one by one, a sheet of ink rising from the floor. Closed with its X, never by dragging */}
      <div
        aria-hidden="true"
        onClick={closePreferences}
        className={`fixed inset-0 z-[161] bg-[#2a0f0a]/30 transition-opacity duration-300 ${showPreferences ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        inert={!showPreferences}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-sheet-title"
        className={`fixed inset-x-0 bottom-0 z-[162] mx-auto w-full max-w-md px-3 transition-transform duration-500 ease-[cubic-bezier(0.2,0.9,0.25,1.1)] ${showPreferences ? 'translate-y-0' : 'translate-y-[115%]'}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <div
          className="relative max-h-[calc(100dvh-env(safe-area-inset-top)-24px)] overflow-y-auto overscroll-contain px-5 pb-6 pt-5"
          style={{ background: ROOM_INK, color: ROOM_SAND, boxShadow: `inset 0 0 0 1.5px ${ROOM_SAND}40` }}
        >
          <button
            ref={closer}
            type="button"
            onClick={closePreferences}
            aria-label="Close"
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center opacity-80 hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <p id="cookie-sheet-title" className="room-display text-[13px] uppercase tracking-[0.24em]">
            Cookies
          </p>

          <div className="mt-3">
            <Choice name="Necessary" what="Keeps the site working" locked>
              <input type="checkbox" checked={preferences.necessary} disabled className="sr-only" />
              <span className="room-eyebrow">Always on</span>
            </Choice>
            <Choice name="Analytics" what="Shows us how the site is used">
              <Switch checked={preferences.analytics} onChange={(on) => handlePreferenceChange('analytics', on)} />
            </Choice>
            <Choice name="Marketing" what="Ads that fit you">
              <Switch checked={preferences.marketing} onChange={(on) => handlePreferenceChange('marketing', on)} />
            </Choice>
            <Choice name="Functional" what="Remembers your settings">
              <Switch checked={preferences.functional} onChange={(on) => handlePreferenceChange('functional', on)} />
            </Choice>
          </div>

          <button
            type="button"
            onClick={handleSavePreferences}
            className="mt-6 flex min-h-[52px] w-full items-center justify-center rounded-full text-[15px] font-semibold tracking-wide transition-transform active:scale-[0.98]"
            style={{ background: ROOM_SAND, color: ROOM_INK }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** One kind of cookie: its name, what it is for, and its switch; the whole row is the switch's label */
function Choice({ name, what, locked = false, children }: { name: string; what: string; locked?: boolean; children: ReactNode }) {
  return (
    <label className={`relative flex min-h-[60px] items-center justify-between gap-4 border-b py-2 ${locked ? '' : 'cursor-pointer'}`} style={{ borderColor: HAIRLINE }}>
      <span>
        <span className="block text-[15px]">{name}</span>
        <span className="block text-[12px] opacity-60">{what}</span>
      </span>
      {children}
    </label>
  );
}

/** A switch drawn in sand: the checkbox itself, out of sight, does the work */
function Switch({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#f0d3ad]"
        style={{ background: checked ? ROOM_SAND : 'transparent', boxShadow: checked ? 'none' : `inset 0 0 0 1.5px ${ROOM_SAND}99` }}
      >
        <span
          className={`absolute left-[4px] top-[4px] h-[18px] w-[18px] rounded-full transition-transform duration-200 ${checked ? 'translate-x-[18px]' : ''}`}
          style={{ background: checked ? ROOM_INK : `${ROOM_SAND}cc` }}
        />
      </span>
    </>
  );
}
