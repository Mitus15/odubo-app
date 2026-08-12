import { normalizeCountry } from './store/money';
import { excludeTagsClause } from './store/brands';

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  category: string;
  status: string;
  price: number;
  images: string[];
  variants: any[];
  inventory: string | number;
  collections: string[];
  createdAt: string;
}

export async function getShopifyProducts(): Promise<{ success: boolean; products?: ShopifyProduct[]; error?: string; details?: any }> {
  try {
    const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
    const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

    if (!PUBLIC_TOKEN) {
      console.error('Missing NEXT_PUBLIC_SHOPIFY_API_KEY');
      return { success: false, error: 'Configuration Error: Missing Public API Key' };
    }

    const endpoint = `${STORE_URL}/api/2024-07/graphql.json`;
    
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
    };

    // Excludes the Loop Soul pass. This feeds the sitemap and /api/products,
    // so without it the pass gets a public, indexable /store/product/… URL and
    // an entry in the merch API — the two surfaces least likely to be noticed.
    const query = `#graphql
      query Products($query: String) {
        products(first: 50, sortKey: CREATED_AT, reverse: true, query: $query) {
          edges {
            node {
              id
              title
              handle
              description
              vendor
              productType
              availableForSale
              createdAt
              collections(first: 10) {
                edges {
                  node {
                    handle
                  }
                }
              }
              images(first: 4) {
                edges {
                  node {
                    url
                  }
                }
              }
              variants(first: 20) {
                edges {
                  node {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables: { query: excludeTagsClause() } }),
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('Shopify Storefront API Error:', res.status, txt);
      return { success: false, error: `Shopify error ${res.status}`, details: txt };
    }

    const data = await res.json() as any;
    
    if (data.errors) {
      console.error('Shopify GraphQL Errors:', JSON.stringify(data.errors, null, 2));
      return { success: false, error: 'Shopify GraphQL Error', details: data.errors };
    }

    const products = data?.data?.products?.edges.map(({ node }: any) => {
      const variants = node.variants.edges.map(({ node: v }: any) => ({
        id: v.id,
        title: v.title,
        price: parseFloat(v.price.amount),
        inventory_quantity: 0
      }));

      const images = node.images.edges.map(({ node: img }: any) => img.url);
      const collections = node.collections?.edges.map(({ node: c }: any) => c.handle) || [];

      return {
        id: node.id,
        title: node.title,
        handle: node.handle,
        description: node.description,
        vendor: node.vendor,
        category: node.productType,
        status: node.availableForSale ? 'active' : 'archived',
        price: variants.length > 0 ? variants[0].price : 0,
        images,
        variants,
        inventory: 'N/A',
        collections,
        createdAt: node.createdAt
      };
    }) || [];

    return { success: true, products };
  } catch (e: any) {
    console.error('Shopify Library Exception:', e);
    return { success: false, error: e.message };
  }
}

export async function getShopifyProduct(handle: string, country?: string): Promise<{ success: boolean; product?: ShopifyProduct; error?: string }> {
  try {
    const ctxCountry = normalizeCountry(country);
    const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
    const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

    if (!PUBLIC_TOKEN) return { success: false, error: 'Missing API Key' };

    const endpoint = `${STORE_URL}/api/2024-07/graphql.json`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
    };

    const query = `#graphql
      query Product($handle: String!, $country: CountryCode!) @inContext(country: $country) {
        product(handle: $handle) {
          id
          title
          handle
          description
          vendor
          productType
          availableForSale
          createdAt
          collections(first: 10) {
            edges {
              node {
                handle
              }
            }
          }
          images(first: 10) {
            edges {
              node {
                url
              }
            }
          }
          variants(first: 20) {
            edges {
              node {
                id
                title
                availableForSale
                quantityAvailable
                price {
                  amount
                  currencyCode
                }
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                }
              }
            }
          }
          options {
            name
            values
          }
        }
      }
    `;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables: { handle, country: ctxCountry } }),
      next: { revalidate: 60 },
    });

    if (!res.ok) return { success: false, error: `Shopify error ${res.status}` };

    const data = await res.json() as any;
    const p = data?.data?.product;

    if (!p) return { success: false, error: 'Product not found' };

    const variants = p.variants.edges.map(({ node: v }: any) => ({
      id: v.id,
      title: v.title,
      price: parseFloat(v.price.amount),
      currency: v.price.currencyCode,
      available: v.availableForSale,
      quantityAvailable: v.quantityAvailable,
      selectedOptions: v.selectedOptions.reduce((acc: any, curr: any) => ({ ...acc, [curr.name]: curr.value }), {}),
      image: v.image ? { src: v.image.url } : null
    }));

    const product: ShopifyProduct = {
      id: p.id,
      title: p.title,
      handle: p.handle,
      description: p.description,
      vendor: p.vendor,
      category: p.productType,
      status: p.availableForSale ? 'active' : 'archived',
      price: variants.length > 0 ? variants[0].price : 0,
      images: p.images.edges.map(({ node: img }: any) => img.url),
      variants,
      inventory: 'N/A',
      collections: p.collections?.edges.map(({ node: c }: any) => c.handle) || [],
      createdAt: p.createdAt
    };

    // Add options to the interface if needed, but for now we map it in the client
    (product as any).options = p.options;

    return { success: true, product };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
