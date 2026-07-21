import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, getUserRoleFromRequest, isAdminUser } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db';

export const runtime = 'edge';

function isEmailInAdminList(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (user) {
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

  return NextResponse.json({ authenticated: false }, { status: 200 });
}
