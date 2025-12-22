import { NextRequest, NextResponse } from 'next/server';

interface LineItem {
  variantId: string;
  quantity: number;
}

interface CheckoutRequestBody {
  lineItems: LineItem[];
}

interface CheckoutResponse {
  data?: {
    checkoutCreate: {
      checkout: {
        id: string;
        webUrl: string;
      };
      checkoutUserErrors: Array<{
        code: string;
        field: string[];
        message: string;
      }>;
    };
  };
  errors?: any[];
}

/**
 * Shopify Checkout Creation API
 * 
 * Creates a checkout session using Storefront API
 * Returns checkout URL that redirects to your custom domain
 */
export async function POST(request: NextRequest) {
  try {
    const { lineItems } = await request.json() as CheckoutRequestBody;

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'No items in cart' },
        { status: 400 }
      );
    }

    const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
    const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

    if (!STOREFRONT_TOKEN) {
      return NextResponse.json(
        { error: 'Shopify configuration missing' },
        { status: 500 }
      );
    }

    // Create checkout with Storefront API
    const mutation = `#graphql
      mutation checkoutCreate($input: CheckoutCreateInput!) {
        checkoutCreate(input: $input) {
          checkout {
            id
            webUrl
          }
          checkoutUserErrors {
            code
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        lineItems: lineItems.map((item: any) => ({
          variantId: item.variantId,
          quantity: item.quantity
        })),
        // Add custom attributes for tracking
        customAttributes: [
          {
            key: '_source',
            value: 'odubo_headless_store'
          },
          {
            key: '_return_url',
            value: process.env.NEXT_PUBLIC_SITE_URL || 'https://odubo.studio'
          }
        ]
      }
    };

    const response = await fetch(`${STORE_URL}/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    const { data, errors } = await response.json() as CheckoutResponse;

    if (errors || (data?.checkoutCreate?.checkoutUserErrors?.length ?? 0) > 0) {
      console.error('Checkout creation errors:', errors || data?.checkoutCreate?.checkoutUserErrors);
      return NextResponse.json(
        { error: 'Failed to create checkout' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'No data returned from checkout creation' },
        { status: 500 }
      );
    }

    const checkoutUrl = data.checkoutCreate.checkout.webUrl;

    // The webUrl will point to your custom domain if configured
    // Otherwise it points to myshopify.com domain
    return NextResponse.json({ 
      checkoutUrl,
      checkoutId: data.checkoutCreate.checkout.id 
    });

  } catch (error) {
    console.error('Checkout API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}