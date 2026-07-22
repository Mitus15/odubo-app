import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COUNTRY_COOKIE, normalizeCountry } from '@/lib/store/money';
import { VOTER_COOKIE, verifyVoter, mintVoter } from '@/lib/loop/anthem-identity';
import { ADMIN_COOKIE as LOOP_ADMIN_COOKIE, verifyAdminSession as verifyLoopAdminSession } from '@/lib/loop/admin-auth';

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
 * Loop Soul surface (/loop, /api/loop) — two jobs, both STRICTLY scoped to
 * loop paths so they can never touch odubo's own /admin or its visitors:
 *
 *  1. Admin gate — /loop/admin and /api/loop/admin/* require a valid signed
 *     `ls_admin` session (login page/route excepted). Pages redirect to the
 *     login; API routes get a 401.
 *  2. Voter identity — every /loop visitor carries a signed anonymous voter id
 *     (`ls_voter`) so route handlers can just READ it. Minted here on both the
 *     forwarded request (same render sees it) and the response (browser keeps it).
 *
 * Returns null for non-loop paths so odubo's flow is untouched.
 */
async function handleLoopSoul(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  const isLoopPage = pathname === '/loop' || pathname.startsWith('/loop/');
  const isLoopApi = pathname.startsWith('/api/loop/');
  if (!isLoopPage && !isLoopApi) return null;

  // 1) Admin gate — skip the login page/route so users can actually sign in.
  const isAdminArea =
    pathname.startsWith('/loop/admin') || pathname.startsWith('/api/loop/admin');
  const isLogin = pathname === '/loop/admin/login' || pathname === '/api/loop/admin/login';
  if (isAdminArea && !isLogin) {
    const ok = await verifyLoopAdminSession(request.cookies.get(LOOP_ADMIN_COOKIE)?.value);
    if (!ok) {
      if (isLoopApi) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/loop/admin/login';
      url.search = `?from=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  // 2) Voter identity.
  const existing = request.cookies.get(VOTER_COOKIE)?.value;
  const valid = await verifyVoter(existing);
  if (valid) return NextResponse.next();

  const { token } = await mintVoter();

  // Make the new identity visible to the current render…
  const requestHeaders = new Headers(request.headers);
  request.cookies.set(VOTER_COOKIE, token);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // …and persist it on the browser. Cookie path stays '/' (a '/loop' path
  // would exclude /api/loop/*), but MINTING is loop-scoped above — a visitor
  // who never opens /loop never receives a Loop Soul identity.
  res.cookies.set(VOTER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180, // ~180 days
  });
  return res;
}

/**
 * Middleware - subdomain routing + Loop Soul surface
 * Clerk has been removed in favor of JWT-based auth for admin
 */
export default async function middleware(request: NextRequest) {
  const response =
    (await handleLoopSoul(request)) ??
    handleSubdomainRouting(request) ??
    NextResponse.next();

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
