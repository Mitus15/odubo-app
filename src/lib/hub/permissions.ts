/**
 * The Hub - Permissions & RBAC System
 * Enterprise Business Operating System for Odubo
 */

import { executeQuery } from '@/lib/db';
import type {
  Permission,
  Module,
  ModulePermissions,
  RoleDefinition,
  UserRole,
  ResolvedPermissions,
  HubUser,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const ALL_MODULES: Module[] = [
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

const ALL_PERMISSIONS: Permission[] = [
  'read',
  'write',
  'delete',
  'admin',
  'approve',
  'export',
];

// Cache for role definitions (refresh every 5 minutes)
let roleDefinitionsCache: Map<string, RoleDefinition> | null = null;
let roleDefinitionsCacheTime = 0;
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// ROLE DEFINITIONS
// =============================================================================

/**
 * Fetch all role definitions from database
 */
export async function getRoleDefinitions(): Promise<Map<string, RoleDefinition>> {
  const now = Date.now();

  // Return cached if valid
  if (roleDefinitionsCache && now - roleDefinitionsCacheTime < ROLE_CACHE_TTL) {
    return roleDefinitionsCache;
  }

  try {
    const result = await executeQuery(
      'SELECT * FROM role_definitions ORDER BY name'
    );

    const roles = new Map<string, RoleDefinition>();
    const rows = result.result?.[0]?.results || result.results || [];

    for (const row of rows) {
      roles.set(row.slug, {
        slug: row.slug,
        name: row.name,
        description: row.description || '',
        defaultModules: JSON.parse(row.default_modules || '[]'),
        defaultPermissions: JSON.parse(row.default_permissions || '{}'),
        isSystem: Boolean(row.is_system),
        color: row.color || '#843c2d',
        icon: row.icon || 'user',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    roleDefinitionsCache = roles;
    roleDefinitionsCacheTime = now;
    return roles;
  } catch (error) {
    console.error('Failed to fetch role definitions:', error);
    // Return empty map on error
    return new Map();
  }
}

/**
 * Get a single role definition
 */
export async function getRoleDefinition(slug: string): Promise<RoleDefinition | null> {
  const roles = await getRoleDefinitions();
  return roles.get(slug) || null;
}

/**
 * Invalidate role cache (call after role updates)
 */
export function invalidateRoleCache(): void {
  roleDefinitionsCache = null;
  roleDefinitionsCacheTime = 0;
}

// =============================================================================
// USER ROLES
// =============================================================================

/**
 * Get all roles assigned to a user
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  try {
    const result = await executeQuery(
      `SELECT * FROM user_roles
       WHERE user_id = ? AND is_active = 1
       AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY assigned_at`,
      [userId]
    );

    const rows = result.result?.[0]?.results || result.results || [];
    return rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      roleSlug: row.role_slug,
      moduleOverrides: row.module_overrides ? JSON.parse(row.module_overrides) : undefined,
      permissionOverrides: row.permission_overrides ? JSON.parse(row.permission_overrides) : undefined,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      expiresAt: row.expires_at,
      isActive: Boolean(row.is_active),
      notes: row.notes,
    }));
  } catch (error) {
    console.error('Failed to fetch user roles:', error);
    return [];
  }
}

/**
 * Assign a role to a user
 */
export async function assignRole(
  userId: string,
  roleSlug: string,
  assignedBy: string,
  options?: {
    expiresAt?: string;
    notes?: string;
  }
): Promise<boolean> {
  try {
    await executeQuery(
      `INSERT INTO user_roles (user_id, role_slug, assigned_by, expires_at, notes)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, role_slug)
       DO UPDATE SET is_active = 1, assigned_by = ?, assigned_at = datetime('now'),
                     expires_at = ?, notes = ?`,
      [
        userId,
        roleSlug,
        assignedBy,
        options?.expiresAt || null,
        options?.notes || null,
        assignedBy,
        options?.expiresAt || null,
        options?.notes || null,
      ]
    );

    // Log the assignment
    await logPermissionChange(assignedBy, 'role_assigned', userId, roleSlug, {
      expiresAt: options?.expiresAt,
      notes: options?.notes,
    });

    return true;
  } catch (error) {
    console.error('Failed to assign role:', error);
    return false;
  }
}

/**
 * Remove a role from a user
 */
export async function removeRole(
  userId: string,
  roleSlug: string,
  removedBy: string
): Promise<boolean> {
  try {
    await executeQuery(
      `UPDATE user_roles SET is_active = 0 WHERE user_id = ? AND role_slug = ?`,
      [userId, roleSlug]
    );

    // Log the removal
    await logPermissionChange(removedBy, 'role_removed', userId, roleSlug, {});

    return true;
  } catch (error) {
    console.error('Failed to remove role:', error);
    return false;
  }
}

// =============================================================================
// PERMISSION RESOLUTION
// =============================================================================

/**
 * Resolve all permissions for a user based on their roles
 */
export async function resolveUserPermissions(userId: string): Promise<ResolvedPermissions> {
  const userRoles = await getUserRoles(userId);
  const roleDefinitions = await getRoleDefinitions();

  // Start with no permissions
  const resolved: ResolvedPermissions = {
    isFullAdmin: false,
    modules: {},
  };

  // If no roles, return empty permissions
  if (userRoles.length === 0) {
    return resolved;
  }

  // Merge permissions from all active roles
  for (const userRole of userRoles) {
    const roleDef = roleDefinitions.get(userRole.roleSlug);
    if (!roleDef) continue;

    // Check for full admin
    if (
      roleDef.defaultModules.includes('*' as any) ||
      (roleDef.defaultPermissions as any)['*']?.includes('admin')
    ) {
      resolved.isFullAdmin = true;
    }

    // Apply default permissions from role definition
    const defaultPerms = roleDef.defaultPermissions;

    // Handle wildcard permissions
    if ((defaultPerms as any)['*']) {
      const wildcardPerms = (defaultPerms as any)['*'] as Permission[];
      for (const module of ALL_MODULES) {
        applyPermissionsToModule(resolved.modules, module, wildcardPerms);
      }
    } else {
      // Apply specific module permissions
      for (const [module, perms] of Object.entries(defaultPerms)) {
        if (module !== '*' && ALL_MODULES.includes(module as Module)) {
          applyPermissionsToModule(resolved.modules, module as Module, perms as Permission[]);
        }
      }
    }

    // Apply any permission overrides for this specific user-role
    if (userRole.permissionOverrides) {
      for (const [module, perms] of Object.entries(userRole.permissionOverrides)) {
        if (ALL_MODULES.includes(module as Module)) {
          applyPermissionsToModule(resolved.modules, module as Module, perms as Permission[]);
        }
      }
    }
  }

  return resolved;
}

/**
 * Helper to apply permissions to a module
 */
function applyPermissionsToModule(
  modules: ResolvedPermissions['modules'],
  module: Module,
  permissions: Permission[]
): void {
  if (!modules[module]) {
    modules[module] = {
      canRead: false,
      canWrite: false,
      canDelete: false,
      canAdmin: false,
      canApprove: false,
      canExport: false,
    };
  }

  // Admin implies all permissions
  if (permissions.includes('admin')) {
    modules[module]!.canRead = true;
    modules[module]!.canWrite = true;
    modules[module]!.canDelete = true;
    modules[module]!.canAdmin = true;
    modules[module]!.canApprove = true;
    modules[module]!.canExport = true;
  } else {
    if (permissions.includes('read')) modules[module]!.canRead = true;
    if (permissions.includes('write')) modules[module]!.canWrite = true;
    if (permissions.includes('delete')) modules[module]!.canDelete = true;
    if (permissions.includes('approve')) modules[module]!.canApprove = true;
    if (permissions.includes('export')) modules[module]!.canExport = true;
  }
}

/**
 * Get list of modules a user can access
 */
export async function getUserAccessibleModules(userId: string): Promise<Module[]> {
  const permissions = await resolveUserPermissions(userId);

  if (permissions.isFullAdmin) {
    return ALL_MODULES;
  }

  return Object.entries(permissions.modules)
    .filter(([_, perms]) => perms?.canRead)
    .map(([module]) => module as Module);
}

// =============================================================================
// PERMISSION CHECKS
// =============================================================================

/**
 * Check if a user has a specific permission on a module
 */
export async function canAccess(
  userId: string,
  module: Module,
  permission: Permission
): Promise<boolean> {
  const resolved = await resolveUserPermissions(userId);

  // Full admin has all permissions
  if (resolved.isFullAdmin) {
    return true;
  }

  const modulePerms = resolved.modules[module];
  if (!modulePerms) {
    return false;
  }

  switch (permission) {
    case 'read':
      return modulePerms.canRead;
    case 'write':
      return modulePerms.canWrite;
    case 'delete':
      return modulePerms.canDelete;
    case 'admin':
      return modulePerms.canAdmin;
    case 'approve':
      return modulePerms.canApprove;
    case 'export':
      return modulePerms.canExport;
    default:
      return false;
  }
}

/**
 * Check multiple permissions at once (returns true if ALL are granted)
 */
export async function canAccessAll(
  userId: string,
  requirements: Array<{ module: Module; permission: Permission }>
): Promise<boolean> {
  const resolved = await resolveUserPermissions(userId);

  if (resolved.isFullAdmin) {
    return true;
  }

  for (const req of requirements) {
    const modulePerms = resolved.modules[req.module];
    if (!modulePerms) return false;

    const hasPermission = checkPermission(modulePerms, req.permission);
    if (!hasPermission) return false;
  }

  return true;
}

/**
 * Check multiple permissions at once (returns true if ANY are granted)
 */
export async function canAccessAny(
  userId: string,
  requirements: Array<{ module: Module; permission: Permission }>
): Promise<boolean> {
  const resolved = await resolveUserPermissions(userId);

  if (resolved.isFullAdmin) {
    return true;
  }

  for (const req of requirements) {
    const modulePerms = resolved.modules[req.module];
    if (modulePerms && checkPermission(modulePerms, req.permission)) {
      return true;
    }
  }

  return false;
}

function checkPermission(
  modulePerms: NonNullable<ResolvedPermissions['modules'][Module]>,
  permission: Permission
): boolean {
  switch (permission) {
    case 'read':
      return modulePerms.canRead;
    case 'write':
      return modulePerms.canWrite;
    case 'delete':
      return modulePerms.canDelete;
    case 'admin':
      return modulePerms.canAdmin;
    case 'approve':
      return modulePerms.canApprove;
    case 'export':
      return modulePerms.canExport;
    default:
      return false;
  }
}

// =============================================================================
// COMPLETE USER DATA
// =============================================================================

/**
 * Get complete Hub user data with permissions
 */
export async function getHubUser(userId: string): Promise<HubUser | null> {
  try {
    // Fetch user basic info
    const userResult = await executeQuery(
      `SELECT id, email, username, first_name, last_name, is_admin, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    const users = userResult.result?.[0]?.results || userResult.results || [];
    if (users.length === 0) {
      return null;
    }

    const user = users[0];
    const roles = await getUserRoles(userId);
    const permissions = await resolveUserPermissions(userId);
    const accessibleModules = await getUserAccessibleModules(userId);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      isAdmin: Boolean(user.is_admin),
      roles,
      permissions,
      accessibleModules,
      createdAt: user.created_at,
    };
  } catch (error) {
    console.error('Failed to get Hub user:', error);
    return null;
  }
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

/**
 * Log permission changes for audit trail
 */
async function logPermissionChange(
  userId: string,
  action: string,
  targetUserId: string,
  roleSlug: string,
  details: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await executeQuery(
      `INSERT INTO permission_audit_log
       (user_id, action, target_user_id, role_slug, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        targetUserId,
        roleSlug,
        JSON.stringify(details),
        ipAddress || null,
        userAgent || null,
      ]
    );
  } catch (error) {
    console.error('Failed to log permission change:', error);
    // Don't throw - logging shouldn't break the main operation
  }
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export { ALL_MODULES, ALL_PERMISSIONS };
