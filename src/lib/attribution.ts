/**
 * Attribution and UTM tracking for funnel analytics.
 *
 * Captures traffic source on landing and persists through the session
 * to enable conversion attribution across the clips → store funnel.
 */

export interface Attribution {
  source: string;       // utm_source or inferred from referrer
  medium: string;       // utm_medium
  campaign: string;     // utm_campaign
  content: string;      // utm_content (e.g., specific ad creative)
  term: string;         // utm_term
  referrer: string;     // Raw document.referrer
  entryClipId?: number; // Deep link clip ID if present
  landingPage: string;  // Path user landed on
  timestamp: number;    // When attribution was captured
}

const SESSION_KEY = 'odubo:attribution';
const STORAGE_KEY = 'odubo:attribution';
const STORAGE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Infer traffic source from referrer URL.
 */
function inferSourceFromReferrer(referrer: string): string {
  if (!referrer) return 'direct';

  const r = referrer.toLowerCase();

  // Social platforms
  if (r.includes('instagram.com') || r.includes('ig.me')) return 'instagram';
  if (r.includes('tiktok.com') || r.includes('vm.tiktok')) return 'tiktok';
  if (r.includes('youtube.com') || r.includes('youtu.be')) return 'youtube';
  if (r.includes('linkedin.com') || r.includes('lnkd.in')) return 'linkedin';
  if (r.includes('facebook.com') || r.includes('fb.com') || r.includes('fb.me')) return 'facebook';
  if (r.includes('twitter.com') || r.includes('x.com') || r.includes('t.co')) return 'twitter';
  if (r.includes('pinterest.com') || r.includes('pin.it')) return 'pinterest';
  if (r.includes('snapchat.com') || r.includes('snapch.at')) return 'snapchat';
  if (r.includes('reddit.com')) return 'reddit';
  if (r.includes('threads.net')) return 'threads';

  // Search engines
  if (r.includes('google.')) return 'google';
  if (r.includes('bing.com')) return 'bing';
  if (r.includes('duckduckgo.com')) return 'duckduckgo';
  if (r.includes('yahoo.')) return 'yahoo';

  // Messaging apps
  if (r.includes('wa.me') || r.includes('whatsapp.com')) return 'whatsapp';
  if (r.includes('t.me') || r.includes('telegram.')) return 'telegram';

  // Email clients (common webmail)
  if (r.includes('mail.google') || r.includes('gmail.')) return 'gmail';
  if (r.includes('outlook.') || r.includes('mail.yahoo')) return 'email';

  return 'referral';
}

/**
 * Infer medium from source.
 */
function inferMediumFromSource(source: string, hasReferrer: boolean): string {
  const socialSources = ['instagram', 'tiktok', 'youtube', 'linkedin', 'facebook', 'twitter', 'pinterest', 'snapchat', 'reddit', 'threads'];
  const searchSources = ['google', 'bing', 'duckduckgo', 'yahoo'];
  const messagingSources = ['whatsapp', 'telegram'];
  const emailSources = ['gmail', 'email'];

  if (socialSources.includes(source)) return 'social';
  if (searchSources.includes(source)) return 'organic';
  if (messagingSources.includes(source)) return 'messaging';
  if (emailSources.includes(source)) return 'email';
  if (source === 'direct') return 'none';
  if (hasReferrer) return 'referral';

  return 'none';
}

/**
 * Capture attribution from current page context.
 * Should be called on initial page load.
 */
export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') {
    return {
      source: 'unknown',
      medium: 'none',
      campaign: '',
      content: '',
      term: '',
      referrer: '',
      landingPage: '/',
      timestamp: Date.now(),
    };
  }

  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || '';

  // UTM parameters take priority over inferred values
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign') || '';
  const utmContent = params.get('utm_content') || '';
  const utmTerm = params.get('utm_term') || '';

  // Facebook/Meta specific parameters
  const fbclid = params.get('fbclid');
  const gclid = params.get('gclid'); // Google Ads
  const ttclid = params.get('ttclid'); // TikTok Ads

  // Infer source if not explicitly provided
  let source = utmSource || '';
  if (!source) {
    if (fbclid) source = 'facebook_ads';
    else if (gclid) source = 'google_ads';
    else if (ttclid) source = 'tiktok_ads';
    else source = inferSourceFromReferrer(referrer);
  }

  // Infer medium if not explicitly provided
  let medium = utmMedium || '';
  if (!medium) {
    if (fbclid || gclid || ttclid) medium = 'cpc';
    else medium = inferMediumFromSource(source, !!referrer);
  }

  // Deep link clip ID
  const clipParam = params.get('clip');
  const entryClipId = clipParam ? parseInt(clipParam, 10) : undefined;

  return {
    source,
    medium,
    campaign: utmCampaign,
    content: utmContent,
    term: utmTerm,
    referrer,
    entryClipId: entryClipId && Number.isFinite(entryClipId) ? entryClipId : undefined,
    landingPage: window.location.pathname,
    timestamp: Date.now(),
  };
}

/**
 * Persist attribution to storage.
 * Session storage for current funnel, localStorage for returning visitors.
 */
export function persistAttribution(attr: Attribution): void {
  if (typeof window === 'undefined') return;

  try {
    // Always store in session for current visit
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(attr));

    // Store in localStorage only if this is a new attribution
    // (don't overwrite existing attribution from a previous visit)
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...attr,
        expiry: Date.now() + STORAGE_EXPIRY_MS,
      }));
    }
  } catch {
    // Storage may be blocked in private browsing
  }
}

/**
 * Get stored attribution, preferring session over localStorage.
 */
export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;

  try {
    // Session storage takes priority (current visit)
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session) {
      return JSON.parse(session);
    }

    // Fall back to localStorage (returning visitor)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Check expiry
      if (data.expiry && data.expiry > Date.now()) {
        return data;
      }
      // Expired, clean up
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Parse error or storage blocked
  }

  return null;
}

/**
 * Clear stored attribution (e.g., on logout or conversion).
 */
export function clearAttribution(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Get or create a session ID for anonymous tracking.
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';

  const key = 'odubo:session';
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    // Fallback if crypto or storage not available
    return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Initialize attribution on page load.
 * Call this once in the app root.
 */
export function initAttribution(): Attribution {
  // Only capture if no existing session attribution
  const existing = getAttribution();
  if (existing) {
    return existing;
  }

  const attr = captureAttribution();
  persistAttribution(attr);
  return attr;
}
