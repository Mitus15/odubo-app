# Shopify Custom Domain Setup for Checkout

## 🚨 **Current Issue**

Your checkout is redirecting to `odubo.studio` which appears to be your Shopify store domain. You need to configure checkout to use your custom domain `odubo.com` or properly handle the `odubo.studio` domain.

---

## ✅ **Solution: Configure Shopify Checkout Domain**

### **Option 1: Use Custom Domain for Checkout (Recommended)**

This makes checkout seamless - customers stay on `odubo.com`:

**Step 1: Update Shopify Admin**
1. Go to **Settings > Domains**
2. Add custom domain: `shop.odubo.com` or `checkout.odubo.com`
3. Follow Shopify's DNS setup instructions
4. Wait for SSL certificate (15-30 minutes)

**Step 2: Configure Checkout**
1. Go to **Settings > Checkout**
2. Under **Checkout language and domains**
3. Select your custom domain as the checkout domain

**Step 3: Update Your Environment**
```bash
# Add to .env.local
SHOPIFY_CHECKOUT_DOMAIN=shop.odubo.com
```

---

### **Option 2: Accept odubo.studio Domain (Quick Fix)**

If `odubo.studio` is your actual Shopify store:

**Update Environment Variables:**
```bash
# Change from:
SHOPIFY_STORE_URL=https://odubostudio.myshopify.com

# To:
SHOPIFY_STORE_URL=https://odubo.studio
```

**In Shopify Admin:**
1. Go to **Settings > Domains**
2. Verify `odubo.studio` is your primary domain
3. Configure checkout to use this domain

---

## 🔧 **Implementation Details**

### **Your Current Setup**
- **Headless Store**: `odubo.com` (Next.js)
- **Shopify Store**: `odubo.studio` (appears to be custom domain)
- **MyShopify Domain**: `odubostudio.myshopify.com` (backend)

### **What's Happening**
1. User adds items to cart on `odubo.com`
2. Clicks checkout
3. Gets redirected to `odubo.studio/cart/...`
4. URL includes preview token (testing mode)

### **The Preview Token**
The `profile_preview_token` in your URL indicates you're in **checkout profile preview mode**. This is for testing checkout configurations before going live.

---

## 🚀 **Recommended Architecture**

### **Best Practice: Subdomain Checkout**

```
odubo.com                    → Your headless store (browse/shop)
shop.odubo.com or            → Shopify checkout (payment/order)
checkout.odubo.com

User Flow:
1. Browse: odubo.com/shop
2. Cart: odubo.com (modal)
3. Checkout: shop.odubo.com (Shopify)
4. Confirmation: odubo.com/thank-you
```

### **DNS Configuration**
```
Type   | Name     | Value
-------|----------|------------------
CNAME  | shop     | shops.myshopify.com
```

---

## 📝 **Quick Fix Steps**

### **If You Want to Keep odubo.studio:**

1. **Update .env.local:**
```bash
SHOPIFY_STORE_URL=https://odubo.studio
NEXT_PUBLIC_SHOPIFY_STORE_URL=https://odubo.studio
```

2. **Update CartModal.tsx** (already done with new API)

3. **Test checkout:**
```bash
# Visit your site
# Add item to cart
# Click checkout
# Should now properly redirect to odubo.studio
```

### **If You Want Custom Checkout Domain:**

1. **Choose subdomain**: `shop.odubo.com` or `checkout.odubo.com`

2. **Add to Shopify:**
   - Settings > Domains
   - Connect existing domain
   - Follow DNS setup

3. **Update environment:**
```bash
SHOPIFY_CHECKOUT_DOMAIN=shop.odubo.com
```

4. **Update code:**
```typescript
// In checkout API, use custom domain
const checkoutUrl = checkoutUrl.replace(
  'odubo.studio',
  process.env.SHOPIFY_CHECKOUT_DOMAIN || 'shop.odubo.com'
);
```

---

## 🎯 **Recommended Action**

**For best user experience:**

1. Set up `shop.odubo.com` as checkout subdomain
2. Update Shopify settings to use it
3. Configure DNS with Shopify's CNAME
4. Update environment variables
5. Customers stay in odubo.com ecosystem

**OR for quick fix:**

1. Change `SHOPIFY_STORE_URL` to `https://odubo.studio`
2. Accept that checkout happens on different domain
3. Ensure proper return URLs are configured

---

## 🔒 **Security Note**

The preview token in your URL suggests you're testing. Make sure to:
1. Publish your checkout profile (not preview)
2. Remove preview tokens before going live
3. Test in incognito mode to verify real customer experience