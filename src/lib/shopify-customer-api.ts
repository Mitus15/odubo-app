/**
 * Shopify Customer Account API v2
 * 
 * Modern headless customer authentication and data access.
 * Provides seamless customer experience with full data access for analytics.
 */

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID_CUSTOMER_API;
const SHOP_DOMAIN = SHOPIFY_STORE.replace('https://', '');

// Customer Account API endpoint
const CUSTOMER_API_URL = `${SHOPIFY_STORE}/account/customer/api/2024-10/graphql`;

interface CustomerToken {
  accessToken: string;
  expiresAt: string;
  refreshToken?: string;
}

/**
 * Generate authorization URL for Customer Account API
 * This is where you redirect users to login
 */
export function getCustomerAuthUrl(returnUrl: string): string {
  const state = generateState();
  const nonce = generateNonce();
  
  // Store state and nonce in session for verification
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('shopify_auth_state', state);
    sessionStorage.setItem('shopify_auth_nonce', nonce);
  }

  const authUrl = new URL(`${SHOPIFY_STORE}/account/authorize`);
  authUrl.searchParams.set('client_id', CLIENT_ID!);
  authUrl.searchParams.set('scope', 'openid email customer-account-api:full');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/shopify/callback`);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);

  return authUrl.toString();
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<CustomerToken> {
  const tokenUrl = `${SHOPIFY_STORE}/account/authorize/token`;
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/shopify/callback`,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    refreshToken: data.refresh_token,
  };
}

/**
 * Fetch customer data using Customer Account API
 */
export async function getCustomerData(accessToken: string) {
  const query = `#graphql
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
        orders(first: 10) {
          edges {
            node {
              id
              number
              processedAt
              totalPrice {
                amount
                currencyCode
              }
              fulfillments(first: 10) {
                edges {
                  node {
                    status
                  }
                }
              }
              lineItems(first: 50) {
                edges {
                  node {
                    title
                    quantity
                    price {
                      amount
                      currencyCode
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
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch customer data');
  }

  const { data, errors } = await response.json();
  
  if (errors) {
    throw new Error(errors[0].message);
  }

  return data.customer;
}

/**
 * Get customer orders for analytics
 */
export async function getCustomerOrders(accessToken: string, first: number = 50) {
  const query = `#graphql
    query CustomerOrders($first: Int!) {
      customer {
        orders(first: $first, sortKey: PROCESSED_AT, reverse: true) {
          edges {
            node {
              id
              number
              processedAt
              financialStatus
              fulfillmentStatus
              totalPrice {
                amount
                currencyCode
              }
              lineItems(first: 100) {
                edges {
                  node {
                    title
                    variantTitle
                    quantity
                    price {
                      amount
                      currencyCode
                    }
                    product {
                      id
                      title
                      productType
                      vendor
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
    body: JSON.stringify({ 
      query,
      variables: { first }
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch orders');
  }

  const { data } = await response.json();
  return data.customer.orders.edges.map((edge: any) => edge.node);
}

/**
 * Update customer profile
 */
export async function updateCustomerProfile(
  accessToken: string,
  updates: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  }
) {
  const mutation = `#graphql
    mutation CustomerUpdate($input: CustomerUpdateInput!) {
      customerUpdate(input: $input) {
        customer {
          id
          firstName
          lastName
        }
        userErrors {
          field
          message
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
    body: JSON.stringify({
      query: mutation,
      variables: { input: updates }
    }),
  });

  const { data } = await response.json();
  return data.customerUpdate;
}

// Helper functions
function generateState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify state parameter to prevent CSRF
 */
export function verifyState(receivedState: string): boolean {
  if (typeof window === 'undefined') return false;
  const storedState = sessionStorage.getItem('shopify_auth_state');
  sessionStorage.removeItem('shopify_auth_state');
  return storedState === receivedState;
}
