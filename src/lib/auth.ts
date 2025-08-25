import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export type AuthTokenPayload = {
  userId: string;
  email: string;
  is_admin?: boolean;
  firstName?: string;
  lastName?: string;
  exp?: number;
};

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set');
  }
  return secret || 'dev-insecure-secret';
}

export function getAuthTokenFromRequest(req: NextRequest): string | null {
  const cookieToken = req.cookies.get('token')?.value || null;
  if (cookieToken) return cookieToken;
  const header = req.headers.get('authorization');
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  return null;
}

export function getUserFromRequest(req: NextRequest): AuthTokenPayload | null {
  try {
    const token = getAuthTokenFromRequest(req);
    if (!token) return null;
    const decoded = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    if (!decoded || !decoded.userId || !decoded.email) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function isAdminUser(user: AuthTokenPayload | null | undefined): boolean {
  return !!user?.is_admin;
}



