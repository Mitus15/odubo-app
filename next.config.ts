import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow LAN/mobile devices to access dev assets under /_next/*
  // This silences the Next.js warning and is safe for development only.
  // If your LAN IP changes, update the list below.
  allowedDevOrigins: [
    'http://192.168.1.68:3001',
    'http://192.168.1.68:3000',
    'http://192.168.3.92:3000',
    'http://192.168.3.92:3001',
    'http://localhost:3000',
    'http://10.50.78.202:3000',
  ],
  images: {
    // Enable Next.js Image Optimization (remove unoptimized: true)
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 24, 32, 48, 64, 96, 128, 256],
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
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; media-src 'self' https: blob:; worker-src 'self' blob:; frame-src https://iframe.videodelivery.net; connect-src 'self' https: http: ws: wss:;" },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
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
