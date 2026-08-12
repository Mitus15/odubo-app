import { NextResponse } from 'next/server';
import { excludeTagsClause } from '@/lib/store/brands';
export const runtime = 'edge';

const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '';
const API_VERSION = process.env.SHOPIFY_STOREFRONT_VERSION || '2024-07';

export async function GET() {
  try {
    if (!PUBLIC_TOKEN) {
      return NextResponse.json({ error: 'Missing NEXT_PUBLIC_SHOPIFY_API_KEY' }, { status: 500 });
    }

    const endpoint = `${STORE_URL}/api/${API_VERSION}/graphql.json`;
    
    // Loop Soul passes are not merch — see lib/store/brands.
    const query = `#graphql
      query AllProducts($query: String) {
        products(first: 50, sortKey: UPDATED_AT, reverse: true, query: $query) {
          edges {
            node {
              id
              title
              handle
              featuredImage {
                url
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              availableForSale
            }
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
      body: JSON.stringify({ query, variables: { query: excludeTagsClause() } }),
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Shopify error ${res.status}`, detail: txt }, { status: 500 });
    }

    const data = await res.json() as any;

    if (data?.errors?.length) {
      return NextResponse.json({ error: 'Shopify GraphQL error', detail: data.errors }, { status: 502 });
    }

    const products = (data?.data?.products?.edges || []).map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      image: edge.node.featuredImage?.url || null,
      price: edge.node.priceRange?.minVariantPrice?.amount || '0',
      currencyCode: edge.node.priceRange?.minVariantPrice?.currencyCode || 'USD',
      availableForSale: edge.node.availableForSale,
    }));

    return NextResponse.json({ products }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600',
        'CDN-Cache-Control': 'public, max-age=600',
      }
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: 'Unexpected error', detail: errorMsg }, { status: 500 });
  }
}
