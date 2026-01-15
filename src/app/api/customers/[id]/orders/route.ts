import { queryDatabase } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface OrderItem {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  total_price: number;
  image_url: string | null;
}

interface Order {
  id: string;
  order_number: number;
  customer_email: string;
  customer_name: string | null;
  total_amount: number;
  subtotal_amount: number;
  tax_amount: number;
  shipping_amount: number;
  currency: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
}

// GET /api/customers/[id]/orders - Get all orders for a customer
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get customer by ID
    const customer = await queryDatabase(
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );

    if (!customer.length) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get all orders for this customer
    const orders = await queryDatabase(`
      SELECT * FROM orders
      WHERE customer_email = ?
      ORDER BY created_at DESC
    `, [customer[0].email]) as Order[];

    // Get order items for all orders
    const orderIds = (orders || []).map((o: Order) => o.id);

    let orderItemsMap: Record<string, OrderItem[]> = {};

    if (orderIds.length > 0) {
      // Get items for each order
      for (const orderId of orderIds) {
        const items = await queryDatabase(`
          SELECT * FROM order_items WHERE order_id = ?
        `, [orderId]) as OrderItem[];
        orderItemsMap[orderId] = items || [];
      }
    }

    // Format response
    const formattedOrders = (orders || []).map((order: Order) => ({
      id: order.id,
      orderNumber: order.order_number,
      totalAmount: order.total_amount,
      subtotalAmount: order.subtotal_amount,
      taxAmount: order.tax_amount,
      shippingAmount: order.shipping_amount,
      currency: order.currency,
      status: order.status,
      paymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status,
      createdAt: order.created_at,
      items: (orderItemsMap[order.id] || []).map((item: OrderItem) => ({
        id: item.id,
        title: item.title,
        variantTitle: item.variant_title,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.total_price,
        imageUrl: item.image_url,
      })),
    }));

    // Calculate customer stats
    const stats = {
      totalOrders: formattedOrders.length,
      totalSpent: formattedOrders.reduce((sum: number, o: { totalAmount: number; status: string }) =>
        o.status === 'paid' || o.status === 'fulfilled' ? sum + o.totalAmount : sum, 0),
      averageOrderValue: formattedOrders.length > 0
        ? formattedOrders.reduce((sum: number, o: { totalAmount: number }) => sum + o.totalAmount, 0) / formattedOrders.length
        : 0,
      firstOrderDate: formattedOrders.length > 0
        ? formattedOrders[formattedOrders.length - 1].createdAt
        : null,
      lastOrderDate: formattedOrders.length > 0
        ? formattedOrders[0].createdAt
        : null,
    };

    return NextResponse.json({
      success: true,
      customer: {
        id: customer[0].id,
        email: customer[0].email,
        firstName: customer[0].first_name,
        lastName: customer[0].last_name,
        phone: customer[0].phone,
        createdAt: customer[0].created_at,
      },
      stats,
      orders: formattedOrders,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Error fetching customer orders:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
