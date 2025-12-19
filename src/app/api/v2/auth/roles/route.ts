/**
 * The Hub - Roles API
 * GET /api/v2/auth/roles - List all role definitions
 * POST /api/v2/auth/roles - Assign role to user (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getRoleDefinitions,
  getUserRoles,
  assignRole,
  removeRole,
} from '@/lib/hub/permissions';
import {
  requireAuth,
  requireAdmin,
  success,
  badRequest,
  serverError,
  parseBody,
} from '@/lib/hub/middleware';
import { executeQuery } from '@/lib/db';

export const runtime = 'edge';

/**
 * GET - List all role definitions
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ('response' in authResult) {
    return authResult.response;
  }

  try {
    const roles = await getRoleDefinitions();
    const rolesArray = Array.from(roles.values());

    return success({
      roles: rolesArray,
      total: rolesArray.length,
    });
  } catch (error) {
    console.error('Get roles error:', error);
    return serverError('Failed to fetch roles');
  }
}

/**
 * POST - Assign or remove role from user
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ('response' in authResult) {
    return authResult.response;
  }

  const { context } = authResult;

  try {
    const body = await parseBody<{
      action: 'assign' | 'remove';
      userId: string;
      roleSlug: string;
      expiresAt?: string;
      notes?: string;
    }>(req);

    if (!body) {
      return badRequest('Invalid request body');
    }

    const { action, userId, roleSlug, expiresAt, notes } = body;

    if (!userId || !roleSlug) {
      return badRequest('userId and roleSlug are required');
    }

    // Verify user exists
    const userResult = await executeQuery(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );
    const users = userResult.result?.[0]?.results || userResult.results || [];
    if (users.length === 0) {
      return badRequest('User not found');
    }

    // Verify role exists
    const roles = await getRoleDefinitions();
    if (!roles.has(roleSlug)) {
      return badRequest('Role not found');
    }

    if (action === 'assign') {
      const success = await assignRole(userId, roleSlug, context.user.userId, {
        expiresAt,
        notes,
      });

      if (!success) {
        return serverError('Failed to assign role');
      }

      return NextResponse.json({
        success: true,
        message: `Role "${roleSlug}" assigned to user`,
      });
    } else if (action === 'remove') {
      const success = await removeRole(userId, roleSlug, context.user.userId);

      if (!success) {
        return serverError('Failed to remove role');
      }

      return NextResponse.json({
        success: true,
        message: `Role "${roleSlug}" removed from user`,
      });
    } else {
      return badRequest('Invalid action. Use "assign" or "remove"');
    }
  } catch (error) {
    console.error('Roles POST error:', error);
    return serverError('Failed to manage role');
  }
}
