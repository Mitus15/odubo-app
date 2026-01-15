import { queryDatabase, executeQuery } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GET /api/customers/[id] - Get single customer with stats
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Get order stats
    const stats = await queryDatabase(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status IN ('paid', 'fulfilled') THEN total_amount ELSE 0 END) as total_spent,
        AVG(total_amount) as avg_order_value,
        MIN(created_at) as first_order_date,
        MAX(created_at) as last_order_date
      FROM orders
      WHERE customer_email = ?
    `, [customer[0].email]);

    return NextResponse.json({
      success: true,
      customer: {
        id: customer[0].id,
        email: customer[0].email,
        firstName: customer[0].first_name,
        lastName: customer[0].last_name,
        phone: customer[0].phone,
        totalSpent: customer[0].total_spent || 0,
        ordersCount: customer[0].orders_count || 0,
        createdAt: customer[0].created_at,
        updatedAt: customer[0].updated_at,
      },
      stats: {
        totalOrders: stats[0]?.total_orders || 0,
        totalSpent: stats[0]?.total_spent || 0,
        averageOrderValue: stats[0]?.avg_order_value || 0,
        firstOrderDate: stats[0]?.first_order_date,
        lastOrderDate: stats[0]?.last_order_date,
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
    const { id } = await params;
    const body = await req.json();

    const existing = await queryDatabase(
      'SELECT id FROM customers WHERE id = ?',
      [id]
    );

    if (!existing.length) {
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

    await executeQuery(`
      UPDATE customers SET ${updates.join(', ')} WHERE id = ?
    `, values);

    const updated = await queryDatabase(
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );

    return NextResponse.json({ success: true, customer: updated[0] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Error updating customer:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
