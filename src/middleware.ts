import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for subdomain routing
 * - admin.odubo.studio → serves /admin routes at root
 * - odubo.studio/admin → redirects to admin.odubo.studio
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // Check if this is the admin subdomain
  const isAdminSubdomain = hostname.startsWith('admin.');

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

  // On main domain: optionally redirect /admin to admin subdomain
  if (isProduction && url.pathname.startsWith('/admin')) {
    // Redirect odubo.studio/admin/* to admin.odubo.studio/*
    const adminPath = url.pathname.replace(/^\/admin/, '') || '/';
    const adminUrl = new URL(adminPath, `https://admin.odubo.studio`);
    adminUrl.search = url.search;
    return NextResponse.redirect(adminUrl);
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
