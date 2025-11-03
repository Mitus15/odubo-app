import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/auth';

const protectedRoutes = ['/account'];
const adminRoutes = ['/admin'];
const getSecret = () => new TextEncoder().encode(getJwtSecret());

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Temporary redirect: /music -> /featured until 2025-11-15 (UTC)
  try {
    const cutoff = Date.parse('2025-11-15T00:00:00Z');
    if (Date.now() < cutoff) {
      // Option A (recommended): QR code adds a flag, e.g. /music?qr=1 or /music?utm_source=qr
      const url = new URL(request.url);
      const viaQr = url.searchParams.get('qr') === '1' || url.searchParams.get('utm_source') === 'qr';

      // Option B: dedicated QR path /music/qr that always redirects during the window
      if ((pathname === '/music' && viaQr) || pathname === '/music/qr') {
        // First-visit only: set a cookie so subsequent visits are not redirected
        const seenCookie = request.cookies.get('odubo_music_seen')?.value === '1';
        if (!seenCookie) {
          const to = new URL('/featured', request.url);
          const res = NextResponse.redirect(to, { status: 302 });
          const maxAge = Math.max(1, Math.floor((cutoff - Date.now()) / 1000));
          res.cookies.set('odubo_music_seen', '1', { path: '/', sameSite: 'lax', maxAge });
          return res;
        }
        return NextResponse.next();
      }

      // Option C (fallback if QR already points to /music without params):
      // Heuristic — redirect when request likely came from a QR scan:
      // - No same-origin referrer (direct/open-in-browser)
      // - Mobile user agent (iOS/Android)
      // This avoids redirecting internal navigation clicks.
      if (pathname === '/music') {
        const referer = request.headers.get('referer') || '';
        const origin = url.origin;
        const sameOriginRef = referer.startsWith(origin);
        const ua = request.headers.get('user-agent') || '';
        const isMobile = /iPhone|Android|Mobile/i.test(ua);
        if (!sameOriginRef && isMobile) {
          const seenCookie = request.cookies.get('odubo_music_seen')?.value === '1';
          if (!seenCookie) {
            const to = new URL('/featured', request.url);
            const res = NextResponse.redirect(to, { status: 302 });
            const maxAge = Math.max(1, Math.floor((cutoff - Date.now()) / 1000));
            res.cookies.set('odubo_music_seen', '1', { path: '/', sameSite: 'lax', maxAge });
            return res;
          }
          return NextResponse.next();
        }
      }
    }
  } catch {}

  // end temporary redirect logic

  // Admin routes: require auth and admin role/flag
  if (adminRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const isAdmin = (payload as any).is_admin;
      const role = (payload as any).role;
      if (!(isAdmin || role === 'admin')) {
        const homeUrl = new URL('/', request.url);
        return NextResponse.redirect(homeUrl);
      }
    } catch (error) {
      console.error('Middleware authentication error:', error);
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Other protected routes (logged-in users only)
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/account/:path*', '/admin/:path*', '/music', '/music/qr'],
};
