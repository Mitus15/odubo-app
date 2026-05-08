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
  '/api/moments(.*)',
  '/api/clips(.*)',
  '/api/videos(.*)',
  '/api/tracks(.*)',
  '/api/albums(.*)',
  '/api/products(.*)',
  '/api/galleries(.*)',
  '/api/linktree(.*)',
  '/bclc-playnow',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

/**
 * Clerk middleware - auth protection
 */
const clerkHandler = clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

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
      return NextResponse.next();
    }

    if (url.pathname.startsWith('/admin')) {
      return NextResponse.next();
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
      return NextResponse.next();
    }

    if (url.pathname.startsWith('/moments')) {
      return NextResponse.next();
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

export default function middleware(request: NextRequest) {
  // First handle Clerk auth
  const clerkResponse = clerkHandler(request);
  
  // If Clerk returned a response (redirect, rewrite, etc.), return it
  if (clerkResponse) {
    return clerkResponse;
  }
  
  // Then handle subdomain routing
  const subdomainResponse = handleSubdomainRouting(request);
  if (subdomainResponse) {
    return subdomainResponse;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/).*)',
    '/(api|trpc)(.*)',
  ],
};
