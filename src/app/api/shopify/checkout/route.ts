import { NextRequest, NextResponse } from 'next/server';

interface LineItem {
  variantId: string;
  quantity: number;
}

interface CheckoutRequestBody {
  lineItems: LineItem[];
}

interface CartResponse {
  data?: {
    cartCreate: {
      cart: {
        id: string;
        checkoutUrl: string;
      };
      userErrors: Array<{
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

    // Use myshopify.com domain for API calls, not custom domain
    const STORE_URL = 'https://odubostudio.myshopify.com';
    const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

    if (!STOREFRONT_TOKEN) {
      return NextResponse.json(
        { error: 'Shopify configuration missing' },
        { status: 500 }
      );
    }

    console.log('Creating checkout with store:', STORE_URL);

    // Create cart with Storefront API (new Cart API, not deprecated Checkout API)
    const mutation = `#graphql
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
          }
          userErrors {
            code
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        lines: lineItems.map((item: any) => ({
          merchandiseId: item.variantId,
          quantity: item.quantity
        })),
        // Add custom attributes for tracking
        attributes: [
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

    const response = await fetch(`${STORE_URL}/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    console.log('Shopify response status:', response.status);
    const responseText = await response.text();
    console.log('Shopify response body:', responseText);

    let parsedResponse: CartResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse Shopify response:', e);
      return NextResponse.json(
        { error: 'Invalid response from Shopify', details: responseText.substring(0, 200) },
        { status: 500 }
      );
    }

    const { data, errors } = parsedResponse;

    if (errors || (data?.cartCreate?.userErrors?.length ?? 0) > 0) {
      console.error('Cart creation errors:', JSON.stringify(errors || data?.cartCreate?.userErrors, null, 2));
      return NextResponse.json(
        { error: 'Failed to create cart', details: errors || data?.cartCreate?.userErrors },
        { status: 500 }
      );
    }

    if (!data) {
      console.error('No data in response:', responseText);
      return NextResponse.json(
        { error: 'No data returned from cart creation', details: responseText.substring(0, 200) },
        { status: 500 }
      );
    }

    if (!data.cartCreate?.cart?.checkoutUrl) {
      console.error('No checkoutUrl in cart:', JSON.stringify(data, null, 2));
      return NextResponse.json(
        { error: 'No checkout URL in response', details: data },
        { status: 500 }
      );
    }

    const checkoutUrl = data.cartCreate.cart.checkoutUrl;

    console.log('✅ Shopify returned checkout URL:', checkoutUrl);
    console.log('🔍 Domain check:', checkoutUrl.includes('checkout.odubo.studio') ? 'Custom domain ✓' : 'Default Shopify domain');

    // Use the URL exactly as Shopify provides it
    // This should be a valid checkout URL regardless of custom domain settings
    return NextResponse.json({
      checkoutUrl,
      cartId: data.cartCreate.cart.id
    });

  } catch (error) {
    console.error('Checkout API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}