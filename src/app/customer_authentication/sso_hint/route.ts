import { NextResponse } from 'next/server';

/**
 * Shopify Customer Authentication SSO Hint Handler
 *
 * This route exists to receive callbacks from Shopify's New Customer Accounts.
 * Since we don't track customer auth state on our site (Shopify handles it all),
 * we simply redirect back to the main site.
 */

export async function GET() {
  // Simply redirect to home - Shopify handles all customer auth
  return NextResponse.redirect('https://odubo.studio');
}

// Also handle POST in case Shopify sends data that way
export async function POST() {
  return NextResponse.redirect('https://odubo.studio');
}
