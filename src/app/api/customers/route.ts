import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { env } = getRequestContext();
    const { results } = await env.DB.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
    return NextResponse.json({ success: true, customers: results });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
