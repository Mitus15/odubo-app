import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COUNTRY_COOKIE, normalizeCountry } from '@/lib/store/money';

/**
 * Subdomain routing
 * - admin.odubo.studio → serves /admin routes at root
 * - moments.odubo.studio → serves /moments routes at root
 * - odubo.studio/admin → redirects to admin.odubo.studio
 * - odubo.studio/moments → redirects to moments.odubo.studio
 */
function handleSubdomainRouting(request: NextRequest): NextResponse | null {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  const isAdminSubdomain = hostname.startsWith('admin.');
  const isMomentsSubdomain = hostname.startsWith('moments.');
  const isProduction = hostname.includes('odubo.studio');

  if (isAdminSubdomain) {
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/_next/') ||
      url.pathname.startsWith('/static/') ||
      url.pathname.includes('.')
    ) {
      return null;
    }

    if (
      url.pathname.startsWith('/login') ||
      url.pathname.startsWith('/reset-password')
    ) {
      if (isProduction) {
        const loginUrl = new URL(url.pathname, `https://odubo.studio`);
        loginUrl.search = url.search;
        return NextResponse.redirect(loginUrl);
      }
      return null;
    }

    if (url.pathname.startsWith('/admin')) {
      return null;
    }

    url.pathname = `/admin${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isMomentsSubdomain) {
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/_next/') ||
      url.pathname.startsWith('/static/') ||
      url.pathname.includes('.')
    ) {
      return null;
    }

    if (url.pathname.startsWith('/moments')) {
      return null;
    }

    url.pathname = `/moments${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isProduction && url.pathname.startsWith('/admin')) {
    const adminPath = url.pathname.replace(/^\/admin/, '') || '/';
    const adminUrl = new URL(adminPath, `https://admin.odubo.studio`);
    adminUrl.search = url.search;
    return NextResponse.redirect(adminUrl);
  }

  if (isProduction && url.pathname.startsWith('/moments')) {
    const momentsPath = url.pathname.replace(/^\/moments/, '') || '/';
    const momentsUrl = new URL(momentsPath, `https://moments.odubo.studio`);
    momentsUrl.search = url.search;
    return NextResponse.redirect(momentsUrl);
  }

  return null;
}

/**
 * Middleware - subdomain routing only
 * Clerk has been removed in favor of JWT-based auth for admin
 */
export default function middleware(request: NextRequest) {
  const response = handleSubdomainRouting(request) ?? NextResponse.next();

  // Carry the visitor's geo-detected country to the client so the store can
  // localize currency (Shopify Markets). Vercel injects x-vercel-ip-country.
  const country = normalizeCountry(request.headers.get('x-vercel-ip-country'));
  if (request.cookies.get(COUNTRY_COOKIE)?.value !== country) {
    response.cookies.set(COUNTRY_COOKIE, country, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    });
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/).*)',
    '/(api|trpc)(.*)',
  ],
};
