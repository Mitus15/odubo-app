import { NextRequest, NextResponse } from 'next/server';
import { verifyUserFromRequest, isAdminUser } from '@/lib/auth';
import type { AuthTokenPayload } from '@/lib/auth';

/**
 * Admin gate for API routes.
 *
 * Uses `verifyUserFromRequest` (jose.jwtVerify): the session cookie, or a
 * Bearer token, must carry a valid signature. (`getUserFromRequest` once
 * decoded without verifying; it now does the same check.)
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

/**
 * Gate for a job that a scheduler or an admin may start. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; an admin carries their session. With
 * CRON_SECRET unset only the admin path is accepted, so it fails closed.
 */
export async function requireCronOrAdmin(
  req: NextRequest
): Promise<{ error: NextResponse } | { error: null }> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) {
    return { error: null };
  }
  const gate = await requireAdmin(req);
  return gate.error ? { error: gate.error } : { error: null };
}
