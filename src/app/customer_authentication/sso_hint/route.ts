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
  
  // If Shopify provided a return URL and it's to their account page, honor it
  // But prevent infinite loops by checking for new_login parameter
  if (returnTo) {
    try {
      const returnUrl = new URL(returnTo);
      
      // Only allow Shopify account subdomain to prevent redirect loops to our own domain
      if (returnUrl.hostname === 'account.odubo.studio') {
        // If it has new_login=1, it means they just logged in - redirect to home instead
        // to prevent them from being stuck in the account portal
        if (returnUrl.searchParams.get('new_login') === '1') {
          return NextResponse.redirect('https://odubo.studio/?logged_in=1');
        }
        return NextResponse.redirect(returnUrl.toString());
      }
    } catch (e) {
      // Invalid URL, fall through to default redirect
      console.error('Invalid return_to URL:', returnTo);
    }
  }

  // Default: redirect to home page with logged_in flag
  return NextResponse.redirect('https://odubo.studio/?logged_in=1');
}

// Also handle POST in case Shopify sends data that way
export async function POST(request: NextRequest) {
  // Redirect POST requests to home with logged_in flag
  return NextResponse.redirect('https://odubo.studio/?logged_in=1');
}
