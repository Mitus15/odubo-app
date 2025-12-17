'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOmniShop } from '@/contexts/OmniShopContext';
import MaisonModal from './MaisonModal';
import ProductDetailModal from './ProductDetailModal';
import CartModal from './CartModal';

export default function OmniShopOrchestrator() {
  const { modalStack, closeAll, currentModal } = useOmniShop();

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack.length > 0) {
        closeAll();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [modalStack.length, closeAll]);

  // Prevent body scroll when modals open
  useEffect(() => {
    if (modalStack.length > 0) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalStack.length]);

  return (
    <>
      {/* Shared backdrop - covers entire screen including header */}
      <AnimatePresence>
        {modalStack.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
            onClick={closeAll}
          />
        )}
      </AnimatePresence>

      {/* Modal stack - only render current modal */}
      <AnimatePresence mode="wait">
        {currentModal?.type === 'maison' && (
          <MaisonModal key="maison" />
        )}
        {currentModal?.type === 'product' && currentModal.productHandle && (
          <ProductDetailModal
            key={`product-${currentModal.productHandle}`}
            productHandle={currentModal.productHandle}
          />
        )}
        {currentModal?.type === 'cart' && (
          <CartModal key="cart" />
        )}
      </AnimatePresence>
    </>
  );
}
