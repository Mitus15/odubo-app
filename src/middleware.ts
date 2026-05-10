import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/about',
  '/showcase',
  '/docs(.*)',
  '/rsvp(.*)',
  '/moments(.*)',
  '/store(.*)',
  '/music(.*)',
  '/media(.*)',
  '/clips(.*)',
  '/links(.*)',
  '/watch(.*)',
  '/game(.*)',
  '/featured(.*)',
  '/legal(.*)',
  '/contact(.*)',
  '/bclc-playnow',
  '/login(.*)',
  '/reset-password(.*)',
  '/admin(.*)',
  '/api/moments(.*)',
  '/api/clips(.*)',
  '/api/videos(.*)',
  '/api/tracks(.*)',
  '/api/albums(.*)',
  '/api/products(.*)',
  '/api/galleries(.*)',
  '/api/linktree(.*)',
  '/api/users(.*)',
  '/api/auth(.*)',
  '/api/admin(.*)',
  '/api/webhooks(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

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
 * Clerk v7 middleware - auth protection + subdomain routing
 * In Clerk v7, clerkMiddleware() must be exported directly.
 * All custom logic must go inside the callback.
 */
export default clerkMiddleware(async (auth, req) => {
  const subdomainResponse = handleSubdomainRouting(req);
  if (subdomainResponse) {
    return subdomainResponse;
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/).*)',
    '/(api|trpc)(.*)',
  ],
};
