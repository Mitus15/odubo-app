import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/auth';
import { queryDatabase, executeQuery } from '@/lib/db';

export const runtime = 'edge';

interface RoleWithDetails {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
  role_name: string;
  role_display_name: string;
  role_color: string;
  role_sections: string;
}

/**
 * GET /api/admin/user-roles?user_id=xxx
 * Get roles for a specific user
 */
export async function GET(request: NextRequest) {
  try {
    // Verify requester is admin
    const requester = getUserFromRequest(request);
    if (!isAdminUser(requester)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const results = await queryDatabase<RoleWithDetails>(
      `SELECT
        aur.id, aur.user_id, aur.role_id, aur.assigned_by, aur.assigned_at,
        ar.name as role_name, ar.display_name as role_display_name,
        ar.color as role_color, ar.sections as role_sections
      FROM admin_user_roles aur
      JOIN admin_roles ar ON aur.role_id = ar.id
      WHERE aur.user_id = ?
      ORDER BY ar.display_name ASC`,
      [userId]
    );

    const roles = results.map((r: RoleWithDetails) => ({
      id: r.id,
      role_id: r.role_id,
      name: r.role_name,
      display_name: r.role_display_name,
      color: r.role_color,
      sections: JSON.parse(r.role_sections) as string[],
      assigned_at: r.assigned_at,
    }));

    return NextResponse.json({ user_id: userId, roles });
  } catch (error) {
    console.error('[User Roles] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user roles', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/user-roles
 * Assign a role to a user
 * Body: { user_id, role_id }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify requester is admin
    const requester = getUserFromRequest(request);
    if (!isAdminUser(requester)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { user_id?: string; role_id?: string };
    const { user_id, role_id } = body;

    if (!user_id || !role_id) {
      return NextResponse.json({ error: 'user_id and role_id are required' }, { status: 400 });
    }

    // Check if role exists
    const existingRoles = await queryDatabase<{ id: string }>(
      'SELECT id FROM admin_roles WHERE id = ?',
      [role_id]
    );

    if (existingRoles.length === 0) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Insert (or ignore if already exists)
    await executeQuery(
      `INSERT OR IGNORE INTO admin_user_roles (user_id, role_id, assigned_by)
       VALUES (?, ?, ?)`,
      [user_id, role_id, requester?.userId || null]
    );

    return NextResponse.json({ success: true, user_id, role_id });
  } catch (error) {
    console.error('[User Roles] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to assign role', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/user-roles
 * Remove a role from a user
 * Body: { user_id, role_id }
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify requester is admin
    const requester = getUserFromRequest(request);
    if (!isAdminUser(requester)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { user_id?: string; role_id?: string };
    const { user_id, role_id } = body;

    if (!user_id || !role_id) {
      return NextResponse.json({ error: 'user_id and role_id are required' }, { status: 400 });
    }

    // Prevent removing your own admin role
    if (user_id === requester?.userId && role_id === 'role_admin') {
      return NextResponse.json({ error: 'Cannot remove your own admin role' }, { status: 400 });
    }

    await executeQuery(
      'DELETE FROM admin_user_roles WHERE user_id = ? AND role_id = ?',
      [user_id, role_id]
    );

    return NextResponse.json({ success: true, user_id, role_id });
  } catch (error) {
    console.error('[User Roles] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove role', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
