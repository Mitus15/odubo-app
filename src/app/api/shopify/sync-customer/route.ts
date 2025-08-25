import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import { getUserByEmail, updateUser } from '../../../../lib/db';

const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';

export async function POST(req: NextRequest) {
  try {
    const { email, shopifyCustomerId } = await req.json() as { email: string; shopifyCustomerId: string };

    if (!email || !shopifyCustomerId) {
      return NextResponse.json({ 
        error: 'Email and Shopify customer ID required' 
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
        error: 'User not found in app database' 
      }, { status: 404 });
    }

    // 2. Fetch customer data from Shopify Admin API
    const shopifyResponse = await fetch(
      `${STORE_URL}/admin/api/2024-07/customers/${shopifyCustomerId}.json`,
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

    const shopifyData = await shopifyResponse.json() as { customer: any };
    const shopifyCustomer = shopifyData.customer;

    // 3. Update our user with Shopify data
    const updateData: any = {
      shopify_customer_id: shopifyCustomerId,
    };

    // Sync basic customer info if different
    if (shopifyCustomer.first_name && shopifyCustomer.first_name !== user.first_name) {
      updateData.first_name = shopifyCustomer.first_name;
    }
    if (shopifyCustomer.last_name && shopifyCustomer.last_name !== user.last_name) {
      updateData.last_name = shopifyCustomer.last_name;
    }

    await updateUser(user.id, updateData);

    // 4. Return success with customer data
    return NextResponse.json({
      message: 'Customer account linked successfully',
      user: {
        id: user.id,
        email: user.email,
        shopify_customer_id: shopifyCustomerId,
        first_name: updateData.first_name || user.first_name,
        last_name: updateData.last_name || user.last_name,
      },
      shopify_customer: {
        id: shopifyCustomer.id,
        first_name: shopifyCustomer.first_name,
        last_name: shopifyCustomer.last_name,
        total_spent: shopifyCustomer.total_spent,
        orders_count: shopifyCustomer.orders_count,
        created_at: shopifyCustomer.created_at,
      }
    });

  } catch (error: any) {
    console.error('Shopify customer sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync customer data' 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    const shopifyCustomerId = url.searchParams.get('shopifyCustomerId');

    if (!email || !shopifyCustomerId) {
      return NextResponse.json({ 
        error: 'Email and Shopify customer ID required' 
      }, { status: 400 });
    }

    // Check if user exists and is linked
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 });
    }

    if (user.shopify_customer_id !== shopifyCustomerId) {
      return NextResponse.json({ 
        error: 'Customer not linked' 
      }, { status: 400 });
    }

    return NextResponse.json({
      linked: true,
      user: {
        id: user.id,
        email: user.email,
        shopify_customer_id: user.shopify_customer_id,
        first_name: user.first_name,
        last_name: user.last_name,
      }
    });

  } catch (error: any) {
    console.error('Check customer link error:', error);
    return NextResponse.json({ 
      error: 'Failed to check customer link' 
    }, { status: 500 });
  }
}
