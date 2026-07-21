import { NextRequest, NextResponse } from 'next/server';
import { getAuthTokenFromRequest, getJwtSecret } from '@/lib/auth';
import { jwtVerify } from 'jose';

export const runtime = 'edge';

const getSecret = () => new TextEncoder().encode(getJwtSecret());

/**
 * Get the authenticated user from the JWT token in the request
 */
export async function getAuthenticatedUser(req: NextRequest) {
  const token = getAuthTokenFromRequest(req);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { userId: string; email: string; is_admin: boolean; [key: string]: any };
  } catch {
    return null;
  }
}

/**
 * Require authentication - returns 401 if not authenticated
 */
export async function requireAuth(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return user;
}

/**
 * Require admin - returns 403 if not admin
 */
export async function requireAdmin(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;
  
  if (!user.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}
