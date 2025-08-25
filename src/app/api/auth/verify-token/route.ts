import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
import * as jose from 'jose';
import { getAuthTokenFromRequest, getJwtSecret } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Resolve secret at request time to avoid build-time env checks
    const JWT_SECRET = getJwtSecret();
    let token: string | undefined;
    try {
      const body = await req.json() as { token?: string };
      token = body?.token;
    } catch {}

    if (!token) token = getAuthTokenFromRequest(req) || undefined;
    if (!token) return NextResponse.json({ success: false, error: 'Token not provided' }, { status: 400 });

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    return NextResponse.json({ success: true, decoded: payload });
  } catch (error: any) {
    console.error('Token verification failed:', error);
    return NextResponse.json({ success: false, error: error.message || 'Invalid token' }, { status: 401 });
  }
}
