/**
 * Shopify Storefront API Client
 * Centralized API calls with proper typing and error handling
 */

import type {
  Product,
  ProductSummary,
  ProductVariant,
  ProductImage,
  ProductsResponse,
  SortOption,
  ProductFilters,
  ShopifyConnection,
} from './types';

// ============================================
// Configuration
// ============================================

const getConfig = () => {
  const storeUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
  const accessToken = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  
  if (!accessToken) {
    throw new Error('Missing NEXT_PUBLIC_SHOPIFY_API_KEY environment variable');
  }
  
  return {
    endpoint: `${storeUrl}/api/2024-07/graphql.json`,
    accessToken,
  };
};

// ============================================
// GraphQL Queries
// ============================================

const PRODUCTS_QUERY = `#graphql
  query Products($first: Int!, $after: String, $sortKey: ProductSortKeys, $reverse: Boolean, $query: String) {
    products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          handle
          title
          availableForSale
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          compareAtPriceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 1) {
            edges {
              node {
                url
                altText
              }
            }
          }
          collections(first: 1) {
            edges {
              node {
                handle
              }
            }
          }
        }
      }
    }
  }
`;

const PRODUCT_DETAIL_QUERY = `#graphql
  query Product($handle: String!) {
    product(handle: $handle) {
      id
      handle
      title
      description
      vendor
      productType
      tags
      availableForSale
      createdAt
      images(first: 20) {
        edges {
          node {
            url
            altText
          }
        }
      }
      options {
        name
        values
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            availableForSale
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
              altText
            }
          }
        }
      }
    }
  }
`;

// ============================================
// API Functions
// ============================================

async function shopifyFetch<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const { endpoint, accessToken } = getConfig();
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    console.error('Shopify API Error:', response.status, text);
    throw new Error(`Shopify API error: ${response.status}`);
  }
  
  const json = await response.json() as any;
  
  if (json.errors) {
    console.error('Shopify GraphQL Errors:', JSON.stringify(json.errors, null, 2));
    const errorMessages = json.errors.map((e: any) => e.message).join(', ');
    throw new Error(`GraphQL Error: ${errorMessages}`);
  }
  
  return json.data as T;
}

// ============================================
// Sort Key Mapping
// ============================================

function getSortParams(sort: SortOption): { sortKey: string; reverse: boolean } {
  switch (sort) {
    case 'newest':
      return { sortKey: 'CREATED_AT', reverse: true };
    case 'oldest':
      return { sortKey: 'CREATED_AT', reverse: false };
    case 'price-asc':
      return { sortKey: 'PRICE', reverse: false };
    case 'price-desc':
      return { sortKey: 'PRICE', reverse: true };
    case 'title-asc':
      return { sortKey: 'TITLE', reverse: false };
    case 'title-desc':
      return { sortKey: 'TITLE', reverse: true };
    default:
      return { sortKey: 'CREATED_AT', reverse: true };
  }
}

// ============================================
// Build Query String for Filters
// ============================================

function buildFilterQuery(filters: ProductFilters): string | undefined {
  const parts: string[] = [];
  
  if (filters.collection) {
    parts.push(`collection:${filters.collection}`);
  }
  
  if (filters.available !== undefined) {
    parts.push(`available_for_sale:${filters.available}`);
  }
  
  if (filters.search) {
    parts.push(filters.search);
  }
  
  // Note: Price filtering via query is limited in Storefront API
  // We filter client-side for price ranges
  
  return parts.length > 0 ? parts.join(' AND ') : undefined;
}

// ============================================
// Exported API Functions
// ============================================

export async function fetchProducts(options: {
  first?: number;
  after?: string | null;
  sort?: SortOption;
  filters?: ProductFilters;
}): Promise<ProductsResponse> {
  const { first = 24, after = null, sort = 'newest', filters = {} } = options;
  const { sortKey, reverse } = getSortParams(sort);
  const query = buildFilterQuery(filters);
  
  const data = await shopifyFetch<{
    products: ShopifyConnection<any>;
  }>(PRODUCTS_QUERY, {
    first,
    after,
    sortKey,
    reverse,
    query,
  });
  
  const products: ProductSummary[] = data.products.edges.map(({ node: p }) => {
    const image = p.images?.edges?.[0]?.node;
    const price = parseFloat(p.priceRange?.minVariantPrice?.amount || '0');
    const compareAtPrice = p.compareAtPriceRange?.minVariantPrice?.amount
      ? parseFloat(p.compareAtPriceRange.minVariantPrice.amount)
      : null;
    const currency = p.priceRange?.minVariantPrice?.currencyCode || 'USD';
    const collection = p.collections?.edges?.[0]?.node?.handle;
    
    return {
      id: p.id,
      handle: p.handle,
      title: p.title,
      image: image ? { url: image.url, altText: image.altText } : null,
      price,
      compareAtPrice: compareAtPrice && compareAtPrice > price ? compareAtPrice : null,
      currency,
      available: p.availableForSale,
      collection,
    };
  });
  
  // Client-side price filtering
  let filteredProducts = products;
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    filteredProducts = products.filter(p => {
      if (filters.priceMin !== undefined && p.price < filters.priceMin) return false;
      if (filters.priceMax !== undefined && p.price > filters.priceMax) return false;
      return true;
    });
  }
  
  return {
    products: filteredProducts,
    pageInfo: {
      hasNextPage: data.products.pageInfo.hasNextPage,
      endCursor: data.products.pageInfo.endCursor,
    },
  };
}

export async function fetchProduct(handle: string): Promise<Product | null> {
  try {
    const data = await shopifyFetch<{ product: any }>(PRODUCT_DETAIL_QUERY, { handle });
    
    if (!data.product) return null;
    
    const p = data.product;
    
    const images: ProductImage[] = p.images?.edges?.map(({ node: img }: any) => ({
      url: img.url,
      altText: img.altText,
    })) || [];
    
    const variants: ProductVariant[] = p.variants?.edges?.map(({ node: v }: any) => ({
      id: v.id,
      title: v.title,
      price: parseFloat(v.price?.amount || '0'),
      compareAtPrice: null, // Not available in basic query
      currency: v.price?.currencyCode || 'USD',
      available: v.availableForSale,
      quantityAvailable: 0, // Not available without unauthenticated_read_product_inventory scope
      selectedOptions: v.selectedOptions?.reduce(
        (acc: Record<string, string>, opt: { name: string; value: string }) => ({
          ...acc,
          [opt.name]: opt.value,
        }),
        {}
      ) || {},
      image: v.image ? { url: v.image.url, altText: v.image.altText } : null,
    })) || [];
    
    return {
      id: p.id,
      handle: p.handle,
      title: p.title,
      description: p.description || '',
      vendor: p.vendor || '',
      productType: p.productType || '',
      tags: p.tags || [],
      images,
      options: p.options || [],
      variants,
      available: p.availableForSale,
      createdAt: p.createdAt,
    };
  } catch (error) {
    console.error('Error fetching product:', handle, error);
    return null;
  }
}

export interface CheckoutAttribution {
  sessionId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  visitorId?: string;
  // Entry content attribution
  entryClipId?: number;
  entryGalleryId?: number;
  entryAlbumId?: string;
  entryPath?: string;
}

export async function createCheckout(
  items: { variantId: string; quantity: number }[],
  attribution?: CheckoutAttribution
): Promise<string | null> {
  const { endpoint, accessToken } = getConfig();

  const query = `#graphql
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const lines = items.map(item => ({
    merchandiseId: item.variantId,
    quantity: item.quantity,
  }));

  // Build attribution attributes for revenue tracking
  const attributes = [
    { key: '_source', value: 'odubo_store' },
  ];

  if (attribution?.sessionId) {
    attributes.push({ key: '_session', value: attribution.sessionId });
  }
  if (attribution?.visitorId) {
    attributes.push({ key: '_visitor', value: attribution.visitorId });
  }
  if (attribution?.utmSource) {
    attributes.push({ key: '_utm_source', value: attribution.utmSource });
  }
  if (attribution?.utmMedium) {
    attributes.push({ key: '_utm_medium', value: attribution.utmMedium });
  }
  if (attribution?.utmCampaign) {
    attributes.push({ key: '_utm_campaign', value: attribution.utmCampaign });
  }
  // Entry content attribution for "which content drove this sale"
  if (attribution?.entryClipId) {
    attributes.push({ key: '_entry_clip_id', value: String(attribution.entryClipId) });
  }
  if (attribution?.entryGalleryId) {
    attributes.push({ key: '_entry_gallery_id', value: String(attribution.entryGalleryId) });
  }
  if (attribution?.entryAlbumId) {
    attributes.push({ key: '_entry_album_id', value: attribution.entryAlbumId });
  }
  if (attribution?.entryPath) {
    attributes.push({ key: '_entry_path', value: attribution.entryPath });
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query,
        variables: {
          input: {
            lines,
            attributes,
          },
        },
      }),
    });

    const json = await response.json() as any;

    if (json.data?.cartCreate?.userErrors?.length > 0) {
      console.error('Cart creation errors:', json.data.cartCreate.userErrors);
      return null;
    }

    return json.data?.cartCreate?.cart?.checkoutUrl || null;
  } catch (error) {
    console.error('Error creating checkout:', error);
    return null;
  }
}
