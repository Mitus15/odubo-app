import { queryDatabase } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sortBy = searchParams.get('sort') || 'created_at';
    const sortOrder = searchParams.get('order') || 'DESC';

    // Validate sort field to prevent SQL injection
    const allowedSorts = ['created_at', 'total_spent', 'orders_count', 'email', 'first_name'];
    const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get customers with stats and last order date
    const results = await queryDatabase(`
      SELECT
        c.*,
        (SELECT MAX(created_at) FROM orders WHERE customer_email = c.email) as last_order_date,
        (SELECT COUNT(*) FROM orders WHERE customer_email = c.email AND status = 'paid') as paid_orders_count
      FROM customers c
      ORDER BY ${safeSortBy} ${safeSortOrder}
    `, []);

    // Format response
    const customers = (results || []).map((c: any) => ({
      id: c.id,
      email: c.email,
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone,
      totalSpent: c.total_spent || 0,
      ordersCount: c.orders_count || 0,
      paidOrdersCount: c.paid_orders_count || 0,
      lastOrderDate: c.last_order_date,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return NextResponse.json({ success: true, customers });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Error fetching customers:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
