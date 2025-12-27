/**
 * Sentry Server Configuration
 * Captures errors from server-side code (API routes, SSR)
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
    tracesSampleRate: 0.1, // 10% of transactions

    // Sample rate for error reporting
    sampleRate: 1.0, // 100% of errors

    // Spotlight for development debugging
    spotlight: process.env.NODE_ENV === 'development',

    // Add custom tags
    initialScope: {
      tags: {
        app: 'odubo',
        side: 'server',
      },
    },

    // Filter out expected errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      if (error instanceof Error) {
        // Ignore auth-related "expected" errors
        if (error.message.includes('Unauthorized')) return null;
        if (error.message.includes('JWT')) return null;

        // Ignore rate limiting
        if (error.message.includes('Too many requests')) return null;
      }

      return event;
    },
  });
}
