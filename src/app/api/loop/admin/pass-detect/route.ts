import { NextResponse } from "next/server";

/**
 * Find the pass product in the Shopify store (Storefront API) so the admin
 * doesn't have to copy SKUs and build cart permalinks by hand: create the
 * product in Shopify, tap "Detect", go live.
 *
 * A candidate is any product whose title or SKU contains "pass".
 * Auth: middleware gates /api/loop/admin/*.
 */
export async function GET() {
  const store = process.env.SHOPIFY_STORE_URL || "https://odubostudio.myshopify.com";
  const token = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  if (!token) {
    return NextResponse.json({ error: "Storefront API is not configured" }, { status: 500 });
  }

  const query = `{
    products(first: 50) {
      edges { node { title handle availableForSale
        variants(first: 5) { edges { node { id sku title availableForSale
          price { amount currencyCode } quantityAvailable
        } } }
      } }
    }
  }`;

  try {
    const res = await fetch(`${store}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Shopify said ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as {
      data?: {
        products?: {
          edges?: Array<{
            node: {
              title: string;
              handle: string;
              availableForSale: boolean;
              variants: {
                edges: Array<{
                  node: {
                    id: string;
                    sku: string | null;
                    title: string;
                    availableForSale: boolean;
                    price: { amount: string; currencyCode: string };
                    quantityAvailable: number | null;
                  };
                }>;
              };
            };
          }>;
        };
      };
    };

    const candidates: Array<{
      title: string;
      sku: string | null;
      price: string;
      currency: string;
      quantityAvailable: number | null;
      checkoutUrl: string;
    }> = [];

    for (const edge of data.data?.products?.edges ?? []) {
      const p = edge.node;
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const hay = `${p.title} ${p.handle} ${v.sku ?? ""} ${v.title}`.toLowerCase();
        if (!hay.includes("pass")) continue;
        const numericId = v.id.split("/").pop();
        if (!numericId) continue;
        candidates.push({
          title: p.title === v.title || v.title === "Default Title" ? p.title : `${p.title} — ${v.title}`,
          sku: v.sku || null,
          price: v.price.amount,
          currency: v.price.currencyCode,
          quantityAvailable: v.quantityAvailable,
          checkoutUrl: `${store}/cart/${numericId}:1`,
        });
      }
    }

    return NextResponse.json({ candidates });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Detection failed" }, { status: 502 });
  }
}
