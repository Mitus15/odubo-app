import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';
import Link from 'next/link';
import StorePageClient from './StorePageClient';
import { getShopifyProducts } from '@/lib/shopify';

// Temporary storefront gate – keeps all logic intact but shows a placeholder
const STORE_OPEN = true;

interface ProductCard {
  id: string;
  title: string;
  handle: string;
  image: string | null;
  price: number | null;
  available: boolean;
  createdAt: string;
}

// Server-side product fetching function
async function loadProducts(): Promise<ProductCard[]> {
  try {
    // Fetch directly from Shopify library, bypassing internal API call
    const data = await getShopifyProducts();

    if (!data.success || !data.products) {
      console.error('Failed to load products:', data.error);
      return [];
    }

    // Map the API response to ProductCard format
    return data.products.map((p: any) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      image: p.images && p.images.length > 0 ? p.images[0] : null,
      price: p.price || 0,
      available: p.status === 'active',
      createdAt: p.createdAt || new Date().toISOString()
    }));

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
  const initialProducts = await loadProducts();

  return <StorePageClient isStoreOpen={true} initialProducts={initialProducts} />;
}
