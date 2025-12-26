/**
 * Admin Check Utilities
 * Consolidated admin detection for both client and server
 */

import { NextRequest } from 'next/server';
import { verifyUserFromRequest, isAdminUser, type AuthTokenPayload } from './auth';

/**
 * Check if the current request is from an admin user
 * Returns true if authenticated AND admin
 */
export async function isRequestFromAdmin(req: NextRequest): Promise<boolean> {
  try {
    const user = await verifyUserFromRequest(req);
    if (!user) return false;

    return isAdminUser(user);
  } catch (error) {
    console.error('Admin check error:', error);
    return false;
  }
}

/**
 * Check if a JWT payload represents an admin
 * For client-side checks (decode token from cookie/localStorage)
 */
export function isAdminFromPayload(payload: AuthTokenPayload | null): boolean {
  if (!payload) return false;
  return isAdminUser(payload);
}
