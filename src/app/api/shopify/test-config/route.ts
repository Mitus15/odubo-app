import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';

export async function GET() {
  try {
    if (!ADMIN_TOKEN) {
      return NextResponse.json({ 
        error: 'SHOPIFY_ADMIN_ACCESS_TOKEN not configured',
        configured: false
      }, { status: 500 });
    }

    if (!STORE_URL) {
      return NextResponse.json({ 
        error: 'SHOPIFY_STORE_URL not configured',
        configured: false
      }, { status: 500 });
    }

    // Test the connection by fetching store info
    const response = await fetch(`${STORE_URL}/admin/api/2024-07/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': ADMIN_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: `Shopify API test failed: ${response.status}`,
        details: errorText,
        configured: false
      }, { status: 500 });
    }

    const shopData = await response.json() as any;
    
    return NextResponse.json({
      message: 'Shopify Admin API configured successfully!',
      configured: true,
      store_info: {
        name: shopData.shop.name,
        domain: shopData.shop.domain,
        email: shopData.shop.email,
        currency: shopData.shop.currency,
        timezone: shopData.shop.timezone
      },
      api_status: 'working',
      permissions: 'Admin API access confirmed'
    });

  } catch (error: any) {
    console.error('Shopify config test error:', error);
    return NextResponse.json({ 
      error: 'Configuration test failed',
      details: error.message,
      configured: false
    }, { status: 500 });
  }
}
