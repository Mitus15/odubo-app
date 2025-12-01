// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { env } = getRequestContext();
    const { results } = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    return NextResponse.json({ success: true, orders: results });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { env } = getRequestContext();
    const body = await req.json();
    const { customer, items, total, subtotal } = body as any;
    
    const orderId = crypto.randomUUID();
    const orderNumber = Math.floor(1000 + Math.random() * 9000); // Simple random order number for now

    // Create Customer if not exists (simplified)
    const customerId = crypto.randomUUID();
    // In a real app, we'd check if email exists, but for now just insert or ignore
    try {
      await env.DB.prepare(`
        INSERT INTO customers (id, email, first_name, last_name)
        VALUES (?, ?, ?, ?)
      `).bind(customerId, customer.email, customer.firstName, customer.lastName).run();
    } catch (e) {
      // Ignore duplicate email error for now
    }

    // Create Order
    await env.DB.prepare(`
      INSERT INTO orders (
        id, order_number, customer_email, customer_name, 
        shipping_address, total_amount, subtotal_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId,
      orderNumber,
      customer.email,
      `${customer.firstName} ${customer.lastName}`,
      JSON.stringify(customer.address),
      total,
      subtotal,
      'pending'
    ).run();

    // Create Order Items
    const stmt = env.DB.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, variant_id, title, quantity, price, total_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // We need to look up product_id for each variant. 
    // For performance, we could do a single query with IN clause, but for now loop is fine for small orders.
    const itemsWithProductIds = await Promise.all(items.map(async (item: any) => {
      const variant = await env.DB.prepare('SELECT product_id FROM product_variants WHERE id = ?').bind(item.variantId).first();
      return {
        ...item,
        productId: variant?.product_id || 'unknown'
      };
    }));

    const batch = itemsWithProductIds.map((item: any) => stmt.bind(
      crypto.randomUUID(),
      orderId,
      item.productId,
      item.variantId,
      item.title,
      item.qty,
      item.price,
      item.price * item.qty
    ));

    await env.DB.batch(batch);

    return NextResponse.json({ success: true, orderId, orderNumber });
  } catch (e: any) {
    console.error('Order creation failed:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
