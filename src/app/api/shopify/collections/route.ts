import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '';
const API_VERSION = process.env.SHOPIFY_STOREFRONT_VERSION || '2024-07';

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type'); // 'clothes' | 'items' (optional)



    // Optionally map tabs to collection handles
    const handleMap: Record<string, string> = {
      clothes: 'Clothes',
      items: 'Items',
    };

    const collectionHandle = type && handleMap[type] ? handleMap[type] : null;

    const query = collectionHandle ? `#graphql
      query ProductsByCollection($handle: String!) {
        collectionByHandle(handle: $handle) {
          title
          handle
          products(first: 24) {
            edges {
              node {
                id
                title
                handle
                images(first: 1) { edges { node { url } } }
                priceRange { minVariantPrice { amount } }
              }
            }
          }
        }
      }
    ` : `#graphql
      query MaybeAll($first: Int = 24) {
        products(first: $first) {
          edges { node { id title handle images(first:1){edges{node{url}}} priceRange{minVariantPrice{amount}} } }
        }
      }
    `;

    const variables = collectionHandle ? { handle: collectionHandle } : undefined;

    if (!PUBLIC_TOKEN) {
      return NextResponse.json({ error: 'Missing NEXT_PUBLIC_SHOPIFY_API_KEY' }, { status: 500 });
    }

    const endpoint = `${STORE_URL}/api/${API_VERSION}/graphql.json`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Shopify error ${res.status}`, detail: txt }, { status: 500 });
    }

    const data = await res.json() as any;

    if (data?.errors?.length) {
      return NextResponse.json({ error: 'Shopify GraphQL error', detail: data.errors }, { status: 502 });
    }
    if (collectionHandle && !data?.data?.collectionByHandle) {
      // Attempt to find by title from all collections and retry
      const findQuery = `#graphql
        query AllCollections { collections(first: 50) { edges { node { title handle } } } }
      `;
      const findRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
        },
        body: JSON.stringify({ query: findQuery }),
        cache: 'no-store',
      });
      const findData = await findRes.json() as any;
      const edgesC = findData?.data?.collections?.edges || [];
      const match = edgesC.find((e: any) => (e.node.title || '').toLowerCase().includes(collectionHandle));
      if (!match) {
        return NextResponse.json({ error: `Collection not found`, handle: collectionHandle }, { status: 404 });
      }
      // Retry with the matched handle
      const retryVars = { handle: match.node.handle };
      const retryRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
        },
        body: JSON.stringify({ query, variables: retryVars }),
        cache: 'no-store',
      });
      const retryData = await retryRes.json() as any;
      const retryEdges = retryData?.data?.collectionByHandle?.products?.edges || [];
      const products = retryEdges.map((e: any) => ({
        id: e.node.id,
        title: e.node.title,
        handle: e.node.handle,
        image: e.node.images?.edges?.[0]?.node?.url || null,
        price: e.node.priceRange?.minVariantPrice?.amount || null,
      }));
      return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const edges = collectionHandle
      ? data?.data?.collectionByHandle?.products?.edges
      : data?.data?.products?.edges;

    const products = (edges || []).map((e: any) => ({
      id: e.node.id,
      title: e.node.title,
      handle: e.node.handle,
      image: e.node.images?.edges?.[0]?.node?.url || null,
      price: e.node.priceRange?.minVariantPrice?.amount || null,
    }));

    return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: 'Unexpected error', detail: errorMsg }, { status: 500 });
  }
}


