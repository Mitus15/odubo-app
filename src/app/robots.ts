import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.odubostudio.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The back of house (this replaced public/robots.txt, which clashed with this route)
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}


