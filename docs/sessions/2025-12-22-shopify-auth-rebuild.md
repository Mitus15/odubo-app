# Session: Shopify Customer Auth Rebuild

**Date:** 2025-12-22

## Summary

Rebuilt Shopify customer authentication with New Customer Accounts approach:
- **Shopify** handles ALL customer auth via hosted account pages
- **Website** handles admin accounts only (unchanged)
- No custom OAuth - just redirect to Shopify

## Final Architecture (New Customer Accounts)

With Shopify's New Customer Accounts, we don't handle OAuth at all:
- "Sign In" → redirects to `https://account.odubo.studio/login`
- "My Account" → redirects to `https://account.odubo.studio`
- No tokens, no cookies, no API calls for customer auth
- Shopify handles everything on their hosted subdomain

## Architecture

```
BEFORE:
- Complex data syncing between Shopify and local DB
- Customers stored in both Shopify AND users table
- Multiple endpoints for sync, profile, analytics
- ~1500 lines of sync code

AFTER:
- Shopify OAuth → token in httpOnly cookie → fetch on-demand
- NO local storage of customer data
- Single source of truth (Shopify)
- ~400 lines of clean code
```

## Files Created

1. `/src/lib/shopify-customer.ts` - Clean Shopify customer API library
2. `/src/app/api/shopify/auth/login/route.ts` - OAuth login redirect
3. `/src/app/api/shopify/auth/callback/route.ts` - OAuth callback handler
4. `/src/app/api/shopify/auth/logout/route.ts` - Logout (clear cookie)
5. `/src/app/api/shopify/customer/route.ts` - Get profile + orders
6. `/src/contexts/ShopifyCustomerContext.tsx` - Client-side state management

## Files Modified

1. `/src/app/layout.tsx` - Added ShopifyCustomerProvider
2. `/src/app/account/page.tsx` - Rebuilt with new auth flow

## Files Archived (→ `/src/_archived/shopify-customer-v1/`)

1. `api/auth/shopify/callback/route.ts`
2. `api/auth/shopify/logout/route.ts`
3. `api/users/sync-shopify/route.ts`
4. `api/customer/profile/route.ts`
5. `api/analytics/customer/route.ts`
6. `api/shopify/cart-data/route.ts`
7. `api/shopify/sync-orders/route.ts`
8. `api/shopify/sync-customer/route.ts`
9. `lib/shopify-customer-api.ts`
10. `components/ShopifyAccountLinker.tsx`
11. `components/CartAutoFill.tsx`

## Auth Flow

1. User clicks "Sign In with Shopify" on `/account`
2. Redirects to `/api/shopify/auth/login`
3. Generates state for CSRF, stores in cookie
4. Redirects to Shopify OAuth
5. User logs in on Shopify
6. Shopify redirects to `/api/shopify/auth/callback`
7. Callback exchanges code for token
8. Token stored in `shopify_token` httpOnly cookie (30 days)
9. Redirects to `/account`
10. Account page fetches data via `/api/shopify/customer`

## Environment Variables Required

- `SHOPIFY_STORE_URL` - e.g., https://odubostudio.myshopify.com
- `SHOPIFY_CLIENT_ID_CUSTOMER_API` - Customer Account API client ID
- `NEXT_PUBLIC_SITE_URL` - e.g., https://odubo.studio

## Cookie Strategy

```
Name:     shopify_token
Value:    Shopify Customer Account API access token
HttpOnly: true
Secure:   true (production)
SameSite: Lax
Domain:   .odubo.studio (production)
MaxAge:   30 days
```

## Next Steps

- Test live OAuth flow with Shopify
- Verify cross-subdomain cookies work correctly
- Consider adding token refresh logic if needed

## Notes

- The `shopify_orders` table in D1 is no longer used for customer orders
- Old code is archived, not deleted, for reference
- Admin auth (JWT + bcrypt) remains completely unchanged
