import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Customer Logout API
 *
 * Deletes the httpOnly shopify_customer cookie to sign out the customer.
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('shopify_customer');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to logout' }, { status: 500 });
  }
}
