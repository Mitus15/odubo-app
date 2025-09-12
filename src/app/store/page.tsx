import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';
import Link from 'next/link';
import StorePageClient from './StorePageClient';

// Temporary storefront gate – keeps all logic intact but shows a placeholder
const STORE_OPEN = false;

interface ProductCard {
  id: string;
  title: string;
  handle: string;
  image: string | null;
  price: string | null;
}

// Server-side product fetching function
async function loadProducts(type: 'clothes' | 'items'): Promise<ProductCard[]> {
  try {
  // Resolve a robust base URL so server-side renders use the current host when possible
  const getBaseUrl = (await import('@/lib/getBaseUrl')).default;
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/shopify/collections?type=${type}`, { 
      next: { revalidate: 300 } // Revalidate every 5 minutes
    });
    if (!res.ok) {
      throw new Error(`Load failed: ${res.status}`);
    }
    const data = await res.json() as { products: ProductCard[] };
    return data.products || [];
  } catch (e) {
    console.error('Failed to load products:', e);
    return [];
  }
}

export default async function StorePage() {
  if (!STORE_OPEN) {
    return <StorePageClient isStoreOpen={false} initialProducts={[]} />;
  }

  // Fetch initial products on the server
  const initialProducts = await loadProducts('clothes');

  return <StorePageClient isStoreOpen={true} initialProducts={initialProducts} />;
}
