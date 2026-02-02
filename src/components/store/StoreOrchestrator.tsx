'use client';

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useStore } from '@/contexts/StoreContext';
import ProductBrowse from './ProductBrowse';
import ProductDetailFeed from './ProductDetailFeed';
import CartOverlay from './CartOverlay';
import LegalModal from './LegalModal';
import ContactModal from './ContactModal';

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
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'shipping'>('privacy');
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const openLegal = useCallback((tab: 'privacy' | 'terms' | 'shipping') => {
    setLegalTab(tab);
    setLegalModalOpen(true);
  }, []);

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

        {/* Persistent footer - only show in browse view (detail has its own Add to Bag UI) */}
        {view === 'browse' && (
          <footer className="fixed bottom-0 left-0 right-0 z-[115] border-t border-white/5 bg-black/80 backdrop-blur-sm">
            <div 
              className="px-4 py-3"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex flex-col items-center justify-center gap-2 text-xs">
                <div className="flex items-center gap-4 flex-wrap justify-center">
                  <button
                    onClick={() => openLegal('privacy')}
                    className="py-2 px-1 text-white/50 hover:text-white/80 transition-colors min-h-[44px] flex items-center"
                    style={{ touchAction: 'manipulation' }}
                  >
                    Privacy
                  </button>
                  <span className="text-white/20">•</span>
                  <button
                    onClick={() => openLegal('terms')}
                    className="py-2 px-1 text-white/50 hover:text-white/80 transition-colors min-h-[44px] flex items-center"
                    style={{ touchAction: 'manipulation' }}
                  >
                    Terms
                  </button>
                  <span className="text-white/20">•</span>
                  <button
                    onClick={() => openLegal('shipping')}
                    className="py-2 px-1 text-white/50 hover:text-white/80 transition-colors min-h-[44px] flex items-center"
                    style={{ touchAction: 'manipulation' }}
                  >
                    Shipping & Returns
                  </button>
                  <span className="text-white/20">•</span>
                  <button
                    onClick={() => setContactModalOpen(true)}
                    className="py-2 px-1 text-white/50 hover:text-white/80 transition-colors min-h-[44px] flex items-center"
                    style={{ touchAction: 'manipulation' }}
                  >
                    Contact
                  </button>
                </div>
                <div className="text-white/30">
                  © {new Date().getFullYear()} B.A.A.D@Odubo
                </div>
              </div>
            </div>
          </footer>
        )}

        {/* Cart overlay (accessible from any view) */}
        <CartOverlay isOpen={isCartOpen} onClose={closeCart} />

        {/* Legal modal */}
        <LegalModal
          isOpen={legalModalOpen}
          onClose={() => setLegalModalOpen(false)}
          initialTab={legalTab}
        />

        {/* Contact modal */}
        <ContactModal
          isOpen={contactModalOpen}
          onClose={() => setContactModalOpen(false)}
        />
      </div>
    </CartOverlayContext.Provider>
  );
}
