'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useOmniShop } from '@/contexts/OmniShopContext';

interface QuickStoreProps {
  // No props needed - will fetch featured products
}

export default function QuickStore() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useOmniShop();

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch('/api/shopify/products?featured=true&limit=6', {
          headers: { 'Accept': 'application/json' },
          // Add caching headers if needed
          next: { revalidate: 300 } // Revalidate every 5 minutes
        });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch products: ${res.status}`);
        }
        
        const data = await res.json();
        setProducts(data.products || []);
      } catch (err) {
        console.error('Failed to fetch featured products:', err);
        setError('Failed to load products');
        setProducts([]); // Ensure we don't show stale data on error
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProducts();
  }, []);

  const handleAddToCart = (product: any) => {
    // Find the first available variant
    const variant = product.variants?.find((v: any) => v.available) || product.variants?.[0];
    if (variant) {
      addToCart({
        variantId: variant.id,
        qty: 1,
        title: product.title,
        variantTitle: variant.title,
        price: parseFloat(variant.price.amount || variant.price),
        image: product.featuredImage?.url || '',
      });
    }
  };

  if (loading && products.length === 0) {
    return (
      <section className="relative py-20 bg-[#0d0c0a]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center">
            <p className="text-white/40">Loading featured products...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error && products.length === 0) {
    return (
      <section className="relative py-20 bg-[#0d0c0a]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center">
            <p className="text-red-400">{error}</p>
            <Link href="/store" className="mt-4 inline-flex items-center px-4 py-2 bg-[#843c2d] text-white text-sm font-medium rounded-full hover:bg-[#9a4535]">
              Visit Store
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative py-20 bg-[#0d0c0a]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-12 text-center">
          <h2 className="text-2xl xl:text-3xl font-bold text-[#ede8df]">
            Featured Drops
          </h2>
          <p className="text-[#ede8df]/60 text-md mt-2">
            Limited pieces from the latest collection
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid gap-8">
          {/* 2-column grid on desktop, 1-column on mobile */}
          <div className="grid md:grid-cols-2 gap-6">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="relative group overflow-hidden rounded-xl bg-[#1a1816]/20 backdrop-blur"
              >
                {/* Product Image */}
                {product.images?.[0] || product.image ? (
                  <div className="relative aspect-w-1 aspect-h-1 w-full overflow-hidden">
                    <img 
                      src={product.images?.[0] || product.image}
                      alt={product.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Out of stock badge */}
                    {product.availableForSale === false && (
                      <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/90 text-white">
                        Sold Out
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-w-1 aspect-h-1 w-full flex items-center justify-center bg-[#1a1816]/30">
                    <p className="text-white/40 text-sm">Image coming soon</p>
                  </div>
                )}
                
                {/* Product Info */}
                <div className="p-4">
                  <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2">
                    {product.title}
                  </h3>
                  <div className="mb-3">
                    {product.priceRange?.minVariantPrice ? (
                      <div className="text-white text-lg font-medium">
                        {product.priceRange.minVariantPrice.amount} {product.priceRange.minVariantPrice.currencyCode}
                        {product.priceRange.maxVariantPrice.amount !== product.priceRange.minVariantPrice.amount && (
                          <span className="ml-2 text-white/60">
                            &ndash; {product.priceRange.maxVariantPrice.amount} {product.priceRange.maxVariantPrice.currencyCode}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-white text-lg font-medium">
                        {product.price || '0.00'} USD
                      </div>
                    )}
                  </div>
                  
                  {/* Add to Cart Button */}
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.availableForSale === false || loading}
                    className={`w-full flex items-center justify-center px-4 py-3 rounded-full font-medium text-sm transition-all duration-300
                      ${product.availableForSale !== false && !loading
                        ? 'bg-[#843c2d] text-white hover:bg-[#9a4535]'
                        : 'bg-[#1a1816]/40 text-white/50 cursor-not-allowed'}
                    `}
                  >
                    {product.availableForSale !== false && !loading ? 'Add to Cart' : 'Sold Out'}
                  </button>
                  
                  {/* Quick View Link */}
                  {product.availableForSale === false || loading ? null : (
                    <Link 
                      href={`/store/product/${product.handle}`} 
                      className="mt-3 block text-center text-white/60 text-sm hover:text-white underline-offset-2"
                    >
                      Quick View
                    </Link>
                  )}
                </div>
              </div>
            ))}
            
            {/* Fill empty grid spots if less than 6 products */}
            {products.length < 6 && Array.from({ length: 6 - products.length }).map((_, index) => (
              <div key={`placeholder-${index}`} className="hidden md:block" />
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-12 text-center">
          <Link 
            href="/store" 
            className="inline-flex items-center px-6 py-3 bg-transparent border border-white/20 rounded-full text-[ede8df] text-sm font-medium hover:bg-[#843c2d]/20 hover:text-white transition-all duration-300"
          >
            Browse Full Collection
            <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}