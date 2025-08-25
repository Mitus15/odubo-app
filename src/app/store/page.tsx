"use client";
import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface ProductCard {
  id: string;
  title: string;
  handle: string;
  image: string | null;
  price: string | null;
}

export default function StorePage() {
  const [activeTab, setActiveTab] = useState<'clothes' | 'items'>('clothes');
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);

  const loadProducts = async (type: 'clothes' | 'items') => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/shopify/collections?type=${type}`, { cache: 'no-store' });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Load failed: ${res.status} ${txt}`);
      }
      const data = await res.json() as { products: ProductCard[] };
      setProducts(data.products || []);
      setCurrentProductIndex(0); // Reset to first product when switching tabs
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMsg);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts(activeTab);
  }, [activeTab]);

  return (
    <ScreenLayout>
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
      <ScrollContainer>
        <div className="max-w-6xl mx-auto p-4">
          <header className="mb-4 flex items-center justify-between">
            {/* Tabs */}
            <div className="glass-surface rounded-2xl p-1.5 inline-flex gap-1 border border-[#502d26]/30">
            <button
              onClick={() => setActiveTab('clothes')}
              className={`px-4 py-2 rounded-xl text-sm ${activeTab === 'clothes' ? 'bg-[#843c2d]/20 text-[#ede8df]' : 'text-[#b2a491] hover:bg-[#843c2d]/10'}`}
            >
              Clothes
            </button>
            <button
              onClick={() => setActiveTab('items')}
              className={`px-4 py-2 rounded-xl text-sm ${activeTab === 'items' ? 'bg-[#843c2d]/20 text-[#ede8df]' : 'text-[#b2a491] hover:bg-[#843c2d]/10'}`}
            >
              Items
            </button>
            </div>
            <Link href="/store/cart" className="text-sm text-[#b2a491] hover:text-[#ede8df]">View Cart</Link>
          </header>

          {/* Product Carousel - Single Large Product */}
          <div className="relative flex items-center justify-center min-h-[60vh]">
            {loading && (
              <div className="w-80 max-w-sm mx-auto">
                <div className="aspect-[4/5] bg-[#302927]/40 animate-pulse rounded-lg" />
              </div>
            )}
            {!loading && products.length > 0 && (
              <div 
                className="flex overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory w-full"
                onScroll={(e) => {
                  const scrollLeft = e.currentTarget.scrollLeft;
                  const itemWidth = e.currentTarget.scrollWidth / products.length;
                  const index = Math.round(scrollLeft / itemWidth);
                  setCurrentProductIndex(index);
                }}
              >
                {products.map((p, index) => (
                  <div key={p.id} className="flex-shrink-0 w-full flex justify-center snap-start">
                    <Link 
                      href={`/store/product/${p.handle}`} 
                      className="group w-80 max-w-sm hover:scale-[1.02] transition-transform duration-300"
                    >
                      <div className="relative text-center">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={p.image} 
                            alt={p.title} 
                            className="w-full aspect-[4/5] object-cover rounded-lg mx-auto" 
                          />
                        ) : (
                          <div className="w-full aspect-[4/5] bg-[#302927]/40 rounded-lg" />
                        )}
                        <div className="mt-6 space-y-2">
                          <h3 className="text-xl font-semibold text-[#ede8df] line-clamp-2 leading-tight">
                            {p.title}
                          </h3>
                          <div className="text-lg text-[#b2a491]">
                            {p.price ? `$${Number(p.price).toFixed(2)}` : '—'}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {!loading && !error && products.length === 0 && (
              <div className="text-center text-[#b2a491] py-8">No products found.</div>
            )}
            {error && (
              <div className="text-center text-[#b2a491] py-8">{error}</div>
            )}
          </div>

          {/* Product Preview Thumbnails */}
          {!loading && products.length > 0 && (
            <div className="flex justify-center mt-8 mb-4">
              <div className="flex gap-2 px-4 py-2 glass-surface rounded-full border border-[#502d26]/30">
                {products.slice(0, 5).map((p, index) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      const carousel = document.querySelector('.flex.overflow-x-auto.scrollbar-hide');
                      if (carousel) {
                        const itemWidth = carousel.scrollWidth / products.length;
                        carousel.scrollTo({ left: index * itemWidth, behavior: 'smooth' });
                      }
                    }}
                    className={`relative w-10 h-12 rounded overflow-hidden transition-all duration-300 ${
                      currentProductIndex === index 
                        ? 'ring-2 ring-[#843c2d] scale-110' 
                        : 'opacity-60 hover:opacity-80'
                    }`}
                  >
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={p.image} 
                        alt={p.title} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full bg-[#302927]/40" />
                    )}
                  </button>
                ))}
                {products.length > 5 && (
                  <div className="flex items-center text-xs text-[#b2a491] ml-2">
                    +{products.length - 5}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}
