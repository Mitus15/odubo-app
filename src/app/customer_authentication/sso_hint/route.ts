import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Shopify Customer Authentication SSO Hint Handler
 *
 * This route handles the SSO callback from Shopify's New Customer Accounts.
 * When a customer signs in via Shopify, they get redirected here with SSO tokens.
 *
 * We now persist the login state via an httpOnly cookie for 30 days.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Extract customer email from SSO callback
  const email = searchParams.get('email');

  // Log the SSO parameters for debugging
  console.log('🔐 Shopify SSO Hint received:', {
    amr: searchParams.get('amr'),
    country: searchParams.get('country'),
    return_to: searchParams.get('return_to'),
    email: email ? `${email.slice(0, 3)}...` : null, // Log partial for privacy
    has_shop_id_token: !!searchParams.get('shop_id_token'),
  });

  // Set httpOnly cookie to persist login state
  if (email) {
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'shopify_customer',
      value: JSON.stringify({
        email,
        loggedIn: true,
        timestamp: Date.now()
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    });
    console.log('🍪 Set shopify_customer cookie for:', email.slice(0, 3) + '...');
  }

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
          // Redirect without URL param - cookie handles auth now
          return NextResponse.redirect('https://odubo.studio/');
        }
        return NextResponse.redirect(returnUrl.toString());
      }
    } catch (e) {
      // Invalid URL, fall through to default redirect
      console.error('Invalid return_to URL:', returnTo);
    }
  }

  // Default: redirect to home page (cookie handles auth state now)
  return NextResponse.redirect('https://odubo.studio/');
}

// Also handle POST in case Shopify sends data that way
export async function POST() {
  // Redirect POST requests to home
  return NextResponse.redirect('https://odubo.studio/');
}
