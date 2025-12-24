import { NextRequest, NextResponse } from 'next/server';

/**
 * Shopify Customer Authentication SSO Hint Handler
 * 
 * This route handles the SSO callback from Shopify's New Customer Accounts.
 * When a customer signs in via Shopify, they get redirected here with SSO tokens.
 * 
 * For now, we simply redirect them to a useful destination since we're not
 * implementing full OAuth token exchange.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Log the SSO parameters for debugging
  console.log('🔐 Shopify SSO Hint received:', {
    amr: searchParams.get('amr'),
    country: searchParams.get('country'),
    return_to: searchParams.get('return_to'),
    has_email: !!searchParams.get('email'),
    has_shop_id_token: !!searchParams.get('shop_id_token'),
  });

  // Check if there's a return_to URL from Shopify
  const returnTo = searchParams.get('return_to');
  
  // If Shopify provided a return URL and it's safe (on Shopify domain), use it
  if (returnTo) {
    try {
      const returnUrl = new URL(returnTo);
      // Only allow redirects to Shopify's account subdomain or our own domain
      const allowedHosts = [
        'account.odubo.studio',
        'odubo.studio',
        'odubo.com',
        'www.odubo.com',
      ];
      
      if (allowedHosts.includes(returnUrl.hostname)) {
        return NextResponse.redirect(returnUrl.toString());
      }
    } catch (e) {
      // Invalid URL, fall through to default redirect
      console.error('Invalid return_to URL:', returnTo);
    }
  }

  // Default: redirect to Shopify's account page where they can see orders, etc.
  // This is the safest option - they're already logged in with Shopify
  return NextResponse.redirect('https://account.odubo.studio/');
}

// Also handle POST in case Shopify sends data that way
export async function POST(request: NextRequest) {
  // Redirect POST requests to GET handler behavior
  return NextResponse.redirect('https://account.odubo.studio/');
}
