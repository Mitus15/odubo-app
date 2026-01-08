'use client';

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useStore } from '@/contexts/StoreContext';
import ProductBrowse from './ProductBrowse';
import ProductDetailFeed from './ProductDetailFeed';
import CartOverlay from './CartOverlay';

/**
 * Cart Overlay Context - for opening cart from any store component
 */
interface CartOverlayContextValue {
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartOverlayContext = createContext<CartOverlayContextValue | null>(null);

export function useCartOverlay() {
  const context = useContext(CartOverlayContext);
  if (!context) {
    throw new Error('useCartOverlay must be used within StoreOrchestrator');
  }
  return context;
}

/**
 * StoreOrchestrator
 * 
 * Main controller for the store UI - renders the appropriate view based on state.
 * 
 * Flow:
 * 1. Shop button (Store Door) → opens ProductBrowse (view: 'browse')
 * 2. Tap product → opens ProductDetailFeed (view: 'detail')
 * 3. Vertical swipe → navigate between products
 * 4. Cart button → CartOverlay (side panel)
 * 5. Close/checkout → back to clips
 */
export default function StoreOrchestrator() {
  const { view } = useStore();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const cartOverlayValue: CartOverlayContextValue = {
    isCartOpen,
    openCart,
    closeCart,
  };

  return (
    <CartOverlayContext.Provider value={cartOverlayValue}>
      <div className="relative h-full">
        {/* Main store views */}
        <AnimatePresence mode="wait">
          {view === 'browse' && <ProductBrowse key="browse" />}
          {view === 'detail' && <ProductDetailFeed key="detail" />}
        </AnimatePresence>

        {/* Persistent footer - shows across all store views */}
        {view !== 'closed' && (
          <footer className="fixed bottom-0 left-0 right-0 z-[115] border-t border-white/5 bg-black/80 backdrop-blur-sm">
            <div 
              className="px-4 py-2"
              style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex flex-col items-center justify-center gap-1.5 text-[11px]">
                <div className="flex items-center gap-3 text-white/50">
                  <Link href="/legal" className="hover:text-white/80 transition-colors">Privacy</Link>
                  <span className="text-white/20">•</span>
                  <Link href="/legal?tab=terms" className="hover:text-white/80 transition-colors">Terms</Link>
                  <span className="text-white/20">•</span>
                  <Link href="/legal?tab=shipping" className="hover:text-white/80 transition-colors">Shipping & Returns</Link>
                </div>
                <div className="text-white/30">
                  © {new Date().getFullYear()} ODUBO
                </div>
              </div>
            </div>
          </footer>
        )}

        {/* Cart overlay (accessible from any view) */}
        <CartOverlay isOpen={isCartOpen} onClose={closeCart} />
      </div>
    </CartOverlayContext.Provider>
  );
}
