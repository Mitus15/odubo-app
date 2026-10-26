import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/api/requireAdmin';

export const runtime = 'edge';

// Customer records (names, emails, addresses): admins only, both ways. Until
// 2026-10-08 GET answered anyone, and POST was fed by a demo checkout page
// (/store/checkout, deleted the same day) that took a stranger's details.
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate.error) return gate.error;

  try {
    const results = await queryDatabase('SELECT * FROM orders ORDER BY created_at DESC', []);
    return NextResponse.json({ success: true, orders: results || [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;
  try {
    const body = await req.json();
    const { customer, items, total, subtotal } = body as any;

    const orderId = crypto.randomUUID();
    const orderNumber = Math.floor(1000 + Math.random() * 9000);

    // Create Customer if not exists (simplified)
    const customerId = crypto.randomUUID();
    try {
      await executeQuery(
        `INSERT INTO customers (id, email, first_name, last_name) VALUES (?, ?, ?, ?)`,
        [customerId, customer.email, customer.firstName, customer.lastName]
      );
    } catch (e) {
      // Ignore duplicate email error for now
    }

    // Create Order
    await executeQuery(
      `INSERT INTO orders (
        id, order_number, customer_email, customer_name,
        shipping_address, total_amount, subtotal_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        orderNumber,
        customer.email,
        `${customer.firstName} ${customer.lastName}`,
        JSON.stringify(customer.address),
        total,
        subtotal,
        'pending'
      ]
    );

    // Create Order Items - look up product_id for each variant
    for (const item of items) {
      const variantResult = await queryDatabase(
        'SELECT product_id FROM product_variants WHERE id = ?',
        [item.variantId]
      );
      const productId = variantResult?.[0]?.product_id || 'unknown';

      await executeQuery(
        `INSERT INTO order_items (
          id, order_id, product_id, variant_id, title, quantity, price, total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          orderId,
          productId,
          item.variantId,
          item.title,
          item.qty,
          item.price,
          item.price * item.qty
        ]
      );
    }

    return NextResponse.json({ success: true, orderId, orderNumber });
  } catch (e: any) {
    console.error('Order creation failed:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
