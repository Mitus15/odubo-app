import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/requireAdmin';
import { getShopifyProducts } from '@/lib/shopify';
import { getFeaturedHandle, setFeaturedHandle } from '@/lib/featuredProduct';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/featured-product
 * The featured product's handle and the store's products to choose from.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const [handle, list] = await Promise.all([getFeaturedHandle(), getShopifyProducts()]);
  const products = (list.products || []).map((p) => ({
    handle: p.handle,
    title: p.title,
    image: p.images?.[0] ?? null,
  }));
  return NextResponse.json({ handle, products });
}

/**
 * PUT /api/admin/featured-product  { handle: string | null }
 * Choose the piece the /links landing puts first (null shows none). The
 * handle must be a product Shopify returns, so a typo never empties the landing.
 */
export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  let body: { handle?: string | null };
  try {
    body = (await request.json()) as { handle?: string | null };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const handle = typeof body.handle === 'string' ? body.handle.trim() : null;

  if (handle) {
    const list = await getShopifyProducts();
    if (!list.success) {
      return NextResponse.json({ error: 'Could not reach Shopify to check the product' }, { status: 502 });
    }
    if (!(list.products || []).some((p) => p.handle === handle)) {
      return NextResponse.json({ error: `No product "${handle}" in the store` }, { status: 400 });
    }
  }

  await setFeaturedHandle(handle || null);
  return NextResponse.json({ handle: handle || null });
}
