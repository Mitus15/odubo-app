import { NextRequest } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { getUserByEmail } from '@/lib/db';

export type AuthTokenPayload = {
  userId: string;
  email: string;
  is_admin?: boolean;
  firstName?: string;
  lastName?: string;
  exp?: number;
};

export type Role = 'admin' | 'editor' | 'viewer';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRITICAL: JWT_SECRET environment variable is not set. ' +
        'This is required for secure authentication in production.'
      );
    }
    // Only log once per process to avoid spam
    if (typeof globalThis !== 'undefined' && !(globalThis as any).__jwtSecretWarned) {
      console.warn('[AUTH] Using insecure development JWT secret. Set JWT_SECRET for production.');
      (globalThis as any).__jwtSecretWarned = true;
    }
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

/**
 * The verified user on a request, or null.
 *
 * This USED TO decode the JWT payload without checking the signature, so a
 * forged unsigned `{"is_admin":true}` token passed it. 142 files call it and
 * 94 routes outside /api/admin gated on it, all of them forgeable. It now
 * verifies the signature with `jose.jwtVerify`, which makes it async: every
 * caller awaits. `verifyUserFromRequest` is kept as an alias so the routes
 * that already migrated to it (and read as "verify" on purpose) still work.
 */
export async function getUserFromRequest(req: NextRequest): Promise<AuthTokenPayload | null> {
  try {
    const token = getAuthTokenFromRequest(req);
    if (!token) return null;
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jwtVerify(token, secret);
    const auth = payload as AuthTokenPayload;
    if (!auth?.userId || !auth?.email) return null;
    return auth;
  } catch {
    return null;
  }
}

/** The same verification, under the name the migrated routes already use. */
export const verifyUserFromRequest = getUserFromRequest;

function emailInAdminList(email?: string | null): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export function isAdminUser(user: AuthTokenPayload | null | undefined): boolean {
  if (!user) return false;
  // Allow either token claim or env-based admin emails
  if (user.is_admin) return true;
  if (emailInAdminList(user.email)) return true;
  return false;
}

export async function getUserRoleFromRequest(req: NextRequest): Promise<Role | null> {
  try {
    const payload = await getUserFromRequest(req);
    if (!payload?.email) return null;
    const dbUser = await getUserByEmail(payload.email);
    if (!dbUser) return null;
    if (dbUser.is_admin) return 'admin';
    const role = (dbUser as any).role as string | undefined;
    if (role === 'editor') return 'editor';
    return 'viewer';
  } catch {
    return null;
  }
}

export async function userHasAnyRole(req: NextRequest, allowed: Role[]): Promise<boolean> {
  const role = await getUserRoleFromRequest(req);
  if (!role) return false;
  if (role === 'admin') return true;
  return allowed.includes(role);
}



