/**
 * Sentry Client Configuration
 * Captures errors from browser/client-side code
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV || 'development',

    // Only send errors in production
    enabled: process.env.NODE_ENV === 'production',

    // Sample rate for performance monitoring (0.0 to 1.0)
    tracesSampleRate: 0.1, // 10% of transactions

    // Sample rate for error reporting
    sampleRate: 1.0, // 100% of errors

    // Session replay for debugging (optional, uses more quota)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1, // 10% of error sessions

    // Integrations
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Filter out non-critical errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Ignore network errors (user offline, etc.)
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) return null;
        if (error.message.includes('NetworkError')) return null;
        if (error.message.includes('Load failed')) return null;
      }

      return event;
    },

    // Add custom tags
    initialScope: {
      tags: {
        app: 'odubo',
        side: 'client',
      },
    },
  });
}
