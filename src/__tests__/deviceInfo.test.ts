/**
 * Tests for the shared device/network brain used by the clips feed.
 *
 * `getDeviceInfo()` memoises into a module-level cache, so every case here
 * re-imports the module through `load()` after planting the environment.
 * Reusing one import would silently assert against the first UA tested.
 */

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  macFirefox:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  edge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.113 (iPhone14,3; iOS 17_2; en_US)',
  facebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/443.0.0.29.109]',
  tiktok:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_32.5.0 JsSdk/2.0 BytedanceWebview/d8a21c6',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36; wv',
};

type Conn = { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };

interface Env {
  ua?: string;
  platform?: string;
  maxTouchPoints?: number;
  innerWidth?: number;
  connection?: Conn | null;
  reducedMotion?: boolean;
  standalone?: boolean;
  nativeHLS?: boolean;
}

function define(target: object, prop: string, value: unknown) {
  Object.defineProperty(target, prop, { value, configurable: true, writable: true });
}

/** Plant the environment, then load a fresh copy of the module (cache included). */
function load(env: Env = {}) {
  const {
    ua = UA.macChrome,
    platform = 'MacIntel',
    maxTouchPoints = 0,
    innerWidth = 1440,
    connection = null,
    reducedMotion = false,
    standalone,
    nativeHLS = false,
  } = env;

  define(window.navigator, 'userAgent', ua);
  define(window.navigator, 'platform', platform);
  define(window.navigator, 'maxTouchPoints', maxTouchPoints);
  define(window, 'innerWidth', innerWidth);
  define(window.navigator, 'connection', connection ?? undefined);

  if (standalone === undefined) {
    // `'standalone' in navigator` is the iOS branch — remove it for everyone else.
    delete (window.navigator as unknown as Record<string, unknown>).standalone;
  } else {
    define(window.navigator, 'standalone', standalone);
  }

  (window.matchMedia as unknown as jest.Mock).mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : query.includes('display-mode') ? false : false,
    media: query,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

  jest
    .spyOn(window.HTMLMediaElement.prototype, 'canPlayType')
    .mockImplementation(() => (nativeHLS ? 'maybe' : ''));

  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/deviceInfo') as typeof import('@/lib/deviceInfo');
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getDeviceInfo — platform detection', () => {
  it('identifies a real iPhone as iOS and mobile', () => {
    const { getDeviceInfo } = load({ ua: UA.iphoneSafari, platform: 'iPhone', innerWidth: 390 });
    const info = getDeviceInfo();

    expect(info.isIOS).toBe(true);
    expect(info.isAndroid).toBe(false);
    expect(info.isMobile).toBe(true);
    expect(info.isDesktop).toBe(false);
  });

  it('identifies an iPad in desktop mode as iOS via MacIntel + touch points', () => {
    // iPadOS 13+ lies in its UA and claims to be a Mac. The only tell is
    // maxTouchPoints > 1, and getting this wrong sends iPads down the
    // desktop path (smooth scroll, bigger buffers, radius 2).
    const { getDeviceInfo } = load({
      ua: UA.ipadDesktopMode,
      platform: 'MacIntel',
      maxTouchPoints: 5,
      innerWidth: 1024,
    });
    const info = getDeviceInfo();

    expect(info.isIOS).toBe(true);
    expect(info.isMobile).toBe(true);
  });

  it('does not mistake a genuine Mac for an iPad', () => {
    const { getDeviceInfo } = load({ ua: UA.macChrome, platform: 'MacIntel', maxTouchPoints: 0 });
    const info = getDeviceInfo();

    expect(info.isIOS).toBe(false);
    expect(info.isDesktop).toBe(true);
  });

  it('identifies Android', () => {
    const { getDeviceInfo } = load({ ua: UA.androidChrome, platform: 'Linux armv8l', innerWidth: 412 });
    const info = getDeviceInfo();

    expect(info.isAndroid).toBe(true);
    expect(info.isIOS).toBe(false);
    expect(info.isMobile).toBe(true);
  });

  it('treats a narrow desktop viewport as mobile', () => {
    const { getDeviceInfo } = load({ ua: UA.macChrome, innerWidth: 500 });
    expect(getDeviceInfo().isMobile).toBe(true);
  });

  it('treats a 768px viewport as desktop (boundary is exclusive)', () => {
    const { getDeviceInfo } = load({ ua: UA.macChrome, innerWidth: 768 });
    expect(getDeviceInfo().isMobile).toBe(false);
  });
});

describe('getDeviceInfo — browser detection', () => {
  it('detects Safari and excludes Chrome', () => {
    const { getDeviceInfo } = load({ ua: UA.iphoneSafari, platform: 'iPhone' });
    const info = getDeviceInfo();

    expect(info.isSafari).toBe(true);
    expect(info.isChrome).toBe(false);
  });

  it('does not report Chrome-on-Mac as Safari', () => {
    const { getDeviceInfo } = load({ ua: UA.macChrome });
    const info = getDeviceInfo();

    expect(info.isChrome).toBe(true);
    expect(info.isSafari).toBe(false);
  });

  it('does not report Edge as Chrome', () => {
    const { getDeviceInfo } = load({ ua: UA.edge, platform: 'Win32' });
    expect(getDeviceInfo().isChrome).toBe(false);
  });

  it('detects Firefox', () => {
    const { getDeviceInfo } = load({ ua: UA.macFirefox });
    expect(getDeviceInfo().isFirefox).toBe(true);
  });
});

describe('getDeviceInfo — in-app browsers', () => {
  // These are the traffic sources the platform exists to convert. Misdetecting
  // them costs the fallback play button that in-app webviews need.
  it.each([
    ['instagram', UA.instagram],
    ['facebook', UA.facebook],
    ['tiktok', UA.tiktok],
  ] as const)('detects the %s webview', (expected, ua) => {
    const { getDeviceInfo } = load({ ua, platform: 'iPhone', innerWidth: 390 });
    const info = getDeviceInfo();

    expect(info.inAppBrowserType).toBe(expected);
    expect(info.isInAppBrowser).toBe(true);
  });

  it('falls back to "other" for a generic Android webview', () => {
    const { getDeviceInfo } = load({ ua: UA.androidWebView, innerWidth: 412 });
    const info = getDeviceInfo();

    expect(info.inAppBrowserType).toBe('other');
    expect(info.isInAppBrowser).toBe(true);
  });

  it('reports no in-app browser for plain Safari', () => {
    const { getDeviceInfo } = load({ ua: UA.iphoneSafari, platform: 'iPhone' });
    const info = getDeviceInfo();

    expect(info.isInAppBrowser).toBe(false);
    expect(info.inAppBrowserType).toBeNull();
  });
});

describe('getDeviceInfo — capabilities', () => {
  it('reports native HLS support when the video element accepts the manifest type', () => {
    const { getDeviceInfo } = load({ ua: UA.iphoneSafari, platform: 'iPhone', nativeHLS: true });
    expect(getDeviceInfo().supportsHLS).toBe(true);
  });

  it('reports no native HLS when the video element rejects it', () => {
    const { getDeviceInfo } = load({ ua: UA.macChrome, nativeHLS: false });
    expect(getDeviceInfo().supportsHLS).toBe(false);
  });

  it('honours prefers-reduced-motion', () => {
    const { getDeviceInfo } = load({ reducedMotion: true });
    expect(getDeviceInfo().prefersReducedMotion).toBe(true);
  });

  it('reports touch support from maxTouchPoints', () => {
    const { getDeviceInfo } = load({ ua: UA.androidChrome, maxTouchPoints: 5, innerWidth: 412 });
    expect(getDeviceInfo().hasTouch).toBe(true);
  });

  it('caches the result across calls', () => {
    const { getDeviceInfo } = load({ ua: UA.iphoneSafari, platform: 'iPhone', innerWidth: 390 });
    const first = getDeviceInfo();
    define(window.navigator, 'userAgent', UA.macChrome);

    // Same object identity proves the second call never re-read the UA.
    expect(getDeviceInfo()).toBe(first);
  });
});

describe('getNetworkInfo', () => {
  it('defaults to an optimistic profile when the Network Information API is absent', () => {
    // Safari ships no navigator.connection at all, so this is the desktop and
    // iOS default — it must not degrade those users to the slow path.
    const { getNetworkInfo } = load({ connection: null });
    const net = getNetworkInfo();

    expect(net.effectiveType).toBe('unknown');
    expect(net.isGoodNetwork).toBe(true);
    expect(net.isSlowNetwork).toBe(false);
  });

  it('classifies a healthy 4g connection as good', () => {
    const { getNetworkInfo } = load({ connection: { effectiveType: '4g', downlink: 10, rtt: 50 } });
    const net = getNetworkInfo();

    expect(net.isGoodNetwork).toBe(true);
    expect(net.isSlowNetwork).toBe(false);
  });

  it('classifies 4g with weak bandwidth as neither good nor slow', () => {
    const { getNetworkInfo } = load({ connection: { effectiveType: '4g', downlink: 2 } });
    const net = getNetworkInfo();

    expect(net.isGoodNetwork).toBe(false);
    expect(net.isSlowNetwork).toBe(false);
  });

  it.each(['3g', '2g', 'slow-2g'])('classifies %s as slow', (effectiveType) => {
    const { getNetworkInfo } = load({ connection: { effectiveType, downlink: 1 } });
    expect(getNetworkInfo().isSlowNetwork).toBe(true);
  });

  it('treats data-saver as slow regardless of measured bandwidth', () => {
    const { getNetworkInfo } = load({ connection: { effectiveType: '4g', downlink: 20, saveData: true } });
    const net = getNetworkInfo();

    expect(net.isSlowNetwork).toBe(true);
    expect(net.isGoodNetwork).toBe(false);
  });

  it('is not cached, so it tracks a connection that degrades mid-session', () => {
    const conn: Conn = { effectiveType: '4g', downlink: 10 };
    const { getNetworkInfo } = load({ connection: conn });
    expect(getNetworkInfo().isGoodNetwork).toBe(true);

    conn.effectiveType = '2g';
    conn.downlink = 0.4;
    expect(getNetworkInfo().isSlowNetwork).toBe(true);
  });
});

describe('getHLSBufferConfig', () => {
  it('uses the smallest buffers when only preloading', () => {
    const { getHLSBufferConfig } = load({ ua: UA.macChrome });
    expect(getHLSBufferConfig(true)).toEqual({
      maxBufferLength: 2,
      maxMaxBufferLength: 4,
      maxBufferSize: 5 * 1000 * 1000,
    });
  });

  it('keeps mobile buffers tight to protect memory', () => {
    const { getHLSBufferConfig } = load({ ua: UA.iphoneSafari, platform: 'iPhone', innerWidth: 390 });
    expect(getHLSBufferConfig()).toEqual({
      maxBufferLength: 3,
      maxMaxBufferLength: 6,
      maxBufferSize: 10 * 1000 * 1000,
    });
  });

  it('gives desktop on a good network the largest buffers', () => {
    const { getHLSBufferConfig } = load({
      ua: UA.macChrome,
      connection: { effectiveType: '4g', downlink: 10 },
    });
    expect(getHLSBufferConfig()).toEqual({
      maxBufferLength: 5,
      maxMaxBufferLength: 10,
      maxBufferSize: 15 * 1000 * 1000,
    });
  });

  it('uses the slow-network profile for desktop on a poor connection', () => {
    const { getHLSBufferConfig } = load({
      ua: UA.macChrome,
      connection: { effectiveType: '2g', downlink: 0.4 },
    });
    expect(getHLSBufferConfig()).toEqual({
      maxBufferLength: 4,
      maxMaxBufferLength: 8,
      maxBufferSize: 10 * 1000 * 1000,
    });
  });

  it('prefers the mobile profile over the slow-network profile on a slow phone', () => {
    // Documented precedence: the mobile branch is checked first, so a phone on
    // 2G buffers 3s (mobile), not 4s (slow). Memory pressure outranks bandwidth.
    const { getHLSBufferConfig } = load({
      ua: UA.androidChrome,
      innerWidth: 412,
      connection: { effectiveType: '2g', downlink: 0.4 },
    });
    expect(getHLSBufferConfig().maxBufferLength).toBe(3);
  });
});

describe('getPrefetchWindow', () => {
  it('prefetches manifests and segments on a good network', () => {
    const { getPrefetchWindow } = load({ connection: { effectiveType: '4g', downlink: 10 } });
    expect(getPrefetchWindow()).toEqual({
      manifestCount: 2,
      segmentCount: 1,
      shouldPrefetchSegments: true,
    });
  });

  it('never prefetches segments when the user asked to save data', () => {
    const { getPrefetchWindow } = load({
      connection: { effectiveType: '4g', downlink: 20, saveData: true },
    });
    expect(getPrefetchWindow()).toEqual({
      manifestCount: 1,
      segmentCount: 0,
      shouldPrefetchSegments: false,
    });
  });

  it('holds back segment prefetch on a mediocre connection', () => {
    const { getPrefetchWindow } = load({ connection: { effectiveType: '3g', downlink: 1 } });
    expect(getPrefetchWindow().shouldPrefetchSegments).toBe(false);
  });
});

describe('getRenderWindowRadius', () => {
  it('keeps one clip either side on mobile', () => {
    const { getRenderWindowRadius } = load({ ua: UA.iphoneSafari, platform: 'iPhone', innerWidth: 390 });
    expect(getRenderWindowRadius()).toBe(1);
  });

  it('keeps two either side on desktop with a good network', () => {
    const { getRenderWindowRadius } = load({
      ua: UA.macChrome,
      connection: { effectiveType: '4g', downlink: 10 },
    });
    expect(getRenderWindowRadius()).toBe(2);
  });

  it('falls back to one on desktop with a poor network', () => {
    const { getRenderWindowRadius } = load({
      ua: UA.macChrome,
      connection: { effectiveType: '2g', downlink: 0.4 },
    });
    expect(getRenderWindowRadius()).toBe(1);
  });
});

describe('getScrollBehavior', () => {
  it('uses auto on iOS to avoid janky smooth scrolling', () => {
    const { getScrollBehavior } = load({ ua: UA.iphoneSafari, platform: 'iPhone', innerWidth: 390 });
    expect(getScrollBehavior()).toBe('auto');
  });

  it('uses smooth everywhere else', () => {
    const { getScrollBehavior } = load({ ua: UA.macChrome });
    expect(getScrollBehavior()).toBe('smooth');
  });
});

describe('isPWAStandalone', () => {
  it('trusts navigator.standalone on iOS', () => {
    const { isPWAStandalone } = load({ ua: UA.iphoneSafari, platform: 'iPhone', standalone: true });
    expect(isPWAStandalone()).toBe(true);
  });

  it('returns false for iOS Safari running in a tab', () => {
    const { isPWAStandalone } = load({ ua: UA.iphoneSafari, platform: 'iPhone', standalone: false });
    expect(isPWAStandalone()).toBe(false);
  });

  it('falls back to the display-mode media query elsewhere', () => {
    const { isPWAStandalone } = load({ ua: UA.androidChrome, innerWidth: 412 });
    expect(isPWAStandalone()).toBe(false);
  });
});
