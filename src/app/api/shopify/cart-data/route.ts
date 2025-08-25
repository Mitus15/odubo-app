import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserByEmail } from '../../../../lib/db';

const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');

    if (!email) {
      return NextResponse.json({ 
        error: 'Email required' 
      }, { status: 400 });
    }

    if (!ADMIN_TOKEN) {
      return NextResponse.json({ 
        error: 'Shopify admin token not configured' 
      }, { status: 500 });
    }

    // 1. Get user from our database
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 });
    }

    if (!user.shopify_customer_id) {
      return NextResponse.json({
        message: 'User not linked to Shopify',
        linked: false,
        cart_data: null
      });
    }

    // 2. Fetch customer data from Shopify Admin API
    const shopifyResponse = await fetch(
      `${STORE_URL}/admin/api/2024-07/customers/${user.shopify_customer_id}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': ADMIN_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!shopifyResponse.ok) {
      const errorText = await shopifyResponse.text();
      console.error('Shopify API error:', shopifyResponse.status, errorText);
      return NextResponse.json({ 
        error: 'Failed to fetch Shopify customer data' 
      }, { status: 500 });
    }

    const shopifyData = await shopifyResponse.json() as any;
    const shopifyCustomer = shopifyData.customer;

    // 3. Get customer's default addresses
    const defaultAddress = shopifyCustomer.default_address;
    const addresses = shopifyCustomer.addresses || [];

    // 4. Prepare cart auto-fill data
    const cartData = {
      customer: {
        id: shopifyCustomer.id,
        email: shopifyCustomer.email,
        first_name: shopifyCustomer.first_name,
        last_name: shopifyCustomer.last_name,
        phone: shopifyCustomer.phone,
        accepts_marketing: shopifyCustomer.accepts_marketing,
        total_spent: shopifyCustomer.total_spent,
        orders_count: shopifyCustomer.orders_count,
        note: shopifyCustomer.note,
        tags: shopifyCustomer.tags,
        created_at: shopifyCustomer.created_at,
        updated_at: shopifyCustomer.updated_at,
      },
      addresses: {
        default: defaultAddress ? {
          id: defaultAddress.id,
          first_name: defaultAddress.first_name,
          last_name: defaultAddress.last_name,
          company: defaultAddress.company,
          address1: defaultAddress.address1,
          address2: defaultAddress.address2,
          city: defaultAddress.city,
          province: defaultAddress.province,
          country: defaultAddress.country,
          zip: defaultAddress.zip,
          phone: defaultAddress.phone,
          province_code: defaultAddress.province_code,
          country_code: defaultAddress.country_code,
          country_name: defaultAddress.country_name,
          default: defaultAddress.default,
        } : null,
        all: addresses.map((addr: any) => ({
          id: addr.id,
          first_name: addr.first_name,
          last_name: addr.last_name,
          company: addr.company,
          address1: addr.address1,
          address2: addr.address2,
          city: addr.city,
          province: addr.province,
          country: addr.country,
          zip: addr.zip,
          phone: addr.phone,
          province_code: addr.province_code,
          country_code: addr.country_code,
          country_name: addr.country_name,
          default: addr.default,
        }))
      },
      preferences: {
        currency: shopifyCustomer.currency || 'USD',
        locale: shopifyCustomer.locale || 'en',
        accepts_marketing: shopifyCustomer.accepts_marketing || false,
        marketing_opt_in_level: shopifyCustomer.marketing_opt_in_level,
        sms_marketing_consent: shopifyCustomer.sms_marketing_consent,
        email_marketing_consent: shopifyCustomer.email_marketing_consent,
      }
    };

    return NextResponse.json({
      message: 'Cart auto-fill data retrieved successfully',
      linked: true,
      cart_data: cartData
    });

  } catch (error: any) {
    console.error('Cart data error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch cart data' 
    }, { status: 500 });
  }
}
