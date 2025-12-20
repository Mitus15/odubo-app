/**
 * Test Shopify Authentication Flow
 * 
 * Run this to test the complete Shopify customer authentication process:
 * 1. User clicks "Login with Shopify" 
 * 2. Redirects to Shopify customer login
 * 3. After login, Shopify redirects back to your site
 * 4. User session is created and they can shop with customer account
 */

const testShopifyAuth = () => {
  const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  const returnUrl = `${siteUrl}/api/auth/shopify/callback?return_to=${encodeURIComponent('/shop')}`;
  
  console.log('🔗 Shopify Auth Flow Test');
  console.log('1. Shopify Store:', shopifyStore);
  console.log('2. Return URL:', returnUrl);
  console.log('3. Final Login URL:', `${shopifyStore}/account/login?return_to=${encodeURIComponent(returnUrl)}`);
  
  // To test: uncomment the line below
  // window.location.href = `${shopifyStore}/account/login?return_to=${encodeURIComponent(returnUrl)}`;
};

// Export for manual testing
if (typeof window !== 'undefined') {
  (window as any).testShopifyAuth = testShopifyAuth;
}

export default testShopifyAuth;