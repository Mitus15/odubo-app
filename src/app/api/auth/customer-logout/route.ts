import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Customer Logout API
 *
 * Deletes the httpOnly shopify_customer cookie to sign out the customer.
 * Must delete with same domain it was set with for proper cleanup.
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const cookieDomain = process.env.COOKIE_DOMAIN || '.odubo.studio';

    // Delete cookie with same domain it was set with
    cookieStore.delete({
      name: 'shopify_customer',
      domain: cookieDomain,
      path: '/'
    });

    console.log('🍪 Deleted shopify_customer cookie', `(domain: ${cookieDomain})`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: 'Failed to logout' }, { status: 500 });
  }
}
