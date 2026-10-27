import { MetadataRoute } from 'next';
import { getShopifyProducts } from '@/lib/shopify';
import { getLevels } from '@/lib/levelsServer';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.odubostudio.com';
  const currentDate = new Date().toISOString();

  // The rooms: the title screen, the levels, the gear, the music. The old surfaces (/store, /media,
  // /moments, /contact) are left out, and the small print is noindexed, so it is not listed either.
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: currentDate, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/levels`, lastModified: currentDate, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/gear`, lastModified: currentDate, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/music`, lastModified: currentDate, changeFrequency: 'monthly', priority: 0.7 },
  ];

  // Each level's own room
  const levelPages: MetadataRoute.Sitemap = (await getLevels().catch(() => [])).map((level) => ({
    url: `${baseUrl}/levels/${level.id}`,
    lastModified: level.outAt || currentDate,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Fetch dynamic product pages from Shopify
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const productsResult = await getShopifyProducts();
    if (productsResult.success && productsResult.products) {
      productPages = productsResult.products
        .filter(product => product.status === 'active')
        .map(product => ({
          url: `${baseUrl}/store/product/${product.handle}`,
          lastModified: product.createdAt || currentDate,
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }));
    }
  } catch (error) {
    console.error('[SITEMAP] Error fetching products:', error);
  }

  // Combine all pages
  return [
    ...staticPages,
    ...levelPages,
    ...productPages,
  ];
}
