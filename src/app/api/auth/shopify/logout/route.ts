import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Logout from Shopify customer session
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    
    // Cookie domain must match what was set during login
    const cookieDomain = process.env.NODE_ENV === 'production' ? '.odubo.studio' : undefined;
    const cookieOptions = {
      path: '/',
      ...(cookieDomain && { domain: cookieDomain })
    };
    
    // Clear all Shopify session cookies with matching domain
    cookieStore.delete({ name: 'shopify_customer_token', ...cookieOptions });
    cookieStore.delete({ name: 'shopify_customer_id', ...cookieOptions });
    cookieStore.delete({ name: 'shopify_customer_email', ...cookieOptions });
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}