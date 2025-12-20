import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Logout from Shopify customer session
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    
    // Clear all Shopify session cookies
    cookieStore.delete('shopify_customer_token');
    cookieStore.delete('shopify_customer_id');
    cookieStore.delete('shopify_customer_email');
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}