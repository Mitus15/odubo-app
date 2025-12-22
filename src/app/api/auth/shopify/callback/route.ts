import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForToken, getCustomerData } from '@/lib/shopify-customer-api';

/**
 * Shopify Customer Account API v2 Callback Handler
 * 
 * Handles OAuth callback from Shopify Customer Account API
 * Creates secure session and syncs customer data
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  
  // Handle errors from Shopify
  if (error) {
    console.error('Shopify auth error:', error);
    const errorUrl = new URL('/shop', request.url);
    errorUrl.searchParams.set('auth_error', error);
    return NextResponse.redirect(errorUrl);
  }

  // Verify we have authorization code
  if (!code) {
    const errorUrl = new URL('/shop', request.url);
    errorUrl.searchParams.set('auth_error', 'missing_code');
    return NextResponse.redirect(errorUrl);
  }

  try {
    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code);
    
    // Fetch customer data
    const customerData = await getCustomerData(tokenData.accessToken);
    
    // Store in secure httpOnly cookies
    const cookieStore = await cookies();
    
    // Cookie domain for cross-subdomain auth (account.odubo.studio → odubo.studio)
    const cookieDomain = process.env.NODE_ENV === 'production' ? '.odubo.studio' : undefined;
    
    cookieStore.set('shopify_customer_token', tokenData.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
      ...(cookieDomain && { domain: cookieDomain })
    });

    cookieStore.set('shopify_customer_id', customerData.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      ...(cookieDomain && { domain: cookieDomain })
    });

    if (customerData.emailAddress?.emailAddress) {
      cookieStore.set('shopify_customer_email', customerData.emailAddress.emailAddress, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        ...(cookieDomain && { domain: cookieDomain })
      });
    }

    // Sync customer data to your database for analytics
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users/sync-shopify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customerData.id,
          email: customerData.emailAddress?.emailAddress,
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          customerAccessToken: tokenData.accessToken,
          phone: customerData.phoneNumber?.phoneNumber,
          address: customerData.defaultAddress
        })
      });
    } catch (syncError) {
      console.error('Failed to sync customer:', syncError);
      // Don't fail auth if sync fails
    }

    // Redirect to shop with success
    const successUrl = new URL('/shop', request.url);
    successUrl.searchParams.set('auth', 'success');
    
    return NextResponse.redirect(successUrl);

  } catch (error) {
    console.error('Shopify callback error:', error);
    
    const errorUrl = new URL('/shop', request.url);
    errorUrl.searchParams.set('auth_error', 'authentication_failed');
    
    return NextResponse.redirect(errorUrl);
  }
}