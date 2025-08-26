import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import { getAuthTokenFromRequest, getJwtSecret } from '@/lib/auth';

export const runtime = 'edge';

async function verifyFromRequest(req: NextRequest) {
  const JWT_SECRET = getJwtSecret();
  let token: string | undefined;
  try {
    const body = await req.json() as { token?: string };
    token = body?.token;
  } catch {}

  if (!token) token = getAuthTokenFromRequest(req) || undefined;
  if (!token) return { ok: false, status: 400, body: { success: false, error: 'Token not provided' } } as const;

  const secret = new TextEncoder().encode(JWT_SECRET);
  const { payload } = await jose.jwtVerify(token, secret);
  return { ok: true, status: 200, body: { success: true, decoded: payload } } as const;
}

export async function POST(req: NextRequest) {
  try {
    const result = await verifyFromRequest(req);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    console.error('Token verification failed:', error);
    return NextResponse.json({ success: false, error: error.message || 'Invalid token' }, { status: 401 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const result = await verifyFromRequest(req);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    console.error('Token verification failed:', error);
    return NextResponse.json({ success: false, error: error.message || 'Invalid token' }, { status: 401 });
  }
}
