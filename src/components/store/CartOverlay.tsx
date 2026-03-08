'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/contexts/StoreContext';
import { isPreorderActive, PREORDER_CHECKOUT_CTA, PREORDER_DISCLAIMER } from '@/config/preorder';

// ============================================
// Cart Item Component
// ============================================

interface CartItemRowProps {
  item: {
    variantId: string;
    title: string;
    variantTitle: string;
    price: number;
    currency: string;
    quantity: number;
    image: { url: string; altText?: string } | null;
  };
  onUpdateQuantity: (variantId: string, quantity: number) => void;
  onRemove: (variantId: string) => void;
}

function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      className="flex gap-4 py-4 border-b border-white/10"
    >
      {/* Image */}
      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-white/5">
        {item.image ? (
          <img
            src={item.image.url}
            alt={item.image.altText || item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-medium text-sm line-clamp-1">{item.title}</h3>
        {item.variantTitle && item.variantTitle !== 'Default Title' && (
          <p className="text-white/50 text-xs mt-0.5">{item.variantTitle}</p>
        )}
        <p className="text-white/80 text-sm mt-1">
          ${(item.price * item.quantity).toFixed(2)}
        </p>

        {/* Quantity controls */}
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center rounded-lg bg-white/5">
            <button
              onClick={() => onUpdateQuantity(item.variantId, item.quantity - 1)}
              className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors"
              aria-label="Decrease quantity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="w-8 text-center text-sm text-white">{item.quantity}</span>
            <button
              onClick={() => onUpdateQuantity(item.variantId, item.quantity + 1)}
              className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors"
              aria-label="Increase quantity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <button
            onClick={() => onRemove(item.variantId)}
            className="text-red-400/70 hover:text-red-400 text-xs transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// Main CartOverlay Component
// ============================================

interface CartOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartOverlay({ isOpen, onClose }: CartOverlayProps) {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    checkout,
    isCheckingOut,
    openStore,
  } = useStore();

  const handleCheckout = async () => {
    await checkout();
  };

  const handleContinueShopping = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm"
          />

          {/* Cart panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-[121] w-full max-w-md bg-[#0d0c0b] flex flex-col"
          >
            {/* Header */}
            <header
              className="flex items-center justify-between px-4 py-4 border-b border-white/10"
              style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 0px))' }}
            >
              <h2 className="text-lg font-semibold text-white">Your Bag</h2>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/5"
                aria-label="Close cart"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4">
              {cart.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <svg className="w-16 h-16 text-white/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <p className="text-white/50 mb-4">Your bag is empty</p>
                  <button
                    onClick={handleContinueShopping}
                    className="px-6 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {cart.items.map((item) => (
                    <CartItemRow
                      key={item.variantId}
                      item={item}
                      onUpdateQuantity={updateQuantity}
                      onRemove={removeFromCart}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer with totals and checkout */}
            {cart.items.length > 0 && (
              <div
                className="flex-shrink-0 border-t border-white/10 p-4 bg-[#0d0c0b]"
                style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
              >
                {/* Subtotal */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/60">Subtotal</span>
                  <span className="text-lg font-semibold text-white">
                    ${cart.subtotal.toFixed(2)} {cart.currency}
                  </span>
                </div>

                {/* Pre-order disclaimer */}
                {isPreorderActive() && (
                  <div className="mb-4 p-3 rounded-xl border border-[#843c2d]/20 bg-[#843c2d]/5">
                    <p className="text-[11px] text-white/50 leading-relaxed">{PREORDER_DISCLAIMER}</p>
                  </div>
                )}

                {/* Checkout button */}
                <motion.button
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full py-4 rounded-xl font-semibold text-base transition-all ${
                    isCheckingOut
                      ? 'bg-white/20 text-white/60 cursor-wait'
                      : 'bg-white text-black hover:bg-white/90 active:bg-white/80'
                  }`}
                >
                  {isCheckingOut ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Redirecting to Checkout...
                    </span>
                  ) : (
                    isPreorderActive() ? PREORDER_CHECKOUT_CTA : 'Checkout'
                  )}
                </motion.button>

                {/* Secure checkout note */}
                <p className="text-[10px] text-white/30 text-center mt-3 flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Secure checkout powered by Shopify
                </p>

                {/* Continue shopping link */}
                <button
                  onClick={handleContinueShopping}
                  className="w-full mt-3 py-2 text-sm text-white/60 hover:text-white transition-colors"
                >
                  Continue Shopping
                </button>

                {/* Clear cart */}
                <button
                  onClick={clearCart}
                  className="w-full mt-2 py-2 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                >
                  Clear Bag
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
