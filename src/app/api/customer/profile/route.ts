import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCustomerData } from '@/lib/shopify-customer-api';

/**
 * Customer Profile API
 * 
 * Provides complete customer information for personalization
 * and relationship management
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const customerToken = cookieStore.get('shopify_customer_token')?.value;

    if (!customerToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch complete customer data
    const customerData = await getCustomerData(customerToken);

    // Transform to useful format
    const profile = {
      id: customerData.id,
      email: customerData.emailAddress?.emailAddress,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      phone: customerData.phoneNumber?.phoneNumber,
      
      // Default shipping address
      defaultAddress: customerData.defaultAddress ? {
        address1: customerData.defaultAddress.address1,
        address2: customerData.defaultAddress.address2,
        city: customerData.defaultAddress.city,
        province: customerData.defaultAddress.provinceCode,
        country: customerData.defaultAddress.countryCode,
        zip: customerData.defaultAddress.zip
      } : null,
      
      // Order history
      orders: {
        total: customerData.orders.edges.length,
        items: customerData.orders.edges.map((edge: any) => ({
          id: edge.node.id,
          orderNumber: edge.node.number,
          date: edge.node.processedAt,
          total: parseFloat(edge.node.totalPrice.amount),
          currency: edge.node.totalPrice.currencyCode,
          fulfillmentStatus: edge.node.fulfillments.edges[0]?.node.status || 'pending',
          items: edge.node.lineItems.edges.map((item: any) => ({
            title: item.node.title,
            quantity: item.node.quantity,
            price: parseFloat(item.node.price.amount),
            image: item.node.image?.url
          }))
        }))
      },
      
      // Customer insights for personalization
      insights: {
        isNewCustomer: customerData.orders.edges.length === 0,
        isVIP: customerData.orders.edges.length >= 5,
        totalLifetimeValue: customerData.orders.edges.reduce(
          (sum: number, edge: any) => sum + parseFloat(edge.node.totalPrice.amount), 
          0
        ),
        lastPurchaseDate: customerData.orders.edges[0]?.node.processedAt || null,
        averageOrderValue: customerData.orders.edges.length > 0
          ? customerData.orders.edges.reduce(
              (sum: number, edge: any) => sum + parseFloat(edge.node.totalPrice.amount), 
              0
            ) / customerData.orders.edges.length
          : 0
      }
    };

    return NextResponse.json(profile);

  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' }, 
      { status: 500 }
    );
  }
}