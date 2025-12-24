import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Customer Status API
 *
 * Reads the httpOnly shopify_customer cookie to check login state.
 * Returns { loggedIn: true, email: string } or { loggedIn: false }
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const customerCookie = cookieStore.get('shopify_customer');

    if (!customerCookie?.value) {
      return NextResponse.json({ loggedIn: false });
    }

    const data = JSON.parse(customerCookie.value);
    return NextResponse.json({
      loggedIn: true,
      email: data.email
    });
  } catch {
    return NextResponse.json({ loggedIn: false });
  }
}
