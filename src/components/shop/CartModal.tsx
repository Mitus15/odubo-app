'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOmniShop } from '@/contexts/OmniShopContext';

export default function CartModal() {
  const {
    cart,
    cartSubtotal,
    updateQuantity,
    removeFromCart,
    goBack,
    closeAll,
    openMaison,
    modalStack,
  } = useOmniShop();

  const [isRedirecting, setIsRedirecting] = useState(false);

  const hasBackStack = modalStack.length > 1;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsRedirecting(true);

    try {
      // Create checkout using Shopify Storefront API
      const response = await fetch('/api/shopify/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: cart.map(item => ({
            variantId: item.variantId,
            quantity: item.qty
          }))
        })
      });

      const { checkoutUrl } = await response.json();
      
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setIsRedirecting(false);
      alert('Failed to create checkout. Please try again.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[130] flex flex-col bg-gradient-to-br from-[#302927]/95 via-[#1a1817] to-[#302927]/95"
    >
      {/* Header - glass surface */}
      <header
        className="flex items-center justify-between px-4 py-3 glass-surface-light border-b border-white/5"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={hasBackStack ? goBack : closeAll}
          className="w-10 h-10 flex items-center justify-center text-[#ede8df]/60 hover:text-[#ede8df] transition-colors rounded-full hover:bg-white/5"
          aria-label={hasBackStack ? 'Back' : 'Close'}
          style={{ touchAction: 'manipulation' }}
        >
          {hasBackStack ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>

        <img
          src="/brand-logos/baad.png"
          alt="B.A.A.D Brand Logo"
          className="h-6 w-auto"
          draggable={false}
        />

        <div className="w-10" />
      </header>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          paddingBottom: cart.length > 0 ? 'calc(env(safe-area-inset-bottom, 0px) + 200px)' : 'env(safe-area-inset-bottom, 0px)',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        {/* Empty state */}
        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
            <svg className="w-16 h-16 text-[#b2a491]/20 mb-4" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <p className="text-[#b2a491]/60 text-xs uppercase tracking-[0.2em] mb-6">Your bag is empty</p>
            <button
              onClick={openMaison}
              className="px-6 py-3 bg-[#ede8df] text-[#302927] rounded-xl text-xs uppercase tracking-[0.15em] font-medium active:scale-[0.98] transition-transform"
              style={{ touchAction: 'manipulation' }}
            >
              Browse Store
            </button>
          </div>
        )}

        {/* Cart items */}
        {cart.length > 0 && (
          <div className="divide-y divide-[#502d26]/20">
            {cart.map((item) => (
              <div key={item.variantId} className="flex gap-4 p-4">
                {/* Image */}
                <div className="w-20 h-24 flex-shrink-0 bg-gradient-to-br from-[#1a1817] to-[#252220] rounded-xl overflow-hidden">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#b2a491]/30 text-[8px] uppercase">
                      No Image
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <h3 className="text-[#ede8df] text-sm font-medium truncate">
                      {item.title.split('—')[0]}
                    </h3>
                    <p className="text-[#b2a491]/60 text-xs truncate mt-0.5">
                      {item.title.split('—')[1] || 'Default'}
                    </p>
                  </div>

                  <div className="flex items-end justify-between mt-2">
                    {/* Quantity controls */}
                    <div className="flex items-center glass-surface border border-[#502d26]/30 rounded-xl">
                      <button
                        onClick={() => updateQuantity(item.variantId, item.qty - 1)}
                        className="w-8 h-8 flex items-center justify-center text-[#b2a491] hover:text-[#ede8df] transition-colors"
                        style={{ touchAction: 'manipulation' }}
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-[#ede8df] text-sm">{item.qty}</span>
                      <button
                        onClick={() => updateQuantity(item.variantId, item.qty + 1)}
                        className="w-8 h-8 flex items-center justify-center text-[#b2a491] hover:text-[#ede8df] transition-colors"
                        style={{ touchAction: 'manipulation' }}
                      >
                        +
                      </button>
                    </div>

                    {/* Price */}
                    <p className="text-[#ede8df] font-medium">
                      ${(item.price * item.qty).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeFromCart(item.variantId)}
                  className="p-2 text-[#b2a491]/40 hover:text-[#843c2d] transition-colors self-start"
                  aria-label="Remove item"
                  style={{ touchAction: 'manipulation' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed bottom checkout - glass */}
      {cart.length > 0 && (
        <div
          className="px-5 py-4 glass-surface-light border-t border-white/5 space-y-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
        >
          {/* Subtotal */}
          <div className="flex justify-between items-center">
            <span className="text-[#b2a491]/60 text-xs uppercase tracking-[0.15em]">Subtotal</span>
            <span className="text-[#ede8df] text-lg font-medium">${cartSubtotal.toFixed(2)}</span>
          </div>

          {/* Shipping note */}
          <p className="text-[#b2a491]/40 text-[10px] text-center uppercase tracking-[0.1em]">
            Shipping calculated at checkout
          </p>

          {/* Checkout button */}
          <button
            onClick={handleCheckout}
            disabled={isRedirecting}
            className="w-full py-4 rounded-xl bg-[#ede8df] text-[#302927] text-xs uppercase tracking-[0.2em] font-medium active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-wait hover:bg-[#ede8df]/90"
            style={{ touchAction: 'manipulation' }}
          >
            {isRedirecting ? 'Redirecting...' : 'Checkout'}
          </button>

          {/* Continue shopping */}
          <button
            onClick={openMaison}
            className="w-full py-3 text-[#b2a491]/70 hover:text-[#ede8df] text-xs uppercase tracking-[0.15em] transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            Continue Shopping
          </button>

          {/* Legal links */}
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-2 border-t border-[#502d26]/10">
            <a
              href="https://odubostudio.myshopify.com/policies/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-[#b2a491]/40 hover:text-[#b2a491]/70 transition-colors uppercase tracking-wider"
            >
              Privacy
            </a>
            <a
              href="https://odubostudio.myshopify.com/policies/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-[#b2a491]/40 hover:text-[#b2a491]/70 transition-colors uppercase tracking-wider"
            >
              Terms
            </a>
            <a
              href="https://odubostudio.myshopify.com/policies/shipping-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-[#b2a491]/40 hover:text-[#b2a491]/70 transition-colors uppercase tracking-wider"
            >
              Shipping
            </a>
            <a
              href="https://odubostudio.myshopify.com/policies/refund-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-[#b2a491]/40 hover:text-[#b2a491]/70 transition-colors uppercase tracking-wider"
            >
              Refunds
            </a>
          </div>
        </div>
      )}
    </motion.div>
  );
}
