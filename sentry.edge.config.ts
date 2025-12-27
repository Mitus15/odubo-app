/**
 * Sentry Edge Configuration
 * Captures errors from edge runtime (middleware, edge API routes)
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV || 'development',

    // Only send errors in production
    enabled: process.env.NODE_ENV === 'production',

    // Sample rate for performance monitoring
    tracesSampleRate: 0.1,

    // Add custom tags
    initialScope: {
      tags: {
        app: 'odubo',
        side: 'edge',
      },
    },
  });
}
