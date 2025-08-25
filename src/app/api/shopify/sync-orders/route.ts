import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, queryDatabase } from '../../../../lib/db';

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

    // 2. Fetch orders from Shopify Admin API
    const shopifyResponse = await fetch(
      `${STORE_URL}/admin/api/2024-07/customers/${shopifyCustomerId}/orders.json?status=any&limit=50`,
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
        error: 'Failed to fetch Shopify orders' 
      }, { status: 500 });
    }

    const shopifyData = await shopifyResponse.json() as { orders: any[] };
    const orders = shopifyData.orders || [];

    // 3. Sync orders to our database
    const syncedOrders = [];
    for (const order of orders) {
      try {
        // Check if order already exists
        const existingOrder = await queryDatabase(
          'SELECT id FROM shopify_orders WHERE shopify_order_id = ?',
          [order.id.toString()]
        );

        if (existingOrder.length > 0) {
          // Update existing order
          await queryDatabase(
            `UPDATE shopify_orders SET 
              order_status = ?, 
              payment_status = ?, 
              fulfillment_status = ?,
              total_amount = ?,
              shopify_updated_at = ?,
              synced_at = CURRENT_TIMESTAMP
              WHERE shopify_order_id = ?`,
            [
              order.financial_status || 'pending',
              order.financial_status || 'pending',
              order.fulfillment_status || 'unfulfilled',
              order.total_price || 0,
              order.updated_at,
              order.id.toString()
            ]
          );
        } else {
          // Insert new order
          await queryDatabase(
            `INSERT INTO shopify_orders (
              user_id, shopify_order_id, order_number, order_status, 
              total_amount, currency, payment_status, fulfillment_status,
              shipping_address, billing_address, discount_amount, tax_amount,
              shopify_created_at, shopify_updated_at, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              user.id,
              order.id.toString(),
              order.order_number,
              order.financial_status || 'pending',
              order.total_price || 0,
              order.currency || 'USD',
              order.financial_status || 'pending',
              order.fulfillment_status || 'unfulfilled',
              JSON.stringify(order.shipping_address || {}),
              JSON.stringify(order.billing_address || {}),
              order.total_discounts || 0,
              order.total_tax || 0,
              order.created_at,
              order.updated_at
            ]
          );
        }

        syncedOrders.push({
          id: order.id,
          order_number: order.order_number,
          status: order.financial_status,
          total: order.total_price,
          created_at: order.created_at
        });

      } catch (orderError) {
        console.error(`Failed to sync order ${order.id}:`, orderError);
      }
    }

    // 4. Update user's total spent
    const totalSpent = orders.reduce((sum: number, order: any) => {
      return sum + (parseFloat(order.total_price) || 0);
    }, 0);

    await queryDatabase(
      'UPDATE users SET total_spent = ? WHERE id = ?',
      [totalSpent, user.id]
    );

    return NextResponse.json({
      message: `Synced ${syncedOrders.length} orders successfully`,
      orders_synced: syncedOrders.length,
      total_spent: totalSpent,
      orders: syncedOrders
    });

  } catch (error: any) {
    console.error('Shopify orders sync error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync orders' 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');

    if (!email) {
      return NextResponse.json({ 
        error: 'Email required' 
      }, { status: 400 });
    }

    // Get user's orders from our database
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 });
    }

    const orders = await queryDatabase(
      `SELECT * FROM shopify_orders WHERE user_id = ? ORDER BY shopify_created_at DESC LIMIT 20`,
      [user.id]
    );

    return NextResponse.json({
      orders,
      total_count: orders.length,
      user: {
        id: user.id,
        email: user.email,
        total_spent: user.total_spent,
        shopify_customer_id: user.shopify_customer_id
      }
    });

  } catch (error: any) {
    console.error('Get orders error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch orders' 
    }, { status: 500 });
  }
}
