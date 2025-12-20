# Shopify Customer Accounts Setup Guide

## Current Issue Analysis

Based on your screenshots, here's what's happening:

1. ✅ **account.odubo.studio** is correctly configured as your Customer Accounts domain
2. ✅ **Checkout profile is published** (no longer preview mode)
3. ❌ **OAuth callback not configured** - Shopify doesn't know to redirect to odubo.com
4. ❌ **Auth flow not using Customer Account API v2** - currently just linking to Shopify login

## Fix Required

### Step 1: Configure Redirect URI in Shopify Admin

1. Go to **Shopify Admin** → **Settings** → **Customer accounts**
2. Scroll to **Customer Account API** section
3. Under **Allowed redirect URIs**, add:
   ```
   https://odubo.com/api/auth/shopify/callback
   ```
4. Click **Save**

### Step 2: Enable Customer Account API

In the same section:
1. Make sure **New customer accounts** is selected (not Classic)
2. Enable **Customer Account API**
3. Save changes

### Step 3: Verify Environment Variables

Your `.env.local` should have (already configured ✅):
```bash
SHOPIFY_STORE_URL=https://odubo.studio
SHOPIFY_CLIENT_ID_CUSTOMER_API=843046fe-e8cb-4fd1-9f46-ac5c8acd876b
NEXT_PUBLIC_SITE_URL=https://odubo.com
```

### Step 4: Update Auth Flow (code fix needed)

The current code redirects to `odubo.studio/account/login`, but it should use the Customer Account API OAuth flow.

## How It Should Work

### Correct Flow:
1. User clicks "Sign in with Shop" on **odubo.com**
2. Browser redirects to **account.odubo.studio** OAuth page
3. User authenticates with Shopify
4. Shopify redirects back to **odubo.com/api/auth/shopify/callback**
5. Callback exchanges code for token
6. User is now logged in on **odubo.com**

### Current Problem:
- User gets redirected to `odubo.studio/customer_authentication/sso_hint=...`
- Then gets 404 because Shopify doesn't know where to redirect back
- The redirect URI needs to be configured in Shopify Admin

## Post-Purchase Flow

For the cart URL you shared:
```
https://odubo.studio/cart/52829039755477:1?profile_preview_token=...&isPublished=true
```

This is now **published** (✅ good!), but you need to:

1. **Set order status page redirect** in Shopify Admin:
   - Go to Settings → Checkout → Order status page
   - Add this script in **Additional scripts**:
   ```liquid
   {% if checkout.order_id %}
     <script>
       window.location.href = 'https://odubo.com/thank-you?order_id={{ checkout.order_id }}&order_number={{ checkout.order_number }}';
     </script>
   {% endif %}
   ```

## Testing Checklist

After configuration:

- [ ] Navigate to odubo.com/shop
- [ ] Click "Sign In" button
- [ ] Should redirect to account.odubo.studio OAuth page
- [ ] Sign in with Shopify credentials
- [ ] Should redirect back to odubo.com/shop with auth=success
- [ ] Customer email should appear in header
- [ ] Add items to cart and checkout
- [ ] After payment, should redirect to odubo.com/thank-you

## Troubleshooting

### 404 on OAuth Callback
- **Cause**: Redirect URI not configured in Shopify Admin
- **Fix**: Add `https://odubo.com/api/auth/shopify/callback` to allowed URIs

### "Access Denied" Error
- **Cause**: Customer Account API not enabled
- **Fix**: Enable in Shopify Admin → Settings → Customer accounts

### Still Redirecting to odubo.studio Login
- **Cause**: Auth code using wrong method
- **Fix**: Update `handleShopifyLogin` to use Customer Account API v2 OAuth

### Checkout Not Returning to odubo.com
- **Cause**: Order status page not configured
- **Fix**: Add redirect script in Shopify Admin → Checkout settings
