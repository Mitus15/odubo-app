import { notFound } from 'next/navigation';
import ProductPageClient from './ProductPageClient';
import { getShopifyProduct } from '@/lib/shopify';

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

// The page itself becomes an async Server Component
export default async function ProductDetailPage({ params }: { params: { handle: string } }) {
  // Await params for Next.js 15+
  const { handle } = await params;
  
  if (!handle) {
    notFound();
  }

  const product = await fetchProduct(handle);

  if (!product) {
    notFound();
  }

  return <ProductPageClient product={product} />;
}



