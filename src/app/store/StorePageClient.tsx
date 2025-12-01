'use client';

import { useEffect, useState } from 'react';
import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';
import Link from 'next/link';

interface ProductCard {
  id: string;
  title: string;
  handle: string;
  image: string | null;
  price: number | null;
  category: string;
  available: boolean;
  collections: string[];
  createdAt: string;
}

interface StorePageClientProps {
  isStoreOpen: boolean;
  initialProducts: ProductCard[];
}

export default function StorePageClient({ isStoreOpen, initialProducts }: StorePageClientProps) {
  const [timeLeft, setTimeLeft] = useState({
    weeks: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const [activeTab, setActiveTab] = useState<'clothes' | 'items'>('clothes');
  const [products, setProducts] = useState<ProductCard[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'odubo') {
      setIsUnlocked(true);
      setUnlockError('');
    } else {
      setUnlockError('Incorrect password');
    }
  };

  useEffect(() => {
    const targetDate = new Date('2026-03-14T00:00:00').getTime();
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;
      
      if (difference > 0) {
        const weeks = Math.floor(difference / (1000 * 60 * 60 * 24 * 7));
        const days = Math.floor((difference % (1000 * 60 * 60 * 24 * 7)) / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft({ weeks, days, hours, minutes, seconds });
      } else {
        setTimeLeft({ weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Filter products based on active tab
  const filteredProducts = products.filter(p => {
    const collections = p.collections || [];
    const isClothing = collections.some(c => {
      const lower = c.toLowerCase();
      return lower.includes('cloth') || 
             lower.includes('apparel') || 
             lower.includes('shirt') || 
             lower.includes('top') || 
             lower.includes('hoodie') || 
             lower.includes('wear');
    });

    if (activeTab === 'clothes') {
      // Include if it's clothing OR has NO collections (uncategorized fallback)
      return isClothing || collections.length === 0;
    } else {
      // Items tab: anything NOT in clothing
      return !isClothing && collections.length > 0;
    }
  });  if (!isStoreOpen && !isUnlocked) {
    return (
      <ScreenLayout>
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-stone-950 via-stone-900 to-red-950" />
        <ScrollContainer>
          <div className="max-w-4xl mx-auto px-6 py-20 text-center">
            <div className="glass-surface rounded-3xl border border-[#502d26]/30 p-10 backdrop-blur-md bg-[#1c1a19]/80">
              <h1 className="text-3xl sm:text-4xl font-bold text-[#ede8df] mb-8 tracking-tight">Store Opening Soon</h1>
              
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
                {Object.entries(timeLeft).map(([unit, value]) => (
                  <div key={unit} className="glass-surface rounded-2xl border border-[#502d26]/20 p-4 bg-[#302927]/20">
                    <div className="text-3xl sm:text-4xl font-bold text-[#ede8df] tabular-nums">{value}</div>
                    <div className="text-xs text-[#b2a491] mt-1 uppercase tracking-wider">{unit}</div>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                <Link href="/" className="px-6 py-3 rounded-xl bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60 hover:text-[#ede8df] transition-all duration-300">
                  Return Home
                </Link>
              </div>

              {/* Designer Access */}
              <form onSubmit={handleUnlock} className="max-w-xs mx-auto mt-12 pt-8 border-t border-[#502d26]/20">
                <p className="text-[10px] text-[#b2a491] mb-3 uppercase tracking-[0.2em]">Designer Access</p>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password"
                    className="flex-1 bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d] transition-colors placeholder:text-[#502d26]"
                  />
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-[#843c2d]/20 text-[#ede8df] rounded-lg hover:bg-[#843c2d]/40 text-sm font-medium transition-colors"
                  >
                    Enter
                  </button>
                </div>
                {unlockError && <p className="text-red-400 text-xs mt-2">{unlockError}</p>}
              </form>
            </div>
          </div>
        </ScrollContainer>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <div className="fixed inset-0 -z-10 bg-[#0c0a09]" />
      <ScrollContainer>
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <header className="mb-8 sm:mb-16 sticky top-0 z-10 py-4 sm:py-6 bg-[#0c0a09]/90 backdrop-blur-md border-b border-[#502d26]/10">
            <div className="max-w-7xl mx-auto flex items-center justify-between px-2 sm:px-0">
              {/* Empty left side for balance if needed, or Logo */}
              <div className="w-20 hidden sm:block"></div>

              {/* Centered Tabs */}
              <div className="flex-1 flex justify-center gap-6 sm:gap-12">
                <button
                  onClick={() => setActiveTab('clothes')}
                  className={`text-xs sm:text-sm uppercase tracking-[0.2em] transition-all duration-300 ${
                    activeTab === 'clothes' 
                      ? 'text-[#ede8df] font-medium' 
                      : 'text-[#502d26] hover:text-[#b2a491]'
                  }`}
                >
                  Clothes
                </button>
                <button
                  onClick={() => setActiveTab('items')}
                  className={`text-xs sm:text-sm uppercase tracking-[0.2em] transition-all duration-300 ${
                    activeTab === 'items' 
                      ? 'text-[#ede8df] font-medium' 
                      : 'text-[#502d26] hover:text-[#b2a491]'
                  }`}
                >
                  Items
                </button>
              </div>

              {/* Right side Cart */}
              <Link href="/store/cart" className="w-auto sm:w-20 text-right text-[10px] sm:text-xs text-[#b2a491] hover:text-[#ede8df] uppercase tracking-widest transition-colors">
                Cart (0)
              </Link>
            </div>
          </header>

          {/* Product Grid */}
          <div className="min-h-[60vh] max-w-7xl mx-auto">
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="aspect-[3/4] bg-[#1c1a19]/20 animate-pulse rounded-sm" />
                ))}
              </div>
            )}
            
            {!loading && filteredProducts.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-10 sm:gap-x-12 sm:gap-y-20">
                {filteredProducts.map((p) => (
                  <Link 
                    key={p.id}
                    href={`/store/product/${p.handle}`} 
                    className={`group block ${p.available === false ? 'opacity-60' : ''}`}
                  >
                    {/* Removed background color to respect transparent images */}
                    <div className="relative aspect-[3/4] overflow-hidden mb-4 sm:mb-8 flex items-center justify-center">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={p.image} 
                          alt={p.title} 
                          className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#502d26] bg-[#1c1a19]/20">
                          <span className="uppercase tracking-widest text-xs">No Image</span>
                        </div>
                      )}
                      
                      {/* New Badge */}
                      {p.available && (new Date(p.createdAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000) && (
                        <div className="absolute top-0 left-0 p-2 sm:p-4">
                          <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-[#843c2d] text-[#ede8df] text-[8px] sm:text-[10px] uppercase tracking-widest">
                            New
                          </span>
                        </div>
                      )}

                      {!p.available && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="px-2 py-1 sm:px-3 sm:py-1 bg-[#1c1a19] text-[#ede8df] text-[10px] sm:text-xs uppercase tracking-widest border border-[#502d26]">
                            Sold Out
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1 sm:space-y-2 text-center">
                      <h3 className="text-sm sm:text-lg font-medium text-[#ede8df] group-hover:text-[#843c2d] transition-colors duration-300 tracking-wide">
                        {p.title}
                      </h3>
                      <div className="text-xs sm:text-sm text-[#b2a491] font-light tracking-widest">
                        {p.available === false 
                          ? 'SOLD OUT' 
                          : (p.price !== null ? `$${p.price.toFixed(2)}` : 'PRICE ON REQUEST')}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            
            {!loading && !error && filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 text-[#502d26]">
                <p className="uppercase tracking-widest text-sm">No products found in this category</p>
              </div>
            )}
            
            {error && (
              <div className="text-center text-red-400 py-8">{error}</div>
            )}
          </div>
        </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}
