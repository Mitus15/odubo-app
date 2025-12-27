import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import { getAuthTokenFromRequest, getJwtSecret } from '@/lib/auth';

export const runtime = 'edge';

// Simple in-memory rate limiter for edge runtime
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  // Clean up old entries occasionally
  if (Math.random() < 0.01) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (val.resetAt < now) rateLimitMap.delete(key);
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

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
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('cf-connecting-ip') ||
             'unknown';
  const rateCheck = checkRateLimit(ip);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        }
      }
    );
  }

  try {
    const result = await verifyFromRequest(req);
    const response = NextResponse.json(result.body, { status: result.status });
    response.headers.set('X-RateLimit-Remaining', String(rateCheck.remaining));
    return response;
  } catch (error: any) {
    console.error('Token verification failed:', error);
    return NextResponse.json({ success: false, error: error.message || 'Invalid token' }, { status: 401 });
  }
}

export async function GET(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('cf-connecting-ip') ||
             'unknown';
  const rateCheck = checkRateLimit(ip);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        }
      }
    );
  }

  try {
    const result = await verifyFromRequest(req);
    const response = NextResponse.json(result.body, { status: result.status });
    response.headers.set('X-RateLimit-Remaining', String(rateCheck.remaining));
    return response;
  } catch (error: any) {
    console.error('Token verification failed:', error);
    return NextResponse.json({ success: false, error: error.message || 'Invalid token' }, { status: 401 });
  }
}
