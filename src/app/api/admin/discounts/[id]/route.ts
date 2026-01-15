import { queryDatabase, executeQuery } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GET /api/admin/discounts/[id] - Get single discount
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const discount = await queryDatabase(
      'SELECT * FROM discounts WHERE id = ?',
      [id]
    );

    if (!discount.length) {
      return NextResponse.json(
        { success: false, error: 'Discount not found' },
        { status: 404 }
      );
    }

    // Get redemption stats
    const redemptionStats = await queryDatabase(`
      SELECT
        COUNT(*) as total_redemptions,
        SUM(discount_amount_cents) as total_discount_cents,
        AVG(order_total_cents) as avg_order_cents
      FROM discount_redemptions
      WHERE discount_id = ?
    `, [id]);

    return NextResponse.json({
      success: true,
      discount: discount[0],
      stats: redemptionStats[0],
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Error fetching discount:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/admin/discounts/[id] - Update discount
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Check if discount exists
    const existing = await queryDatabase(
      'SELECT id FROM discounts WHERE id = ?',
      [id]
    );

    if (!existing.length) {
      return NextResponse.json(
        { success: false, error: 'Discount not found' },
        { status: 404 }
      );
    }

    const {
      code,
      type,
      value,
      description,
      status,
      start_date,
      end_date,
      usage_limit,
      min_purchase,
      notes,
    } = body;

    // Check for duplicate code if code is changing
    if (code) {
      const duplicateCheck = await queryDatabase(
        'SELECT id FROM discounts WHERE code = ? AND id != ?',
        [code.toUpperCase(), id]
      );

      if (duplicateCheck.length) {
        return NextResponse.json(
          { success: false, error: 'A discount with this code already exists' },
          { status: 400 }
        );
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (code !== undefined) {
      updates.push('code = ?');
      values.push(code.toUpperCase());
    }
    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type);
    }
    if (value !== undefined) {
      updates.push('value = ?');
      // Convert dollars to cents for fixed type
      values.push(type === 'fixed' ? Math.round(value * 100) : value);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(end_date || null);
    }
    if (usage_limit !== undefined) {
      updates.push('usage_limit = ?');
      values.push(usage_limit || null);
    }
    if (min_purchase !== undefined) {
      updates.push('min_purchase_cents = ?');
      values.push(min_purchase ? Math.round(min_purchase * 100) : null);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes || null);
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
      UPDATE discounts SET ${updates.join(', ')} WHERE id = ?
    `, values);

    // Fetch updated discount
    const updated = await queryDatabase(
      'SELECT * FROM discounts WHERE id = ?',
      [id]
    );

    return NextResponse.json({ success: true, discount: updated[0] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Error updating discount:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/admin/discounts/[id] - Delete discount
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if discount exists
    const existing = await queryDatabase(
      'SELECT id, code FROM discounts WHERE id = ?',
      [id]
    );

    if (!existing.length) {
      return NextResponse.json(
        { success: false, error: 'Discount not found' },
        { status: 404 }
      );
    }

    // Delete redemptions first (foreign key)
    await executeQuery(
      'DELETE FROM discount_redemptions WHERE discount_id = ?',
      [id]
    );

    // Delete the discount
    await executeQuery(
      'DELETE FROM discounts WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      message: `Discount ${(existing[0] as { code: string }).code} deleted`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Error deleting discount:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
