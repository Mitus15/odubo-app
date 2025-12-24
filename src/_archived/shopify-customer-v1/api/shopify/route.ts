import { NextRequest, NextResponse } from 'next/server';
import { getCustomerWithOrders } from '@/lib/shopify-customer';

/**
 * GET /api/shopify/customer
 *
 * Fetches customer profile and orders from Shopify.
 * Requires shopify_token cookie.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('shopify_token')?.value;

  if (!token) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    const { customer, orders } = await getCustomerWithOrders(token);

    return NextResponse.json({
      customer,
      orders,
    });
  } catch (err) {
    console.error('Failed to fetch customer data:', err);

    // If token is invalid/expired, return 401
    if (err instanceof Error && err.message.includes('Failed')) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch customer data' },
      { status: 500 }
    );
  }
}
