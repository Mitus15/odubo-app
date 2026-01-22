import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase } from '@/lib/db';

export const runtime = 'edge';

// Map child sections to their parent sections
const SECTION_PARENT_MAP: Record<string, string> = {
  // CMS
  'music-library': 'cms',
  'video-library': 'cms',
  'moments': 'cms',
  'featured': 'cms',
  'linktree': 'cms',
  'live': 'cms',
  // Social
  'social-posts': 'social',
  'social-accounts': 'social',
  'social-analytics': 'social',
  // Commerce
  'products': 'commerce',
  'orders': 'commerce',
  'customers': 'commerce',
  'discounts': 'commerce',
  'store-settings': 'commerce',
  // Marketing
  'campaigns': 'marketing',
  // Analytics
  'analytics-overview': 'analytics',
  'analytics-music': 'analytics',
  'analytics-video': 'analytics',
  'analytics-moments': 'analytics',
  'analytics-customers': 'analytics',
  'analytics-reports': 'analytics',
  // System
  'users': 'system',
  'database': 'system',
  'storage': 'system',
  'api-keys': 'system',
};

interface RoleRow {
  sections: string;
  name: string;
  display_name: string;
}

/**
 * GET /api/admin/permissions
 * Get current user's accessible sections based on their roles
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      console.log('[Permissions] No user found in request. Headers:', Object.fromEntries(request.headers.entries()));
      const cookieToken = request.cookies.get('token');
      console.log('[Permissions] Cookie token exists:', !!cookieToken, 'Value length:', cookieToken?.value?.length || 0);
      return NextResponse.json({ error: 'Unauthorized - No valid token found' }, { status: 401 });
    }

    // Legacy admin check - if is_admin is true, grant full access
    if (isAdminUser(user)) {
      return NextResponse.json({
        sections: ['*'],
        isAdmin: true,
        roles: [{ name: 'admin', display_name: 'Admin' }],
      });
    }

    // Get all roles for this user
    const userRoles = await queryDatabase<RoleRow>(
      `SELECT ar.sections, ar.name, ar.display_name
       FROM admin_user_roles aur
       JOIN admin_roles ar ON aur.role_id = ar.id
       WHERE aur.user_id = ?`,
      [user.userId]
    );

    if (userRoles.length === 0) {
      // No roles assigned - no access
      return NextResponse.json({
        sections: [],
        isAdmin: false,
        roles: [],
      });
    }

    // Combine sections from all roles
    const sectionsSet = new Set<string>();
    let isAdmin = false;

    for (const role of userRoles) {
      const roleSections = JSON.parse(role.sections) as string[];
      if (roleSections.includes('*')) {
        isAdmin = true;
        break;
      }
      roleSections.forEach(s => sectionsSet.add(s));
    }

    const sections = isAdmin ? ['*'] : Array.from(sectionsSet);
    const roles = userRoles.map((r: RoleRow) => ({ name: r.name, display_name: r.display_name }));

    return NextResponse.json({ sections, isAdmin, roles });
  } catch (error) {
    console.error('[Permissions] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to check if user can access a specific section
 * Exported for use in other API routes if needed
 */
export function canAccessSection(accessibleSections: string[], sectionId: string): boolean {
  // Full admin access
  if (accessibleSections.includes('*')) return true;

  // Direct match
  if (accessibleSections.includes(sectionId)) return true;

  // Check parent section
  const parent = SECTION_PARENT_MAP[sectionId];
  if (parent && accessibleSections.includes(parent)) return true;

  return false;
}
