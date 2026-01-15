import { MetadataRoute } from 'next';
import { getShopifyProducts } from '@/lib/shopify';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://odubo.studio';
  const currentDate = new Date().toISOString();

  // Static pages - core site structure
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/store`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/music`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/media`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/moments`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/links`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/legal`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

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
    ...productPages,
  ];
}
