import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getJwtSecret, isAdminUser, type AuthTokenPayload } from '@/lib/auth';

/**
 * Whether the person looking at a server-rendered page is the owner or the
 * team, by a VERIFIED session (the same `token` cookie and signature check as
 * getUserFromRequest). For pages that show unreleased work to the owner only.
 * Fails closed: no cookie, a bad signature or any error is "no".
 */
export async function viewerIsAdmin(): Promise<boolean> {
  try {
    const token = (await cookies()).get('token')?.value;
    if (!token) return false;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(getJwtSecret()));
    const user = payload as AuthTokenPayload;
    return Boolean(user?.userId && user?.email) && isAdminUser(user);
  } catch {
    return false;
  }
}
