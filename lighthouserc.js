module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000',
        'http://localhost:3000/account',
        'http://localhost:3000/media',
        'http://localhost:3000/music',
        'http://localhost:3000/store',
      ],
      numberOfRuns: 3,
      startServerCommand: 'npm run dev',
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 60000,
    },
    assert: {
      assertions: {
        // Core Web Vitals thresholds
        'categories:performance': ['error', { minScore: 0.7 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.8 }],
        'categories:seo': ['error', { minScore: 0.8 }],
        
        // Specific Core Web Vitals
        'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
        'first-input-delay': ['error', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.25 }],
        'first-contentful-paint': ['error', { maxNumericValue: 3000 }],
        'time-to-first-byte': ['error', { maxNumericValue: 1800 }],
        
        // Performance metrics
        'total-blocking-time': ['error', { maxNumericValue: 600 }],
        'speed-index': ['error', { maxNumericValue: 4000 }],
        
        // Accessibility checks
        'color-contrast': 'warn',
        'image-alt': 'error',
        'label': 'error',
        'link-name': 'error',
        'button-name': 'error',
        
        // Best practices
        'uses-https': 'error',
        'no-vulnerable-libraries': 'warn',
        'external-anchors-use-rel-noopener': 'warn',
        
        // SEO checks
        'document-title': 'error',
        'meta-description': 'error',
        'link-text': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
