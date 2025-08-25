import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getAuthTokenFromRequest, getJwtSecret } from '@/lib/auth';
const JWT_SECRET = getJwtSecret();

export async function POST(req: NextRequest) {
  try {
    let token: string | undefined;
    try {
      const body = await req.json() as { token?: string };
      token = body?.token;
    } catch {}

    if (!token) token = getAuthTokenFromRequest(req) || undefined;
    if (!token) return NextResponse.json({ success: false, error: 'Token not provided' }, { status: 400 });

    const decoded = jwt.verify(token, JWT_SECRET);
    return NextResponse.json({ success: true, decoded });
  } catch (error: any) {
    console.error('Token verification failed:', error);
    return NextResponse.json({ success: false, error: error.message || 'Invalid token' }, { status: 401 });
  }
}
