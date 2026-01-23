import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * POST /api/store/inventory
 * Validate inventory for variants before checkout
 * Uses Shopify Admin API which has full inventory access
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { variantIds } = body as { variantIds: string[] };

    if (!Array.isArray(variantIds) || variantIds.length === 0) {
      return NextResponse.json({ error: 'variantIds array required' }, { status: 400 });
    }

    const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const storeUrl = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';

    if (!adminToken) {
      // If no admin token, allow checkout (fail open)
      console.warn('SHOPIFY_ADMIN_ACCESS_TOKEN not configured, skipping inventory check');
      return NextResponse.json({ valid: true, outOfStock: [] });
    }

    const storeDomain = storeUrl.replace('https://', '').replace('http://', '');
    const endpoint = `https://${storeDomain}/admin/api/2024-07/graphql.json`;

    // Build GraphQL query to fetch variant inventory
    // Note: variantIds come as GIDs like "gid://shopify/ProductVariant/12345"
    const query = `
      query VariantsInventory($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            title
            inventoryQuantity
            availableForSale
            product {
              title
            }
          }
        }
      }
    `;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      body: JSON.stringify({
        query,
        variables: { ids: variantIds },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Shopify Admin API error:', response.status, text);
      // Fail open - allow checkout if API fails
      return NextResponse.json({ valid: true, outOfStock: [], error: 'API error, allowing checkout' });
    }

    const data = await response.json() as any;

    if (data.errors) {
      console.error('Shopify GraphQL errors:', data.errors);
      return NextResponse.json({ valid: true, outOfStock: [], error: 'GraphQL error, allowing checkout' });
    }

    // Check each variant
    const outOfStock: Array<{
      variantId: string;
      title: string;
      productTitle: string;
      quantity: number;
    }> = [];

    for (const node of data.data?.nodes || []) {
      if (!node) continue;

      // inventoryQuantity of 0 or null, or availableForSale false
      const isOutOfStock = node.inventoryQuantity <= 0 || !node.availableForSale;

      if (isOutOfStock) {
        outOfStock.push({
          variantId: node.id,
          title: node.title,
          productTitle: node.product?.title || 'Unknown',
          quantity: node.inventoryQuantity || 0,
        });
      }
    }

    return NextResponse.json({
      valid: outOfStock.length === 0,
      outOfStock,
      checked: variantIds.length,
    });
  } catch (error) {
    console.error('Inventory check error:', error);
    // Fail open on errors
    return NextResponse.json({
      valid: true,
      outOfStock: [],
      error: error instanceof Error ? error.message : 'Check failed',
    });
  }
}
