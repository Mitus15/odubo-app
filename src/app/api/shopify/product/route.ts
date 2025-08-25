import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || 'c5c1c1a080fcad140b30d06dec6927a9';

export async function GET(req: NextRequest) {
  try {
    const handle = req.nextUrl.searchParams.get('handle');
    if (!handle) return NextResponse.json({ error: 'Missing handle' }, { status: 400 });

    // Use Storefront API to fetch product by handle
    const query = `#graphql
      query ProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          handle
          description
          images(first: 10) { edges { node { src: url } } }
          options { name values }
          variants(first: 100) {
            edges {
              node {
                id
                title
                availableForSale
                quantityAvailable
                price: priceV2 { amount currencyCode }
                image { src: url }
                selectedOptions { name value }
              }
            }
          }
        }
      }
    `;

    const res = await fetch(`${STORE_URL}/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
      },
      body: JSON.stringify({ query, variables: { handle } }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Shopify error ${res.status}`, detail: txt }, { status: 500 });
    }

    const data = await res.json() as any;
    const p = data?.data?.productByHandle;
    if (!p) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const product = {
      id: p.id,
      title: p.title,
      handle: p.handle,
      description: p.description,
      images: (p.images?.edges || []).map((e: any) => ({ src: e.node.src })),
      options: (p.options || []).map((o: any) => ({ name: o.name, values: o.values })),
      variants: (p.variants?.edges || []).map((e: any) => ({
        id: e.node.id,
        title: e.node.title,
        available: e.node.availableForSale,
        quantityAvailable: e.node.quantityAvailable,
        price: e.node.price.amount,
        currency: e.node.price.currencyCode,
        image: e.node.image ? { src: e.node.image.src } : null,
        selectedOptions: Object.fromEntries((e.node.selectedOptions || []).map((so: any) => [so.name, so.value]))
      }))
    };

    return NextResponse.json(product, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}



