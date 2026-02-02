import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for subdomain routing
 * - admin.odubo.studio → serves /admin routes at root
 * - moments.odubo.studio → serves /moments routes at root
 * - odubo.studio/admin → redirects to admin.odubo.studio
 * - odubo.studio/moments → redirects to moments.odubo.studio
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // Check subdomains
  const isAdminSubdomain = hostname.startsWith('admin.');
  const isMomentsSubdomain = hostname.startsWith('moments.');

  // Production domains
  const isProduction = hostname.includes('odubo.studio');

  if (isAdminSubdomain) {
    // On admin subdomain: rewrite root paths to /admin
    // admin.odubo.studio/ → /admin
    // admin.odubo.studio/social → /admin/social

    // Don't rewrite API routes, static files, or _next
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/_next/') ||
      url.pathname.startsWith('/static/') ||
      url.pathname.includes('.')
    ) {
      return NextResponse.next();
    }

    // If already accessing /admin path, strip it to avoid /admin/admin
    if (url.pathname.startsWith('/admin')) {
      return NextResponse.next();
    }

    // Rewrite to /admin prefix
    url.pathname = `/admin${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isMomentsSubdomain) {
    // On moments subdomain: rewrite root paths to /moments
    // moments.odubo.studio/ → /moments
    // moments.odubo.studio/capture → /moments/capture

    // Don't rewrite API routes, static files, or _next
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/_next/') ||
      url.pathname.startsWith('/static/') ||
      url.pathname.includes('.')
    ) {
      return NextResponse.next();
    }

    // If already accessing /moments path, strip it to avoid /moments/moments
    if (url.pathname.startsWith('/moments')) {
      return NextResponse.next();
    }

    // Rewrite to /moments prefix
    url.pathname = `/moments${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // On main domain: redirect /admin and /moments to their subdomains
  if (isProduction && url.pathname.startsWith('/admin')) {
    // Redirect odubo.studio/admin/* to admin.odubo.studio/*
    const adminPath = url.pathname.replace(/^\/admin/, '') || '/';
    const adminUrl = new URL(adminPath, `https://admin.odubo.studio`);
    adminUrl.search = url.search;
    return NextResponse.redirect(adminUrl);
  }

  if (isProduction && url.pathname.startsWith('/moments')) {
    // Redirect odubo.studio/moments/* to moments.odubo.studio/*
    const momentsPath = url.pathname.replace(/^\/moments/, '') || '/';
    const momentsUrl = new URL(momentsPath, `https://moments.odubo.studio`);
    momentsUrl.search = url.search;
    return NextResponse.redirect(momentsUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/).*)',
  ],
};
