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
      secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
      sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax',
      domain: process.env.COOKIE_DOMAIN || '.odubo.studio', // ⭐ CRITICAL: Share cookie across all subdomains
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    });
    console.log('🍪 Set shopify_customer cookie for:', email.slice(0, 3) + '...', `(domain: ${process.env.COOKIE_DOMAIN || '.odubo.studio'})`);
  }

  // Helper functions for redirect security
  const getAllowedDomains = (): string[] => {
    const envDomains = process.env.ALLOWED_REDIRECT_DOMAINS ||
      'odubo.studio,account.odubo.studio,checkout.odubo.studio';
    return envDomains.split(',').map(d => d.trim());
  };

  const isAllowedRedirect = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return getAllowedDomains().some(domain => parsedUrl.hostname === domain);
    } catch {
      return false;
    }
  };

  // Check if there's a return_to URL from Shopify
  const returnTo = searchParams.get('return_to');
  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'https://odubo.studio';
  const accountDomain = process.env.NEXT_PUBLIC_ACCOUNT_DOMAIN?.replace('https://', '') ||
    'account.odubo.studio';

  // If Shopify provided a return URL, validate and honor it
  if (returnTo && isAllowedRedirect(returnTo)) {
    try {
      const returnUrl = new URL(returnTo);

      // Prevent infinite loop to account portal
      if (returnUrl.hostname === accountDomain &&
          returnUrl.searchParams.get('new_login') === '1') {
        console.log('🔄 Preventing infinite loop - redirecting to main domain instead');
        return NextResponse.redirect(mainDomain);
      }

      console.log('✅ Redirecting to allowed return_to:', returnUrl.toString());
      return NextResponse.redirect(returnUrl.toString());
    } catch (e) {
      // Invalid URL, fall through to default redirect
      console.error('Invalid return_to URL:', returnTo);
    }
  }

  // Default: redirect to home page (cookie handles auth state now)
  console.log('🏠 Redirecting to main domain');
  return NextResponse.redirect(mainDomain);
}

// Also handle POST in case Shopify sends data that way
export async function POST() {
  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'https://odubo.studio';
  // Redirect POST requests to home
  return NextResponse.redirect(mainDomain);
}
