import { NextRequest, NextResponse } from 'next/server';
import { verifyUserFromRequest, isAdminUser } from '@/lib/auth';

/**
 * GET /api/admin/shopify/status
 * Checks if Shopify is configured and reachable.
 * Returns { connected: boolean, shop?: string, error?: string }
 */
export async function GET(request: NextRequest) {
  // Require admin authentication
  const user = await verifyUserFromRequest(request);
  if (!user || !isAdminUser(user)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const storeUrl = process.env.SHOPIFY_STORE_URL || process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    const publicToken = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
    const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    // Check if env vars are present
    if (!storeUrl || !publicToken) {
      return NextResponse.json({
        success: true,
        connected: false,
        message: 'Shopify not configured',
        details: 'Missing Shopify environment variables (SHOPIFY_STORE_URL, NEXT_PUBLIC_SHOPIFY_API_KEY)',
        envPresent: {
          storeUrl: !!storeUrl,
          publicToken: !!publicToken,
          adminToken: !!adminToken,
        },
      });
    }

    // Try a lightweight API call to verify connectivity
    const query = `{
      shop {
        name
        email
        myshopifyDomain
      }
    }`;

    const response = await fetch(
      `https://${storeUrl.replace(/^https?:\/\//, '')}/api/2024-07/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': publicToken,
        },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({
        success: true,
        connected: false,
        message: 'Shopify API error',
        details: `HTTP ${response.status}: ${text.substring(0, 200)}`,
        envPresent: {
          storeUrl: !!storeUrl,
          publicToken: !!publicToken,
          adminToken: !!adminToken,
        },
      });
    }

    const data = await response.json() as { errors?: Array<{ message: string }>; data?: { shop?: { name: string; email: string | null; myshopifyDomain: string } } };

    if (data.errors) {
      return NextResponse.json({
        success: true,
        connected: false,
        message: 'Shopify GraphQL error',
        details: data.errors.map((e) => e.message).join(', '),
        envPresent: {
          storeUrl: !!storeUrl,
          publicToken: !!publicToken,
          adminToken: !!adminToken,
        },
      });
    }

    const shop = data?.data?.shop;

    return NextResponse.json({
      success: true,
      connected: true,
      message: 'Connected',
      shop: {
        name: shop?.name || 'Odubo Studio',
        domain: shop?.myshopifyDomain || storeUrl,
        email: shop?.email || null,
      },
      envPresent: {
        storeUrl: !!storeUrl,
        publicToken: !!publicToken,
        adminToken: !!adminToken,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      connected: false,
      message: 'Connection failed',
      details: error?.message || 'Unknown error',
      envPresent: {
        storeUrl: !!process.env.SHOPIFY_STORE_URL,
        publicToken: !!process.env.NEXT_PUBLIC_SHOPIFY_API_KEY,
        adminToken: !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      },
    });
  }
}
