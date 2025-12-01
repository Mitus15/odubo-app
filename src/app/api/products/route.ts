import { NextRequest, NextResponse } from 'next/server';
import { getShopifyProducts } from '@/lib/shopify';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const result = await getShopifyProducts();
  
  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ 
    success: false, 
    error: 'Product creation is now managed via Shopify Admin Dashboard' 
  }, { status: 405 });
}

