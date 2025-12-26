/**
 * Store Access Control Utilities
 * Server-side helper for protecting store pages
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { isStorePublished } from '@/lib/storeSettings';
import { isAdminUser, type AuthTokenPayload } from '@/lib/auth';

/**
 * Decode JWT without verification (for quick admin check)
 */
function decodeJWT(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);

    // Use atob in browser or Buffer in Node.js
    const binary = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('utf-8');

    return JSON.parse(binary) as AuthTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Check if current user is admin by reading JWT from cookies
 */
async function checkIsAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return false;

    const payload = decodeJWT(token);
    return isAdminUser(payload);
  } catch {
    return false;
  }
}

/**
 * Protect a store page - redirect non-admins if store unpublished
 * Returns { published, isAdmin } for page use
 */
export async function requireStoreAccess(): Promise<{ published: boolean; isAdmin: boolean }> {
  const published = await isStorePublished();
  const isAdmin = await checkIsAdmin();

  // Redirect non-admins when store is unpublished
  if (!published && !isAdmin) {
    redirect('/');
  }

  return { published, isAdmin };
}
