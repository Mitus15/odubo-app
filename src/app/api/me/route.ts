import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, getUserRoleFromRequest, isAdminUser } from '@/lib/auth';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const role = await getUserRoleFromRequest(req);
  const isAdmin = isAdminUser(user);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.userId,
      email: user.email,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      is_admin: isAdmin,
      role: role,
    },
  });
}
