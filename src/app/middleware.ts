import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/auth';

const protectedRoutes = ['/account'];
const adminRoutes = ['/admin'];
const getSecret = () => new TextEncoder().encode(getJwtSecret());

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for protected routes (logged-in users only)
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Check for admin routes (admin users only)
    if (adminRoutes.some(route => pathname.startsWith(route))) {
      try {
        const { payload } = await jwtVerify(token, getSecret());
        const isAdmin = (payload as any).is_admin;
        if (!isAdmin) {
          const homeUrl = new URL('/', request.url);
          return NextResponse.redirect(homeUrl); // Redirect non-admins from admin pages
        }
      } catch (error) {
        console.error("Middleware authentication error:", error);
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl); // Invalid token, redirect to login
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/account/:path*', '/admin/:path*'],
};
