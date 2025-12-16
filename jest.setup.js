require('@testing-library/jest-dom');

// Minimal polyfills for Web APIs used by Next App Router and components
(() => {
  const fetchPkg = (() => {
    try { return require('node-fetch'); } catch { return null; }
  })();

  class TestRequest {
    constructor(input, init = {}) {
      this.url = typeof input === 'string' ? input : String(input?.url || '');
      this.method = init.method || 'GET';
      this.headers = init.headers || {};
      this._body = init.body;
    }
    async json() {
      if (this._body === undefined) return undefined;
      if (typeof this._body === 'string') return JSON.parse(this._body);
      return this._body;
    }
  }

  const BaseResponse = fetchPkg?.Response || class {};
  class TestResponse extends BaseResponse {
    static json(body, init = {}) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      const Res = fetchPkg?.Response || Response;
      return new Res(payload, { status: init.status || 200, headers: { 'content-type': 'application/json', ...(init.headers || {}) } });
    }
  }

  if (typeof global.Request === 'undefined') global.Request = TestRequest;
  if (typeof global.Response === 'undefined') global.Response = TestResponse;
  if (typeof global.Headers === 'undefined' && fetchPkg?.Headers) global.Headers = fetchPkg.Headers;
  if (typeof window !== 'undefined' && typeof window.Request === 'undefined') window.Request = global.Request;
  if (typeof window !== 'undefined' && typeof window.Response === 'undefined') window.Response = global.Response;
})();

if (typeof global.performance === 'undefined') {
  global.performance = {};
}

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    };
  },
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Force monitoring features enabled in tests
jest.mock('@/config/monitoring', () => ({
  monitoringConfig: {
    performance: { enabled: true },
    security: { enabled: true },
    gdpr: { enabled: true },
    accessibility: { enabled: true },
    global: { developmentOnly: false, positionOffset: { 'bottom-left': {}, 'bottom-right': {}, 'top-left': {}, 'top-right': {} } },
  },
  isMonitoringEnabled: () => true,
  getComponentPosition: () => ({}),
}));

// TextEncoder/Decoder polyfill for jose
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock Performance API
// Ensure performance has common methods
const perf = global.performance || {};
const entriesFn = jest.fn(() => [{ responseStart: 0, requestStart: 0 }]);
perf.getEntriesByType = entriesFn;
perf.mark = perf.mark || jest.fn();
perf.measure = perf.measure || jest.fn();
perf.now = perf.now || jest.fn(() => Date.now());
global.performance = perf;
if (typeof window !== 'undefined') {
  window.performance = perf;
}
if (typeof global.PerformanceObserver === 'undefined') {
  global.PerformanceObserver = class {
    observe() {}
    disconnect() {}
  };
  if (typeof window !== 'undefined') window.PerformanceObserver = global.PerformanceObserver;
}

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  // Uncomment to ignore a specific log level
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Setup global test utilities
global.testUtils = {
  // Helper to wait for async operations
  waitFor: (callback, timeout = 1000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const check = () => {
        try {
          callback();
          resolve(undefined);
        } catch (error) {
          if (Date.now() - startTime > timeout) {
            reject(error);
          } else {
            setTimeout(check, 10);
          }
        }
      };
      
      check();
    });
  },
  
  // Helper to mock API responses
  mockApiResponse: (data, status = 200) => {
    return Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    });
  },
};
