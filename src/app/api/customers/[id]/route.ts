// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// GET /api/customers/[id] - Get single customer with stats
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = getRequestContext();
    const { id } = await params;

    const customer = await env.DB.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).bind(id).first();

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get order stats
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status IN ('paid', 'fulfilled') THEN total_amount ELSE 0 END) as total_spent,
        AVG(total_amount) as avg_order_value,
        MIN(created_at) as first_order_date,
        MAX(created_at) as last_order_date
      FROM orders
      WHERE customer_email = ?
    `).bind(customer.email).first();

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        totalSpent: customer.total_spent || 0,
        ordersCount: customer.orders_count || 0,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at,
      },
      stats: {
        totalOrders: stats?.total_orders || 0,
        totalSpent: stats?.total_spent || 0,
        averageOrderValue: stats?.avg_order_value || 0,
        firstOrderDate: stats?.first_order_date,
        lastOrderDate: stats?.last_order_date,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Error fetching customer:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/customers/[id] - Update customer
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { env } = getRequestContext();
    const { id } = await params;
    const body = await req.json();

    const existing = await env.DB.prepare(
      'SELECT id FROM customers WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const { firstName, lastName, phone } = body;

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(firstName || null);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(lastName || null);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone || null);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await env.DB.prepare(`
      UPDATE customers SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    const updated = await env.DB.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).bind(id).first();

    return NextResponse.json({ success: true, customer: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Error updating customer:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
