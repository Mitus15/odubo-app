import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || 'c5c1c1a080fcad140b30d06dec6927a9';

export async function GET(req: NextRequest) {
  try {
    const handle = req.nextUrl.searchParams.get('handle');
    if (!handle) return NextResponse.json({ error: 'Missing handle' }, { status: 400 });

    const endpoint = `${STORE_URL}/api/2024-07/graphql.json`;
    const query = `#graphql
      query ProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          description
          handle
          images(first: 4) { edges { node { url } } }
          variants(first: 10) {
            edges { node { id title price currencyCode availableForSale quantityAvailable image { url } } }
          }
        }
      }
    `;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
      },
      body: JSON.stringify({ query, variables: { handle } }),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Shopify error ${res.status}`, detail: txt }, { status: 500 });
    }
    const data = await res.json() as any;
    const product = data?.data?.productByHandle || null;
    return NextResponse.json(product, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600',
        'CDN-Cache-Control': 'public, max-age=600',
        'Vary': 'Accept-Encoding'
      }
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: 'Unexpected error', detail: errorMsg }, { status: 500 });
  }
}



