# 🎯 Quick Action Items - Shopify Customer Accounts

## Immediate Actions Required in Shopify Admin

### 1. Configure OAuth Redirect URI (CRITICAL)
**Location**: Shopify Admin → Settings → Customer accounts

1. Scroll to **"Customer Account API"** section
2. Click **"Add redirect URI"** or **"Manage"**
3. Add this exact URL:
   ```
   https://odubo.com/api/auth/shopify/callback
   ```
4. Click **Save**

**Why**: Without this, the OAuth callback will continue to 404

---

### 2. Enable Customer Account API
**Location**: Same section as above

1. Make sure **"New customer accounts"** is selected (not Classic)
2. Enable toggle for **"Customer Account API"**
3. Save changes

**Why**: Required for OAuth authentication to work

---

### 3. Configure Post-Purchase Redirect
**Location**: Shopify Admin → Settings → Checkout

1. Scroll to **"Order status page"** section
2. Find **"Additional scripts"** text area
3. Paste this code:
   ```liquid
   {% if checkout.order_id %}
     <script>
       window.location.href = 'https://odubo.com/thank-you?order_id={{ checkout.order_id }}&order_number={{ checkout.order_number }}';
     </script>
   {% endif %}
   ```
4. Click **Save**

**Why**: Returns customers to odubo.com after purchase

---

## What I Just Fixed in Code

✅ **AuthModal.tsx** - Now uses proper Customer Account API v2 OAuth flow
✅ **login/page.tsx** - Updated to use OAuth instead of simple redirect
✅ **thank-you/page.tsx** - Created beautiful post-purchase page
✅ **Documentation** - Created setup guides

---

## Test the Flow

After completing the 3 actions above:

1. **Test Authentication**:
   - Go to https://odubo.com/shop
   - Click "Sign In" button
   - Should redirect to account.odubo.studio
   - Sign in with Shopify credentials
   - Should return to https://odubo.com/shop?auth=success
   - Your email should appear in the header

2. **Test Checkout**:
   - Add items to cart on odubo.com
   - Click "Checkout"
   - Complete purchase on odubo.studio
   - Should redirect to https://odubo.com/thank-you after payment

---

## Current Status

| Item | Status | Notes |
|------|--------|-------|
| account.odubo.studio domain | ✅ Live | Managed by Cloudflare |
| Checkout published | ✅ Done | No longer preview mode |
| OAuth code implementation | ✅ Fixed | AuthModal + login page |
| Callback route | ✅ Exists | /api/auth/shopify/callback |
| Thank you page | ✅ Created | /thank-you |
| Redirect URI in Shopify | ⏳ TODO | **You need to add this** |
| Customer Account API enabled | ⏳ TODO | **You need to enable this** |
| Post-purchase redirect | ⏳ TODO | **You need to configure this** |

---

## Why You're Seeing the 404

The URL in your screenshot:
```
https://odubo.studio/customer_authentication/sso_hint=...
```

Shows Shopify trying to complete OAuth, but it doesn't know where to redirect back because:
- The redirect URI isn't configured in Shopify Admin
- Shopify defaults to trying an internal redirect
- Results in 404 because that page doesn't exist

**Solution**: Add the redirect URI (Action #1 above)

---

## Need Help?

If you encounter any issues after completing these steps:

1. Check browser console for errors
2. Verify environment variables match:
   - `SHOPIFY_STORE_URL=https://odubo.studio`
   - `SHOPIFY_CLIENT_ID_CUSTOMER_API=843046fe-e8cb-4fd1-9f46-ac5c8acd876b`
   - `NEXT_PUBLIC_SITE_URL=https://odubo.com`

3. Test in incognito/private browsing mode
4. Clear cookies and try again
