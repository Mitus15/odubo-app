import { NextRequest } from 'next/server';
import { jwtVerify, SignJWT, JWTPayload } from 'jose';
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
    const payload = decodeWithoutVerify(token) as AuthTokenPayload | null;
    return payload && payload.userId && payload.email ? payload : null;
  } catch {
    return null;
  }
}

export async function verifyUserFromRequest(req: NextRequest): Promise<AuthTokenPayload | null> {
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

function decodeWithoutVerify(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);
    const binary = typeof atob === 'function' ? atob(padded) : globalThis.atob!(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as JWTPayload;
  } catch {
    return null;
  }
}

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
    const token = getAuthTokenFromRequest(req);
    if (!token) return null;
    const payload = decodeWithoutVerify(token) as AuthTokenPayload | null;
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



