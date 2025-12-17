'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useOmniShop } from '@/contexts/OmniShopContext';

export default function FloatingBagIndicator() {
  const { cartCount, openCart, modalStack } = useOmniShop();

  // Don't show if cart is empty or if any modal is open
  const isVisible = cartCount > 0 && modalStack.length === 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onClick={openCart}
          className="fixed z-50 flex items-center gap-2.5 px-4 py-3 rounded-full glass-surface border border-[#502d26]/40 text-[#ede8df] shadow-[0_8px_32px_rgba(0,0,0,0.5)] active:scale-95 transition-transform hover:bg-[#843c2d]/10"
          style={{
            bottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
            right: 16,
            touchAction: 'manipulation',
          }}
          aria-label={`Open cart with ${cartCount} items`}
        >
          {/* Bag icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>

          {/* Count badge */}
          <motion.span
            key={cartCount}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="text-sm font-medium text-[#ede8df]"
          >
            {cartCount}
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
