/**
 * Shopify Admin API Client
 *
 * Works on Shopify Basic plan with these limitations:
 * - No PII (customer emails/addresses) in responses
 * - 60-day order history by default
 * - 50 points/second rate limit (GraphQL)
 *
 * Scales to Plus without code changes:
 * - PII becomes available
 * - Rate limits increase to 500 pts/sec
 * - Reports API can be added as additional data source
 */

// Types for Shopify Admin API responses
export interface ShopifyAdminOrder {
  id: string;
  name: string; // Order number like #1001
  createdAt: string;
  updatedAt: string;
  processedAt: string;
  closedAt: string | null;
  cancelledAt: string | null;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  subtotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  totalTaxSet: { shopMoney: { amount: string; currencyCode: string } };
  totalDiscountsSet: { shopMoney: { amount: string; currencyCode: string } };
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  customer: {
    id: string;
  } | null;
  sourceName: string;
  landingSite: string | null;
  referringSite: string | null;
  // Custom attributes from checkout (for attribution tracking)
  customAttributes: Array<{ key: string; value: string | null }>;
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        variantTitle: string | null;
        quantity: number;
        sku: string | null;
        product: { id: string } | null;
        variant: { id: string } | null;
        originalTotalSet: { shopMoney: { amount: string } };
        totalDiscountSet: { shopMoney: { amount: string } };
      };
    }>;
  };
}

export interface ShopifyOrdersResponse {
  orders: ShopifyAdminOrder[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

// Rate limit tracking
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 100; // ~10 req/sec to stay well under 50 pts/sec

/**
 * Get Shopify Admin API configuration
 */
function getConfig() {
  const storeUrl = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
  const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!adminToken) {
    throw new Error('SHOPIFY_ADMIN_ACCESS_TOKEN is not configured');
  }

  // Extract store domain for Admin API
  const storeDomain = storeUrl.replace('https://', '').replace('http://', '');

  return {
    endpoint: `https://${storeDomain}/admin/api/2024-07/graphql.json`,
    token: adminToken,
  };
}

/**
 * Rate-limited fetch for Shopify Admin API
 */
async function adminFetch(query: string, variables?: Record<string, unknown>): Promise<any> {
  const config = getConfig();

  // Simple rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify Admin API error ${response.status}: ${text}`);
  }

  const data: any = await response.json();

  if (data.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

/**
 * Fetch orders from Shopify Admin API
 *
 * @param options.since - Only fetch orders updated after this date
 * @param options.cursor - Pagination cursor for next page
 * @param options.limit - Number of orders per page (max 50)
 */
export async function fetchOrders(options: {
  since?: string;
  cursor?: string;
  limit?: number;
}): Promise<ShopifyOrdersResponse> {
  const { since, cursor, limit = 50 } = options;

  // Build query filter
  let queryFilter = '';
  if (since) {
    queryFilter = `query: "updated_at:>'${since}'"`;
  }

  const query = `
    query Orders($first: Int!, $after: String) {
      orders(first: $first, after: $after, ${queryFilter} sortKey: UPDATED_AT) {
        edges {
          node {
            id
            name
            createdAt
            updatedAt
            processedAt
            closedAt
            cancelledAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            subtotalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalTaxSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalDiscountsSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            displayFinancialStatus
            displayFulfillmentStatus
            customer {
              id
            }
            sourceName
            landingSite
            referringSite
            customAttributes {
              key
              value
            }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  title
                  variantTitle
                  quantity
                  sku
                  product {
                    id
                  }
                  variant {
                    id
                  }
                  originalTotalSet {
                    shopMoney {
                      amount
                    }
                  }
                  totalDiscountSet {
                    shopMoney {
                      amount
                    }
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const data = await adminFetch(query, {
    first: limit,
    after: cursor || null,
  });

  const orders = data.data.orders.edges.map((edge: any) => edge.node);
  const pageInfo = data.data.orders.pageInfo;

  return { orders, pageInfo };
}

/**
 * Fetch a single order by ID
 */
export async function fetchOrder(orderId: string): Promise<ShopifyAdminOrder | null> {
  const query = `
    query Order($id: ID!) {
      order(id: $id) {
        id
        name
        createdAt
        updatedAt
        processedAt
        closedAt
        cancelledAt
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        subtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalTaxSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalDiscountsSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        displayFinancialStatus
        displayFulfillmentStatus
        customer {
          id
        }
        sourceName
        landingSite
        referringSite
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              variantTitle
              quantity
              sku
              product {
                id
              }
              variant {
                id
              }
              originalTotalSet {
                shopMoney {
                  amount
                }
              }
              totalDiscountSet {
                shopMoney {
                  amount
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await adminFetch(query, { id: orderId });
  return data.data.order;
}

/**
 * Convert Shopify money string to cents
 */
export function toCents(amount: string): number {
  return Math.round(parseFloat(amount) * 100);
}

/**
 * Extract order number from Shopify order name (e.g., "#1001" -> 1001)
 */
export function extractOrderNumber(name: string): number {
  return parseInt(name.replace('#', ''), 10) || 0;
}

/**
 * Generate a hash for customer ID (for fan profile linking without PII)
 */
export function hashCustomerId(customerId: string): string {
  // Simple hash for demo - in production use crypto.subtle
  let hash = 0;
  for (let i = 0; i < customerId.length; i++) {
    const char = customerId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `cust_${Math.abs(hash).toString(16)}`;
}

/**
 * Parse UTM parameters from landing site URL
 */
export function parseUtmParams(url: string | null): {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
} {
  if (!url) return {};

  try {
    const parsed = new URL(url);
    return {
      utm_source: parsed.searchParams.get('utm_source') || undefined,
      utm_medium: parsed.searchParams.get('utm_medium') || undefined,
      utm_campaign: parsed.searchParams.get('utm_campaign') || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Check if Shopify Admin API is configured
 */
export function isAdminApiConfigured(): boolean {
  return !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
}

/**
 * Get shop info (for testing connection)
 */
export async function getShopInfo(): Promise<{
  name: string;
  email: string;
  domain: string;
  plan: string;
}> {
  const query = `
    query Shop {
      shop {
        name
        email
        primaryDomain {
          host
        }
        plan {
          displayName
        }
      }
    }
  `;

  const data = await adminFetch(query);
  const shop = data.data.shop;

  return {
    name: shop.name,
    email: shop.email,
    domain: shop.primaryDomain.host,
    plan: shop.plan.displayName,
  };
}
