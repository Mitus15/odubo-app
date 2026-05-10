import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { getUserByEmail, queryDatabase } from '@/lib/db';

export const runtime = 'edge';

const SECTION_PARENT_MAP: Record<string, string> = {
  'music-library': 'cms',
  'video-library': 'cms',
  'moments': 'cms',
  'featured': 'cms',
  'linktree': 'cms',
  'live': 'cms',
  'social-posts': 'social',
  'social-accounts': 'social',
  'social-analytics': 'social',
  'products': 'commerce',
  'orders': 'commerce',
  'customers': 'commerce',
  'discounts': 'commerce',
  'store-settings': 'commerce',
  'campaigns': 'marketing',
  'analytics-overview': 'analytics',
  'analytics-music': 'analytics',
  'analytics-video': 'analytics',
  'analytics-moments': 'analytics',
  'analytics-customers': 'analytics',
  'analytics-reports': 'analytics',
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

function isEmailInAdminList(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

async function checkClerkAuth(): Promise<{
  isAuthenticated: boolean;
  isAdmin: boolean;
  email?: string;
  dbUserId?: string;
}> {
  try {
    const authResult = await auth();
    const clerkUserId = authResult.userId;

    if (!clerkUserId) {
      return { isAuthenticated: false, isAdmin: false };
    }

    const { user } = authResult;
    const email = user?.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      return { isAuthenticated: true, isAdmin: false };
    }

    if (isEmailInAdminList(email)) {
      return { isAuthenticated: true, isAdmin: true, email };
    }

    let dbUser = null;
    try {
      dbUser = await getUserByEmail(email);
    } catch (err) {
      console.error('[Permissions] Error looking up DB user by email:', err);
    }

    if (dbUser?.is_admin === true || dbUser?.is_admin === 1) {
      return { isAuthenticated: true, isAdmin: true, email, dbUserId: dbUser.id };
    }

    return {
      isAuthenticated: true,
      isAdmin: false,
      email,
      dbUserId: dbUser?.id,
    };
  } catch (err) {
    console.error('[Permissions] Clerk auth check error:', err);
    return { isAuthenticated: false, isAdmin: false };
  }
}

export async function GET(request: NextRequest) {
  try {
    const legacyUser = getUserFromRequest(request);

    if (legacyUser) {
      if (isAdminUser(legacyUser)) {
        return NextResponse.json({
          sections: ['*'],
          isAdmin: true,
          roles: [{ name: 'admin', display_name: 'Admin' }],
        });
      }

      const userRoles = await queryDatabase<RoleRow>(
        `SELECT ar.sections, ar.name, ar.display_name
         FROM admin_user_roles aur
         JOIN admin_roles ar ON aur.role_id = ar.id
         WHERE aur.user_id = ?`,
        [legacyUser.userId]
      );

      if (userRoles.length === 0) {
        return NextResponse.json({
          sections: [],
          isAdmin: false,
          roles: [],
        });
      }

      let isAdmin = false;
      const sectionsSet = new Set<string>();

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
    }

    const clerkAuth = await checkClerkAuth();

    if (clerkAuth.isAuthenticated && clerkAuth.isAdmin) {
      return NextResponse.json({
        sections: ['*'],
        isAdmin: true,
        roles: [{ name: 'admin', display_name: 'Admin' }],
      });
    }

    if (clerkAuth.dbUserId) {
      const userRoles = await queryDatabase<RoleRow>(
        `SELECT ar.sections, ar.name, ar.display_name
         FROM admin_user_roles aur
         JOIN admin_roles ar ON aur.role_id = ar.id
         WHERE aur.user_id = ?`,
        [clerkAuth.dbUserId]
      );

      if (userRoles.length > 0) {
        let isAdmin = false;
        const sectionsSet = new Set<string>();

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
      }
    }

    return NextResponse.json({
      sections: [],
      isAdmin: false,
      roles: [],
    });
  } catch (error) {
    console.error('[Permissions] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export function canAccessSection(accessibleSections: string[], sectionId: string): boolean {
  if (accessibleSections.includes('*')) return true;
  if (accessibleSections.includes(sectionId)) return true;
  const parent = SECTION_PARENT_MAP[sectionId];
  if (parent && accessibleSections.includes(parent)) return true;
  return false;
}
