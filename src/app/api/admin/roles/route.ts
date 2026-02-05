import { NextResponse, NextRequest } from 'next/server';
import { queryDatabase } from '@/lib/db';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'edge';

interface AdminRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  sections: string;
  color: string;
  is_system: number;
  created_at: string;
}

/**
 * GET /api/admin/roles
 * List all available admin roles
 */
export async function GET(req: NextRequest) {
  // Require authentication - only admins can view roles
  const user = getUserFromRequest(req);
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }
  try {
    const results = await queryDatabase<AdminRole>(
      'SELECT * FROM admin_roles ORDER BY is_system DESC, display_name ASC'
    );

    const roles = results.map((role: AdminRole) => ({
      ...role,
      sections: JSON.parse(role.sections) as string[],
      is_system: role.is_system === 1,
    }));

    return NextResponse.json({ roles });
  } catch (error) {
    console.error('[Admin Roles] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
