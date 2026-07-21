/**
 * Money + locale helpers for the store.
 *
 * Prices come from Shopify already converted to the visitor's currency
 * (via Shopify Markets @inContext). These helpers render them unambiguously
 * — always showing the ISO currency code so "$" is never mistaken between
 * USD / CAD / AUD, etc.
 */

/** Default country/currency when geo is unknown (store's home market). */
export const DEFAULT_COUNTRY = 'CA';

/**
 * Format a money amount with an explicit currency code, e.g. "$35.00 CAD",
 * "$26.00 USD", "€24.00 EUR". `amount` may be a number or numeric string.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currencyCode: string | null | undefined
): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount ?? 0;
  const code = (currencyCode || 'CAD').toUpperCase();
  if (!isFinite(value as number)) return `— ${code}`;

  let base: string;
  try {
    base = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).format(value as number);
  } catch {
    // Unknown currency code → plain number
    base = (value as number).toFixed(2);
  }
  // Append the ISO code so the currency is always explicit.
  return `${base} ${code}`;
}

/**
 * Normalize a country string to a Shopify CountryCode (ISO 3166-1 alpha-2,
 * uppercase). Falls back to the home market when missing/invalid.
 */
export function normalizeCountry(country: string | null | undefined): string {
  const c = (country || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : DEFAULT_COUNTRY;
}

/** Cookie name used to carry the geo-detected country to the client. */
export const COUNTRY_COOKIE = 'odubo_country';

/** Read the country cookie in the browser (client components). */
export function getCountryFromCookie(): string {
  if (typeof document === 'undefined') return DEFAULT_COUNTRY;
  const m = document.cookie.match(new RegExp(`(?:^|; )${COUNTRY_COOKIE}=([^;]+)`));
  return normalizeCountry(m ? decodeURIComponent(m[1]) : undefined);
}
