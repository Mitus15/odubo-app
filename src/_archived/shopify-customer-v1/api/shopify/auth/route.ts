import { NextResponse } from 'next/server';

const COOKIE_DOMAIN = process.env.NODE_ENV === 'production' ? '.odubo.studio' : undefined;

/**
 * POST /api/shopify/auth/logout
 *
 * Clears the Shopify auth cookie.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear the token cookie
  response.cookies.set('shopify_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
    domain: COOKIE_DOMAIN,
  });

  return response;
}
