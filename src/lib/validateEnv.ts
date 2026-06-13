/**
 * Environment Validation
 * Validates critical environment variables on startup
 *
 * Usage: Import this module in layout.tsx or a server component
 * to trigger validation on first load.
 */

type EnvVar = {
  key: string;
  required: boolean;
  description: string;
  public?: boolean;
};

// Critical environment variables
const ENV_VARS: EnvVar[] = [
  // Database
  {
    key: 'DATABASE_URL',
    required: true,
    description: 'Cloudflare D1 database URL',
  },
  {
    key: 'CLOUDFLARE_D1_API_TOKEN',
    required: true,
    description: 'Cloudflare D1 API token for database access',
  },

  // Authentication
  {
    key: 'JWT_SECRET',
    required: true,
    description: 'Secret key for JWT token signing',
  },

  // Shopify
  {
    key: 'NEXT_PUBLIC_SHOPIFY_API_KEY',
    required: false,
    description: 'Shopify Storefront API key',
    public: true,
  },
  {
    key: 'SHOPIFY_STORE_URL',
    required: false,
    description: 'Shopify store URL',
  },

  // Cloudflare
  {
    key: 'CLOUDFLARE_ACCOUNT_ID',
    required: false,
    description: 'Cloudflare account ID',
  },
  {
    key: 'CLOUDFLARE_R2_ACCESS_KEY_ID',
    required: false,
    description: 'Cloudflare R2 access key',
  },

  // Email
  {
    key: 'RESEND_API_KEY',
    required: false,
    description: 'Resend API key for transactional emails',
  },

  // Sentry
  {
    key: 'NEXT_PUBLIC_SENTRY_DSN',
    required: false,
    description: 'Sentry DSN for error tracking',
    public: true,
  },

  // App
  {
    key: 'NEXT_PUBLIC_APP_URL',
    required: false,
    description: 'Public application URL',
    public: true,
  },
];

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  configured: string[];
};

let validationRan = false;
let cachedResult: ValidationResult | null = null;

/**
 * Validates environment variables
 * Only runs once per process
 */
export function validateEnvironment(): ValidationResult {
  // Only run once
  if (validationRan && cachedResult) {
    return cachedResult;
  }

  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    configured: [],
  };

  const isProduction = process.env.NODE_ENV === 'production';

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.key];
    const hasValue = value && value.trim() !== '';

    if (hasValue) {
      result.configured.push(envVar.key);
    } else if (envVar.required) {
      // Required vars missing in production = error
      if (isProduction) {
        result.errors.push(`CRITICAL: ${envVar.key} is not set (${envVar.description})`);
        result.valid = false;
      } else {
        result.warnings.push(`${envVar.key} is not set (${envVar.description})`);
      }
    } else {
      // Optional vars missing = warning
      result.warnings.push(`Optional: ${envVar.key} is not set (${envVar.description})`);
    }
  }

  // Log results
  if (result.errors.length > 0) {
    console.error('\n=== ENVIRONMENT VALIDATION ERRORS ===');
    result.errors.forEach((e) => console.error(`  - ${e}`));
    console.error('=====================================\n');
  }

  if (result.warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('\n=== ENVIRONMENT WARNINGS ===');
    result.warnings.forEach((w) => console.warn(`  - ${w}`));
    console.warn('============================\n');
  }

  // In production, throw if critical vars are missing
  if (isProduction && !result.valid) {
    throw new Error(
      `Environment validation failed:\n${result.errors.join('\n')}`
    );
  }

  validationRan = true;
  cachedResult = result;

  return result;
}

/**
 * Quick check if a specific env var is configured
 */
export function isEnvConfigured(key: string): boolean {
  const value = process.env[key];
  return !!(value && value.trim() !== '');
}

/**
 * Get environment status summary
 */
export function getEnvStatus(): {
  production: boolean;
  database: boolean;
  auth: boolean;
  email: boolean;
  shopify: boolean;
  sentry: boolean;
} {
  return {
    production: process.env.NODE_ENV === 'production',
    database: isEnvConfigured('DATABASE_URL') && isEnvConfigured('CLOUDFLARE_D1_API_TOKEN'),
    auth: isEnvConfigured('JWT_SECRET'),
    email: isEnvConfigured('RESEND_API_KEY'),
    shopify: isEnvConfigured('NEXT_PUBLIC_SHOPIFY_API_KEY'),
    sentry: isEnvConfigured('NEXT_PUBLIC_SENTRY_DSN'),
  };
}

// Auto-validate on import (server-side only)
// Logs warnings/errors for missing env vars, but never crashes the build.
// Critical API routes validate their own dependencies at runtime.
if (typeof window === 'undefined') {
  try {
    validateEnvironment();
  } catch {
    // Swallow — env vars may not be available during Vercel build
    // but will be available at runtime. Individual API routes handle
    // missing credentials with proper error responses.
  }
}
