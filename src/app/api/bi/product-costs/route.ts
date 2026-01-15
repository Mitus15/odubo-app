import { queryDatabase, executeQuery } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import type { ProductCostInput } from '@/types/bi';

export const runtime = 'nodejs';

// GET /api/bi/product-costs - List product costs
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const productHandle = url.searchParams.get('product_handle');
    const current = url.searchParams.get('current') === 'true';

    let sql = 'SELECT * FROM bi_product_costs WHERE 1=1';
    const params: string[] = [];

    if (productHandle) {
      sql += ' AND product_handle = ?';
      params.push(productHandle);
    }

    if (current) {
      sql += ' AND (effective_to IS NULL OR effective_to >= date("now"))';
    }

    sql += ' ORDER BY product_handle, effective_from DESC';

    const results = await queryDatabase(sql, params);

    return NextResponse.json({ success: true, costs: results });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/bi/product-costs - Add product cost
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ProductCostInput;

    if (!body.product_handle || body.unit_cost_cents === undefined || !body.effective_from) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: product_handle, unit_cost_cents, effective_from' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    // If this is a new current cost, close out the previous one
    if (!body.effective_to) {
      await executeQuery(`
        UPDATE bi_product_costs
        SET effective_to = ?, updated_at = datetime('now')
        WHERE product_handle = ?
          AND (variant_sku IS NULL OR variant_sku = ?)
          AND effective_to IS NULL
      `, [body.effective_from, body.product_handle, body.variant_sku || null]);
    }

    await executeQuery(`
      INSERT INTO bi_product_costs (
        id, product_handle, variant_sku, unit_cost_cents,
        shipping_cost_cents, packaging_cost_cents,
        effective_from, effective_to, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      body.product_handle,
      body.variant_sku || null,
      body.unit_cost_cents,
      body.shipping_cost_cents || 0,
      body.packaging_cost_cents || 0,
      body.effective_from,
      body.effective_to || null,
      body.notes || null
    ]);

    const cost = await queryDatabase('SELECT * FROM bi_product_costs WHERE id = ?', [id]);

    return NextResponse.json({ success: true, cost: cost[0] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/bi/product-costs - Update product cost
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as { id: string } & Partial<ProductCostInput>;

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.unit_cost_cents !== undefined) {
      updates.push('unit_cost_cents = ?');
      values.push(body.unit_cost_cents);
    }
    if (body.shipping_cost_cents !== undefined) {
      updates.push('shipping_cost_cents = ?');
      values.push(body.shipping_cost_cents);
    }
    if (body.packaging_cost_cents !== undefined) {
      updates.push('packaging_cost_cents = ?');
      values.push(body.packaging_cost_cents);
    }
    if (body.effective_to !== undefined) {
      updates.push('effective_to = ?');
      values.push(body.effective_to);
    }
    if (body.notes !== undefined) {
      updates.push('notes = ?');
      values.push(body.notes);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(body.id);

    await executeQuery(`UPDATE bi_product_costs SET ${updates.join(', ')} WHERE id = ?`, values);

    const cost = await queryDatabase('SELECT * FROM bi_product_costs WHERE id = ?', [body.id]);

    return NextResponse.json({ success: true, cost: cost[0] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/bi/product-costs - Delete product cost
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    }

    await executeQuery('DELETE FROM bi_product_costs WHERE id = ?', [id]);

    return NextResponse.json({ success: true, deleted: id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
