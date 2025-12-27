/**
 * Product Search API
 * Searches Shopify products by query string
 *
 * GET /api/shopify/products/search?q=shirt&limit=12
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '';
const API_VERSION = process.env.SHOPIFY_STOREFRONT_VERSION || '2024-07';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50);

    if (!PUBLIC_TOKEN) {
      return NextResponse.json({ error: 'Store not configured' }, { status: 500 });
    }

    // If no query, return empty results
    if (!query.trim()) {
      return NextResponse.json({ products: [], query: '' });
    }

    const endpoint = `${STORE_URL}/api/${API_VERSION}/graphql.json`;

    // Use Shopify's product search query
    // The query parameter searches across title, description, tags, etc.
    const graphqlQuery = `#graphql
      query SearchProducts($query: String!, $first: Int!) {
        products(first: $first, query: $query, sortKey: RELEVANCE) {
          edges {
            node {
              id
              title
              handle
              description
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
              productType
              tags
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
      body: JSON.stringify({
        query: graphqlQuery,
        variables: {
          query: query,
          first: limit,
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('[SEARCH] Shopify error:', res.status, txt);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    const data = await res.json() as any;

    if (data?.errors?.length) {
      console.error('[SEARCH] GraphQL errors:', data.errors);
      return NextResponse.json({ error: 'Search query failed' }, { status: 502 });
    }

    const products = (data?.data?.products?.edges || []).map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      description: edge.node.description?.substring(0, 150) || null,
      image: edge.node.featuredImage?.url || null,
      price: edge.node.priceRange?.minVariantPrice?.amount || '0',
      currencyCode: edge.node.priceRange?.minVariantPrice?.currencyCode || 'USD',
      availableForSale: edge.node.availableForSale,
      productType: edge.node.productType,
      tags: edge.node.tags || [],
    }));

    return NextResponse.json(
      {
        products,
        query,
        count: products.length,
      },
      {
        headers: {
          // Short cache since search results may change
          'Cache-Control': 'public, max-age=60, s-maxage=120',
        },
      }
    );
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unexpected error';
    console.error('[SEARCH] Error:', errorMsg);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
