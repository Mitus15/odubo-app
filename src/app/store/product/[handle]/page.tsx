import { notFound } from 'next/navigation';
import ProductPageClient from './ProductPageClient';

// Define the shape of the product data
interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description?: string;
  images?: { src: string }[];
  options?: { name: string; values: string[] }[];
  variants?: { 
    id: string; 
    title: string; 
    price: string; 
    currency?: string;
    available?: boolean; 
    quantityAvailable?: number;
    image?: { src: string } | null; 
    selectedOptions?: Record<string, string> 
  }[];
}

// This function now runs on the server
async function fetchShopifyProduct(handle: string): Promise<ShopifyProduct | null> {
  try {
    // We fetch from the internal API route, which in turn calls Shopify
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/shopify/product?handle=${encodeURIComponent(handle)}`, {
      next: { revalidate: 300 } // Revalidate every 5 minutes
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// The page itself becomes an async Server Component
export default async function ProductDetailPage({ params }: { params: { handle: string } }) {
  if (!params?.handle) {
    notFound();
  }

  const product = await fetchShopifyProduct(params.handle);

  if (!product) {
    notFound();
  }

  return <ProductPageClient product={product} />;
}



