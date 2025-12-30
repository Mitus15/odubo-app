/**
 * Centralized device and network detection utilities.
 * Consolidates detection logic that was previously duplicated across:
 * - ClipCard.tsx
 * - ClipsFeed.tsx
 * - hlsPlayer.ts
 * - hlsPrefetch.ts
 */

export interface DeviceInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isInAppBrowser: boolean;
  inAppBrowserType: 'instagram' | 'facebook' | 'tiktok' | 'twitter' | 'snapchat' | 'line' | 'other' | null;
  supportsHLS: boolean;
  prefersReducedMotion: boolean;
  hasTouch: boolean;
}

export interface NetworkInfo {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  downlink: number;
  rtt: number;
  saveData: boolean;
  isGoodNetwork: boolean;
  isSlowNetwork: boolean;
}

let cachedDeviceInfo: DeviceInfo | null = null;

/**
 * Get device information. Results are cached for performance.
 * Cache is cleared on orientation change.
 */
export function getDeviceInfo(): DeviceInfo {
  if (cachedDeviceInfo) return cachedDeviceInfo;

  // SSR fallback
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isMobile: false,
      isDesktop: true,
      isSafari: false,
      isChrome: false,
      isFirefox: false,
      isInAppBrowser: false,
      inAppBrowserType: null,
      supportsHLS: false,
      prefersReducedMotion: false,
      hasTouch: false,
    };
  }

  const ua = navigator.userAgent;
  const platform = (navigator as any).platform || '';
  const maxTouchPoints = (navigator as any).maxTouchPoints || 0;

  // iOS detection (includes iPad on iOS 13+ which reports as MacIntel)
  const isIOS = /iP(ad|hone|od)/.test(ua) ||
    (platform === 'MacIntel' && maxTouchPoints > 1);

  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || window.innerWidth < 768;

  // Browser detection
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
  const isFirefox = /Firefox/.test(ua);

  // In-app browser detection
  let inAppBrowserType: DeviceInfo['inAppBrowserType'] = null;
  if (/Instagram/i.test(ua)) {
    inAppBrowserType = 'instagram';
  } else if (/FBAN|FBAV/i.test(ua)) {
    inAppBrowserType = 'facebook';
  } else if (/Musical_ly|BytedanceWebview|TikTok/i.test(ua)) {
    inAppBrowserType = 'tiktok';
  } else if (/Twitter/i.test(ua)) {
    inAppBrowserType = 'twitter';
  } else if (/Snapchat/i.test(ua)) {
    inAppBrowserType = 'snapchat';
  } else if (/Line\//i.test(ua)) {
    inAppBrowserType = 'line';
  } else if (/\bwv\b|WebView/i.test(ua)) {
    inAppBrowserType = 'other';
  }
  const isInAppBrowser = inAppBrowserType !== null;

  // Native HLS support check
  let supportsHLS = false;
  try {
    const video = document.createElement('video');
    supportsHLS = video.canPlayType('application/vnd.apple.mpegurl') !== '';
  } catch {}

  // Accessibility preferences
  let prefersReducedMotion = false;
  try {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {}

  // Touch support
  const hasTouch = 'ontouchstart' in window || maxTouchPoints > 0;

  cachedDeviceInfo = {
    isIOS,
    isAndroid,
    isMobile,
    isDesktop: !isMobile,
    isSafari,
    isChrome,
    isFirefox,
    isInAppBrowser,
    inAppBrowserType,
    supportsHLS,
    prefersReducedMotion,
    hasTouch,
  };

  return cachedDeviceInfo;
}

/**
 * Get current network information.
 * Not cached since network conditions can change.
 */
export function getNetworkInfo(): NetworkInfo {
  // SSR fallback
  if (typeof navigator === 'undefined') {
    return {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
      isGoodNetwork: true,
      isSlowNetwork: false,
    };
  }

  const conn = (navigator as any).connection ||
               (navigator as any).mozConnection ||
               (navigator as any).webkitConnection;

  const effectiveType = (conn?.effectiveType as NetworkInfo['effectiveType']) || 'unknown';
  const downlink = typeof conn?.downlink === 'number' ? conn.downlink : 10;
  const rtt = typeof conn?.rtt === 'number' ? conn.rtt : 50;
  const saveData = !!conn?.saveData;

  // Good network: 4G, decent bandwidth, user hasn't enabled data saver
  const isGoodNetwork = !saveData &&
    (effectiveType === '4g' || effectiveType === 'unknown') &&
    downlink >= 4;

  // Slow network: 2G/3G or very low bandwidth
  const isSlowNetwork = saveData ||
    effectiveType === 'slow-2g' ||
    effectiveType === '2g' ||
    effectiveType === '3g' ||
    downlink < 1.5;

  return {
    effectiveType,
    downlink,
    rtt,
    saveData,
    isGoodNetwork,
    isSlowNetwork,
  };
}

/**
 * Get scroll behavior preference based on device.
 * iOS prefers 'auto' to avoid janky smooth scroll.
 */
export function getScrollBehavior(): ScrollBehavior {
  const { isIOS } = getDeviceInfo();
  return isIOS ? 'auto' : 'smooth';
}

/**
 * Get appropriate buffer sizes for HLS based on device and network.
 */
export function getHLSBufferConfig(preloadOnly: boolean = false): {
  maxBufferLength: number;
  maxMaxBufferLength: number;
  maxBufferSize: number;
} {
  const { isMobile } = getDeviceInfo();
  const { isSlowNetwork } = getNetworkInfo();

  if (preloadOnly) {
    return {
      maxBufferLength: 2,
      maxMaxBufferLength: 4,
      maxBufferSize: 5 * 1000 * 1000, // 5MB
    };
  }

  if (isMobile) {
    return {
      maxBufferLength: 3,
      maxMaxBufferLength: 6,
      maxBufferSize: 10 * 1000 * 1000, // 10MB
    };
  }

  if (isSlowNetwork) {
    return {
      maxBufferLength: 4,
      maxMaxBufferLength: 8,
      maxBufferSize: 10 * 1000 * 1000, // 10MB
    };
  }

  // Desktop with good network
  return {
    maxBufferLength: 5,
    maxMaxBufferLength: 10,
    maxBufferSize: 15 * 1000 * 1000, // 15MB
  };
}

/**
 * Get prefetch window size based on network conditions.
 */
export function getPrefetchWindow(): {
  manifestCount: number;
  segmentCount: number;
  shouldPrefetchSegments: boolean;
} {
  const { isGoodNetwork, saveData } = getNetworkInfo();

  if (saveData) {
    return {
      manifestCount: 1,
      segmentCount: 0,
      shouldPrefetchSegments: false,
    };
  }

  if (isGoodNetwork) {
    return {
      manifestCount: 2,
      segmentCount: 1,
      shouldPrefetchSegments: true,
    };
  }

  return {
    manifestCount: 1,
    segmentCount: 0,
    shouldPrefetchSegments: false,
  };
}

/**
 * Get the render window radius for clip virtualization.
 * Determines how many clips above/below active to keep rendered.
 */
export function getRenderWindowRadius(): number {
  const { isMobile } = getDeviceInfo();
  const { isGoodNetwork } = getNetworkInfo();

  if (isMobile) return 1;
  if (isGoodNetwork) return 2;
  return 1;
}

/**
 * Check if the app is running as an installed PWA in standalone mode.
 * This means no browser UI is visible (no address bar, etc.)
 */
export function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  // iOS standalone check (Safari adds this property)
  if ('standalone' in window.navigator) {
    return (window.navigator as any).standalone === true;
  }

  // Android/Desktop PWA check via CSS media query
  return window.matchMedia('(display-mode: standalone)').matches;
}

// Clear cache on orientation change (dimensions may have changed)
if (typeof window !== 'undefined') {
  window.addEventListener('orientationchange', () => {
    cachedDeviceInfo = null;
  });

  // Also clear on significant resize
  let resizeTimeout: number;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(() => {
      cachedDeviceInfo = null;
    }, 250) as unknown as number;
  });
}
