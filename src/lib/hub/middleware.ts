/**
 * The Hub - API Middleware
 * Permission enforcement for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserFromRequest, isAdminUser, AuthTokenPayload } from '@/lib/auth';
import { canAccess, canAccessAll, canAccessAny, resolveUserPermissions, getHubUser } from './permissions';
import type { Permission, Module, HubUser, ResolvedPermissions } from './types';

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

export function unauthorized(message = 'Authentication required'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

export function forbidden(message = 'Insufficient permissions'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 400 }
  );
}

export function notFound(message = 'Resource not found'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 404 }
  );
}

export function serverError(message = 'Internal server error'): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: 500 }
  );
}

export function success<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}

// =============================================================================
// AUTH CONTEXT
// =============================================================================

export interface AuthContext {
  user: AuthTokenPayload;
  hubUser: HubUser;
  permissions: ResolvedPermissions;
  isFullAdmin: boolean;
}

/**
 * Get authenticated user with Hub permissions
 * Returns null if not authenticated, throws error for internal issues
 */
export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const user = await verifyUserFromRequest(req);
  if (!user) {
    return null;
  }

  const hubUser = await getHubUser(user.userId);
  if (!hubUser) {
    // User exists in JWT but not in database - session invalid
    return null;
  }

  const permissions = await resolveUserPermissions(user.userId);

  // Legacy admin check - admins from is_admin flag get full access
  const isLegacyAdmin = isAdminUser(user);
  const isFullAdmin = permissions.isFullAdmin || isLegacyAdmin;

  return {
    user,
    hubUser: {
      ...hubUser,
      permissions: isLegacyAdmin ? {
        ...permissions,
        isFullAdmin: true,
      } : permissions,
    },
    permissions: isLegacyAdmin ? { ...permissions, isFullAdmin: true } : permissions,
    isFullAdmin,
  };
}

// =============================================================================
// MIDDLEWARE GUARDS
// =============================================================================

/**
 * Require authentication (any valid user)
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ context: AuthContext } | { response: NextResponse }> {
  const context = await getAuthContext(req);
  if (!context) {
    return { response: unauthorized() };
  }
  return { context };
}

/**
 * Require a specific permission on a module
 */
export async function requirePermission(
  req: NextRequest,
  module: Module,
  permission: Permission
): Promise<{ context: AuthContext } | { response: NextResponse }> {
  const context = await getAuthContext(req);
  if (!context) {
    return { response: unauthorized() };
  }

  // Full admins have all permissions
  if (context.isFullAdmin) {
    return { context };
  }

  const hasPermission = await canAccess(context.user.userId, module, permission);
  if (!hasPermission) {
    return {
      response: forbidden(
        `You don't have ${permission} permission for ${module}`
      ),
    };
  }

  return { context };
}

/**
 * Require multiple permissions (ALL must be granted)
 */
export async function requireAllPermissions(
  req: NextRequest,
  requirements: Array<{ module: Module; permission: Permission }>
): Promise<{ context: AuthContext } | { response: NextResponse }> {
  const context = await getAuthContext(req);
  if (!context) {
    return { response: unauthorized() };
  }

  if (context.isFullAdmin) {
    return { context };
  }

  const hasAll = await canAccessAll(context.user.userId, requirements);
  if (!hasAll) {
    return {
      response: forbidden('You don\'t have all required permissions'),
    };
  }

  return { context };
}

/**
 * Require at least one of the specified permissions
 */
export async function requireAnyPermission(
  req: NextRequest,
  requirements: Array<{ module: Module; permission: Permission }>
): Promise<{ context: AuthContext } | { response: NextResponse }> {
  const context = await getAuthContext(req);
  if (!context) {
    return { response: unauthorized() };
  }

  if (context.isFullAdmin) {
    return { context };
  }

  const hasAny = await canAccessAny(context.user.userId, requirements);
  if (!hasAny) {
    return {
      response: forbidden('You don\'t have any of the required permissions'),
    };
  }

  return { context };
}

/**
 * Require admin access (full system control)
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ context: AuthContext } | { response: NextResponse }> {
  const context = await getAuthContext(req);
  if (!context) {
    return { response: unauthorized() };
  }

  if (!context.isFullAdmin) {
    return {
      response: forbidden('Administrator access required'),
    };
  }

  return { context };
}

// =============================================================================
// CONVENIENCE WRAPPERS
// =============================================================================

/**
 * Wrap an API handler with auth requirement
 */
export function withAuth<T>(
  handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const result = await requireAuth(req);
    if ('response' in result) {
      return result.response;
    }
    return handler(req, result.context);
  };
}

/**
 * Wrap an API handler with permission requirement
 */
export function withPermission(
  module: Module,
  permission: Permission,
  handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const result = await requirePermission(req, module, permission);
    if ('response' in result) {
      return result.response;
    }
    return handler(req, result.context);
  };
}

/**
 * Wrap an API handler with admin requirement
 */
export function withAdmin(
  handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const result = await requireAdmin(req);
    if ('response' in result) {
      return result.response;
    }
    return handler(req, result.context);
  };
}

// =============================================================================
// REQUEST HELPERS
// =============================================================================

/**
 * Parse JSON body with error handling
 */
export async function parseBody<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Get pagination params from URL
 */
export function getPaginationParams(req: NextRequest): { page: number; pageSize: number; offset: number } {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

/**
 * Get sort params from URL
 */
export function getSortParams(req: NextRequest, defaultColumn = 'created_at', defaultDirection: 'asc' | 'desc' = 'desc'): { column: string; direction: 'asc' | 'desc' } {
  const url = new URL(req.url);
  const column = url.searchParams.get('sortBy') || defaultColumn;
  const direction = (url.searchParams.get('sortDir') || defaultDirection) as 'asc' | 'desc';
  return { column, direction };
}

/**
 * Get search query from URL
 */
export function getSearchQuery(req: NextRequest): string | null {
  const url = new URL(req.url);
  return url.searchParams.get('q') || url.searchParams.get('search') || null;
}
