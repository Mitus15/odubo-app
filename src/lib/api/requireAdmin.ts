import { NextRequest, NextResponse } from 'next/server';
import { verifyUserFromRequest, isAdminUser } from '@/lib/auth';
import type { AuthTokenPayload } from '@/lib/auth';

/**
 * Admin gate for API routes.
 *
 * Uses `verifyUserFromRequest` (jose.jwtVerify), NOT `getUserFromRequest`.
 * The latter decodes the JWT payload WITHOUT checking the signature, so a
 * forged unsigned `{"is_admin":true}` token passes it. Every route that
 * touches release data must verify.
 *
 * Returns a NextResponse to return immediately, or the verified user.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ error: NextResponse; user: null } | { error: null; user: AuthTokenPayload }> {
  const user = await verifyUserFromRequest(req);
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  if (!isAdminUser(user)) {
    return { error: NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 }), user: null };
  }
  return { error: null, user };
}
