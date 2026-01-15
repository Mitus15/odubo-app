// @ts-ignore
import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export interface Discount {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'bogo' | 'free_shipping';
  value: number;
  description: string | null;
  status: 'active' | 'scheduled' | 'expired' | 'disabled';
  usage_count: number;
  usage_limit: number | null;
  usage_per_customer: number;
  start_date: string;
  end_date: string | null;
  min_purchase_cents: number | null;
  max_discount_cents: number | null;
  applies_to: string;
  product_handles: string | null;
  collection_handles: string | null;
  excluded_products: string | null;
  customer_restriction: string;
  specific_customer_emails: string | null;
  can_combine_with_other_discounts: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to compute status based on dates
function computeStatus(discount: Discount): Discount['status'] {
  if (discount.status === 'disabled') return 'disabled';

  const now = new Date();
  const startDate = new Date(discount.start_date);
  const endDate = discount.end_date ? new Date(discount.end_date) : null;

  if (startDate > now) return 'scheduled';
  if (endDate && endDate < now) return 'expired';
  return 'active';
}

// GET /api/admin/discounts - List all discounts
export async function GET(req: NextRequest) {
  try {
    const { env } = getRequestContext();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = `
      SELECT * FROM discounts
      ORDER BY created_at DESC
    `;

    const { results } = await env.DB.prepare(query).all();

    // Compute actual status based on dates and map to frontend format
    const discounts = (results || []).map((d: Discount) => {
      const actualStatus = computeStatus(d);
      return {
        id: d.id,
        code: d.code,
        type: d.type,
        value: d.type === 'fixed' ? Math.round(d.value / 100) : d.value, // Convert cents to dollars for fixed
        status: actualStatus,
        usageCount: d.usage_count,
        usageLimit: d.usage_limit,
        startDate: d.start_date,
        endDate: d.end_date,
        minPurchase: d.min_purchase_cents ? Math.round(d.min_purchase_cents / 100) : undefined,
        description: d.description,
        // Full data for editing
        _raw: d,
      };
    }).filter((d: { status: string }) => !status || status === 'all' || d.status === status);

    return NextResponse.json({ success: true, discounts });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Error fetching discounts:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/admin/discounts - Create a new discount
export async function POST(req: NextRequest) {
  try {
    const { env } = getRequestContext();
    const body = await req.json();

    const {
      code,
      type,
      value,
      description,
      start_date,
      end_date,
      usage_limit,
      min_purchase,
      notes,
    } = body;

    if (!code || !type || !start_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: code, type, start_date' },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await env.DB.prepare(
      'SELECT id FROM discounts WHERE code = ?'
    ).bind(code.toUpperCase()).first();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A discount with this code already exists' },
        { status: 400 }
      );
    }

    // Convert dollars to cents for fixed amounts and min purchase
    const valueInCents = type === 'fixed' ? Math.round(value * 100) : value;
    const minPurchaseCents = min_purchase ? Math.round(min_purchase * 100) : null;

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    await env.DB.prepare(`
      INSERT INTO discounts (
        id, code, type, value, description, status,
        start_date, end_date, usage_limit, min_purchase_cents, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      code.toUpperCase(),
      type,
      valueInCents,
      description || null,
      'active',
      start_date,
      end_date || null,
      usage_limit || null,
      minPurchaseCents,
      notes || null
    ).run();

    // Fetch the created discount
    const created = await env.DB.prepare(
      'SELECT * FROM discounts WHERE id = ?'
    ).bind(id).first();

    return NextResponse.json({ success: true, discount: created });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Error creating discount:', e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
