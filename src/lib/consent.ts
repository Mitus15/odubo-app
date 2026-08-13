'use client';

import { useEffect, useState } from 'react';
import { isMonitoringEnabled } from '@/config/monitoring';

/**
 * Cookie-consent state, shared.
 *
 * GDPRConsent owns the banner and writes the decision to localStorage, but it
 * is mounted in the root layout — a sibling of the page, not an ancestor — so
 * there is no prop path between them. Rather than lift it into a provider (and
 * re-render the whole tree on a decision that is made once), the banner
 * announces itself on a window event and anything that cares subscribes.
 *
 * "Consent" here means the visitor has ANSWERED, not that they accepted
 * everything. Choosing necessary-only is a decision, and a UI waiting on it
 * should proceed.
 */

export const CONSENT_KEY = 'gdpr-consent';
export const CONSENT_EVENT = 'odubo:consent-change';

/**
 * Has the visitor answered the cookie banner?
 *
 * Returns true when the banner is disabled outright — otherwise anything gated
 * on consent would wait forever for a prompt that never appears. Nothing should
 * be made permanently unreachable by a monitoring flag.
 */
export function hasCookieConsent(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isMonitoringEnabled('gdpr')) return true;
  try {
    return Boolean(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    // Private mode / storage blocked: we can't record a decision, so we must
    // not hold anything hostage to one.
    return true;
  }
}

/** Called by the banner after writing a decision. */
export function notifyConsentChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/**
 * Subscribe to consent. Starts false on the server and on the first client
 * render so markup matches, then settles on mount — callers should treat it as
 * "not yet" rather than "declined".
 */
export function useCookieConsent(): boolean {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const read = () => setConsented(hasCookieConsent());
    read();
    window.addEventListener(CONSENT_EVENT, read);
    // `storage` fires for other tabs, so a decision made in one applies here.
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(CONSENT_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, []);

  return consented;
}
