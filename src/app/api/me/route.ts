import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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

async function checkClerkAuth(): Promise<{
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    is_admin: boolean;
    role: string | null;
  };
}> {
  try {
    const authResult = auth();
    const clerkUserId = authResult.userId;

    if (!clerkUserId) {
      return { authenticated: false };
    }

    const { user } = authResult;
    const email = user?.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      return { authenticated: true };
    }

    let dbUser = null;
    try {
      dbUser = await getUserByEmail(email);
    } catch (err) {
      console.error('[api/me] Error looking up DB user:', err);
    }

    const isAdmin = dbUser?.is_admin === true || dbUser?.is_admin === 1 || isEmailInAdminList(email);

    return {
      authenticated: true,
      user: {
        id: clerkUserId,
        email,
        firstName: user?.firstName || dbUser?.first_name || null,
        lastName: user?.lastName || dbUser?.last_name || null,
        is_admin: isAdmin,
        role: isAdmin ? 'admin' : null,
      },
    };
  } catch (err) {
    console.error('[api/me] Clerk auth check error:', err);
    return { authenticated: false };
  }
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

  const clerkAuth = await checkClerkAuth();
  if (clerkAuth.authenticated) {
    return NextResponse.json({
      authenticated: true,
      user: clerkAuth.user,
    });
  }

  return NextResponse.json({ authenticated: false }, { status: 200 });
}
