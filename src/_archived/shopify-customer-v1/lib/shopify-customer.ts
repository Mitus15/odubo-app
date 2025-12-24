/**
 * Shopify Customer API - Clean Implementation
 *
 * Shopify handles ALL customer data. We just access it.
 * No local syncing, no duplicate storage.
 */

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID_CUSTOMER_API;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL}/api/shopify/auth/callback`;
const CUSTOMER_API_URL = `${SHOPIFY_STORE}/account/customer/api/2024-10/graphql`;

// ============================================================================
// Types
// ============================================================================

export interface ShopifyCustomer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  defaultAddress: {
    address1: string | null;
    address2: string | null;
    city: string | null;
    provinceCode: string | null;
    countryCode: string | null;
    zip: string | null;
  } | null;
}

export interface ShopifyOrder {
  id: string;
  orderNumber: number;
  createdAt: string;
  totalPrice: string;
  currencyCode: string;
  fulfillmentStatus: 'UNFULFILLED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'RESTOCKED' | 'PENDING_FULFILLMENT' | 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'SCHEDULED';
  financialStatus: 'PENDING' | 'AUTHORIZED' | 'PARTIALLY_PAID' | 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'VOIDED';
  lineItems: Array<{
    title: string;
    quantity: number;
    price: string;
    image: string | null;
  }>;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string }>;
}

// ============================================================================
// OAuth Flow
// ============================================================================

/**
 * Generate Shopify OAuth login URL
 * State is passed as parameter (caller stores it in cookie for CSRF protection)
 */
export function getAuthUrl(state: string, returnTo?: string): string {
  if (!CLIENT_ID) {
    throw new Error('SHOPIFY_CLIENT_ID_CUSTOMER_API not configured');
  }

  const nonce = generateRandomString(16);
  const authUrl = new URL(`${SHOPIFY_STORE}/account/authorize`);

  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('scope', 'openid email customer-account-api:full');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);

  if (returnTo) {
    // Encode return URL in state (format: "randomState|returnTo")
    authUrl.searchParams.set('state', `${state}|${encodeURIComponent(returnTo)}`);
  }

  return authUrl.toString();
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  if (!CLIENT_ID) {
    throw new Error('SHOPIFY_CLIENT_ID_CUSTOMER_API not configured');
  }

  const tokenUrl = `${SHOPIFY_STORE}/account/authorize/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token exchange failed:', error);
    throw new Error('Failed to exchange code for token');
  }

  const data = await response.json() as TokenResponse;
  return data.access_token;
}

// ============================================================================
// Customer Data
// ============================================================================

/**
 * Fetch customer profile from Shopify
 */
export async function getCustomer(accessToken: string): Promise<ShopifyCustomer> {
  const query = `
    query CustomerProfile {
      customer {
        id
        emailAddress {
          emailAddress
        }
        firstName
        lastName
        phoneNumber {
          phoneNumber
        }
        defaultAddress {
          address1
          address2
          city
          provinceCode
          countryCode
          zip
        }
      }
    }
  `;

  const response = await fetch(CUSTOMER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': accessToken,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch customer');
  }

  const { data, errors } = await response.json() as GraphQLResponse<{ customer: any }>;

  if (errors?.length) {
    throw new Error(errors[0].message);
  }

  if (!data?.customer) {
    throw new Error('No customer data returned');
  }

  const c = data.customer;
  return {
    id: c.id,
    email: c.emailAddress?.emailAddress || '',
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phoneNumber?.phoneNumber || null,
    defaultAddress: c.defaultAddress,
  };
}

/**
 * Fetch customer orders from Shopify
 */
export async function getOrders(accessToken: string, limit: number = 20): Promise<ShopifyOrder[]> {
  const query = `
    query CustomerOrders($first: Int!) {
      customer {
        orders(first: $first, sortKey: PROCESSED_AT, reverse: true) {
          edges {
            node {
              id
              number
              processedAt
              financialStatus
              fulfillments(first: 1) {
                edges {
                  node {
                    status
                  }
                }
              }
              totalPrice {
                amount
                currencyCode
              }
              lineItems(first: 10) {
                edges {
                  node {
                    title
                    quantity
                    price {
                      amount
                    }
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(CUSTOMER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': accessToken,
    },
    body: JSON.stringify({ query, variables: { first: limit } }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch orders');
  }

  const { data, errors } = await response.json() as GraphQLResponse<{ customer: any }>;

  if (errors?.length) {
    throw new Error(errors[0].message);
  }

  if (!data?.customer?.orders) {
    return [];
  }

  return data.customer.orders.edges.map((edge: any) => {
    const order = edge.node;
    const fulfillment = order.fulfillments?.edges?.[0]?.node;

    return {
      id: order.id,
      orderNumber: order.number,
      createdAt: order.processedAt,
      totalPrice: order.totalPrice.amount,
      currencyCode: order.totalPrice.currencyCode,
      fulfillmentStatus: fulfillment?.status || 'UNFULFILLED',
      financialStatus: order.financialStatus || 'PENDING',
      lineItems: order.lineItems.edges.map((item: any) => ({
        title: item.node.title,
        quantity: item.node.quantity,
        price: item.node.price.amount,
        image: item.node.image?.url || null,
      })),
    };
  });
}

/**
 * Fetch both customer profile and orders in one call
 */
export async function getCustomerWithOrders(accessToken: string): Promise<{
  customer: ShopifyCustomer;
  orders: ShopifyOrder[];
}> {
  const [customer, orders] = await Promise.all([
    getCustomer(accessToken),
    getOrders(accessToken),
  ]);

  return { customer, orders };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate random string for state/nonce
 */
export function generateRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Parse state to extract returnTo URL
 */
export function parseState(state: string): { state: string; returnTo?: string } {
  const parts = state.split('|');
  return {
    state: parts[0],
    returnTo: parts[1] ? decodeURIComponent(parts[1]) : undefined,
  };
}

/**
 * Get Shopify account URL for profile editing
 */
export function getShopifyAccountUrl(): string {
  return `${SHOPIFY_STORE}/account`;
}
