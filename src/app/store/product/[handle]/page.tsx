import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ProductPageClient from './ProductPageClient';
import { getShopifyProduct } from '@/lib/shopify';
import { requireStoreAccess } from '@/lib/storeAccess';
import { generateProductMetadata } from '@/lib/seo';

// Generate SEO metadata for product pages
export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const res = await getShopifyProduct(handle);

  if (!res.success || !res.product) {
    return { title: 'Product Not Found | Odubo Studio' };
  }

  const product = res.product;
  return generateProductMetadata({
    title: product.title,
    description: product.description || `Shop ${product.title} at Odubo Studio`,
    handle: product.handle,
    image: product.images[0],
    price: String(product.price),
    currency: 'USD',
  });
}

// This function now runs on the server
async function fetchProduct(handle: string) {
  const res = await getShopifyProduct(handle);
  if (!res.success || !res.product) return null;
  
  const p = res.product;
  
  // Map to the shape expected by ProductPageClient
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description,
    images: p.images.map(url => ({ src: url })),
    options: (p as any).options || [],
    variants: p.variants.map((v: any) => ({
      id: v.id,
      title: v.title,
      price: String(v.price),
      currency: v.currency,
      available: v.available,
      quantityAvailable: v.quantityAvailable,
      image: v.image,
      selectedOptions: v.selectedOptions
    }))
  };
}

// Generate JSON-LD structured data for Google Shopping
function generateProductJsonLd(product: NonNullable<Awaited<ReturnType<typeof fetchProduct>>>) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://odubo.studio';
  const price = product.variants[0]?.price || '0';
  const currency = product.variants[0]?.currency || 'USD';
  const isAvailable = product.variants.some(v => v.available);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description || `Shop ${product.title} at Odubo Studio`,
    image: product.images.map(img => img.src),
    url: `${baseUrl}/store/product/${product.handle}`,
    brand: {
      '@type': 'Brand',
      name: 'Odubo',
    },
    offers: {
      '@type': 'Offer',
      price: price,
      priceCurrency: currency,
      availability: isAvailable
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${baseUrl}/store/product/${product.handle}`,
      seller: {
        '@type': 'Organization',
        name: 'Odubo Studio',
      },
    },
  };
}

// The page itself becomes an async Server Component
export default async function ProductDetailPage({ params }: { params: { handle: string } }) {
  // Check store access - redirects non-admins when unpublished
  await requireStoreAccess();

  // Await params for Next.js 15+
  const { handle } = await params;

  if (!handle) {
    notFound();
  }

  const product = await fetchProduct(handle);

  if (!product) {
    notFound();
  }

  // Generate JSON-LD for structured data
  const jsonLd = generateProductJsonLd(product);

  return (
    <>
      {/* JSON-LD Structured Data for Google Shopping */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductPageClient product={product} />
    </>
  );
}



