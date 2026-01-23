import { NextRequest, NextResponse } from 'next/server';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

/**
 * POST /api/store/cart/sync
 * Sync local cart to server for cross-device persistence
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { visitorId, items, subtotalCents, currency, checkoutUrl } = body;

    if (!visitorId) {
      return NextResponse.json({ error: 'visitorId required' }, { status: 400 });
    }

    // Generate cart ID if new
    const cartId = `cart_${visitorId.slice(0, 16)}`;
    const itemsJson = JSON.stringify(items || []);

    // Upsert cart
    await executeQuery(
      `INSERT INTO carts (id, visitor_id, items, subtotal_cents, currency, checkout_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         items = excluded.items,
         subtotal_cents = excluded.subtotal_cents,
         currency = excluded.currency,
         checkout_url = COALESCE(excluded.checkout_url, carts.checkout_url),
         updated_at = datetime('now')`,
      [
        cartId,
        visitorId,
        itemsJson,
        subtotalCents || 0,
        currency || 'USD',
        checkoutUrl || null,
      ]
    );

    return NextResponse.json({ success: true, cartId });
  } catch (error) {
    console.error('Cart sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/store/cart/sync?visitorId=xxx
 * Retrieve cart by visitorId
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const visitorId = searchParams.get('visitorId');

    if (!visitorId) {
      return NextResponse.json({ error: 'visitorId required' }, { status: 400 });
    }

    const cartId = `cart_${visitorId.slice(0, 16)}`;

    const rows = await queryDatabase(
      `SELECT items, subtotal_cents, currency, checkout_url, updated_at
       FROM carts WHERE id = ?`,
      [cartId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        items: [],
        subtotalCents: 0,
        currency: 'USD',
        checkoutUrl: null,
      });
    }

    const cart = rows[0] as {
      items: string;
      subtotal_cents: number;
      currency: string;
      checkout_url: string | null;
      updated_at: string;
    };

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(cart.items);
    } catch {}

    return NextResponse.json({
      items: parsedItems,
      subtotalCents: cart.subtotal_cents,
      currency: cart.currency,
      checkoutUrl: cart.checkout_url,
      updatedAt: cart.updated_at,
    });
  } catch (error) {
    console.error('Cart fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    );
  }
}
