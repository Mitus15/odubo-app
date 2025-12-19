/**
 * The Hub - Auth Me API
 * GET /api/v2/auth/me - Get current user with permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserFromRequest, isAdminUser } from '@/lib/auth';
import { getHubUser, resolveUserPermissions, getUserAccessibleModules } from '@/lib/hub/permissions';
import { unauthorized, success, serverError } from '@/lib/hub/middleware';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    // Verify JWT token
    const authUser = await verifyUserFromRequest(req);
    if (!authUser) {
      return unauthorized('Invalid or expired token');
    }

    // Get full Hub user with permissions
    const hubUser = await getHubUser(authUser.userId);

    if (!hubUser) {
      return unauthorized('User not found');
    }

    // Check legacy admin status
    const isLegacyAdmin = isAdminUser(authUser);

    // If legacy admin but no roles assigned yet, give them full access
    if (isLegacyAdmin && (!hubUser.roles || hubUser.roles.length === 0)) {
      hubUser.permissions = {
        ...hubUser.permissions,
        isFullAdmin: true,
      };
      hubUser.accessibleModules = [
        'content',
        'social',
        'commerce',
        'analytics',
        'communications',
        'projects',
        'events',
        'system',
        'reports',
        'marketing',
      ];
    }

    return success(hubUser);
  } catch (error) {
    console.error('Auth me error:', error);
    return serverError('Failed to fetch user');
  }
}
