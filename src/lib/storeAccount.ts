/**
 * Where a customer manages their own orders.
 *
 * Shopify runs this page, not us. The store is on new customer accounts, which
 * live on shopify.com and are reached through the store's primary domain: that
 * URL 302s to the real one carrying the buyer token, so it is the only link
 * worth publishing. There is no separate register page either — signing in with
 * an emailed code is what creates the account, which is why /signup comes here.
 *
 * This was hardcoded as `https://account.odubo.studio` in eight places. That
 * subdomain has no DNS records at all, so every account button on the store was
 * a dead end. One definition now, because the domain has already moved once.
 */
export const STORE_ACCOUNT_URL =
  process.env.NEXT_PUBLIC_STORE_ACCOUNT_URL || "https://shop.odubostudio.com/account";
