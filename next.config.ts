import type { NextConfig } from "next";

// No setupDevPlatform(): that emulated Cloudflare *bindings* for a Pages
// deploy we no longer do. Nothing reads bindings — D1 is reached over HTTP via
// DATABASE_URL (src/lib/db.ts), R2 over the S3 API — so it only cost every
// `next dev` a workerd boot. Cloudflare itself stays: D1, R2 and Stream are
// still the data layer, and wrangler still runs migrations.

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow LAN/mobile devices to access dev assets under /_next/*
  // This silences the Next.js warning and is safe for development only.
  // If your LAN IP changes, update the list below.
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.1.68:3000',
    'http://moments.localhost:3000',
    'http://admin.localhost:3000',
  ],
  // Bundle the daily-verse data file into serverless functions that read it at
  // runtime (bible-verse.ts uses fs.readFileSync); without this Vercel omits it.
  outputFileTracingIncludes: {
    '/**': ['./data/bible-psalms-proverbs.json'],
  },
  images: {
    // Enable Next.js Image Optimization (remove unoptimized: true)
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 24, 32, 48, 64, 96, 128, 256],
    // Allow our own brand SVGs to render through next/image. Safe here because
    // we only serve trusted first-party SVGs from /public; attachment + sandbox
    // CSP neutralize any inline script if an untrusted SVG ever slips in.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.odubo.studio',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'videodelivery.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'customer-tpkm273r1u0s40no.cloudflarestream.com',
        port: '',
        pathname: '/**',
      },
      // Wildcards are not supported in hostname; add explicit pattern for your account if needed
    ],
  },
  serverExternalPackages: ['@aws-sdk/client-s3'],
  // Increase body size limits for video uploads
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          // Basic CSP; adjust as needed
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; media-src 'self' https: blob:; worker-src 'self' blob:; frame-src https://iframe.videodelivery.net https://customer-tpkm273r1u0s40no.cloudflarestream.com; connect-src 'self' https: http: ws: wss:;" },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/clips-sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/site.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
      {
        source: '/admin.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
      // Cache images and fonts for 1 year
      {
        source: '/:path*.(ico|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Cache API responses briefly for offline support
      {
        source: '/api/clips',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
      {
        source: '/api/media/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' },
        ],
      },
      {
        source: '/api/videos/upload',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
