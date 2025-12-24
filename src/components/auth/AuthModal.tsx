'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useAuthModal, type AuthView, type LegalTab } from '@/contexts/AuthModalContext';

// Legal content (mirrored from /src/app/legal/page.tsx)
const LegalContent = {
  privacy: (
    <>
      <p className="text-sm">Odubo Studio ("we," "us," or "our") is built on a foundation of trust. We understand that trusting us with your personal information is a big deal, and we don't take it lightly.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Information We Collect</h3>
      <p className="text-sm">We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us. This may include your name, email address, shipping address, and payment information.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">How We Use Your Information</h3>
      <p className="text-sm">We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you about orders, products, and promotional offers.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Information Sharing</h3>
      <p className="text-sm">We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as necessary to fulfill orders (such as shipping carriers) or as required by law.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Data Security</h3>
      <p className="text-sm">We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Contact Us</h3>
      <p className="text-sm">If you have any questions about this Privacy Policy, please contact us at <span className="text-white">privacy@odubo.com</span>.</p>
    </>
  ),

  terms: (
    <>
      <p className="text-sm">Welcome to Odubo Studio. These Terms of Service ("Terms") govern your access to and use of the Odubo Studio website and services.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Acceptance of Terms</h3>
      <p className="text-sm">By accessing or using our services, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these terms, please do not use our services.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Use of Services</h3>
      <p className="text-sm">You may use our services only in compliance with these Terms and all applicable laws and regulations. You agree not to misuse our services or help anyone else do so.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Intellectual Property</h3>
      <p className="text-sm">All content and materials available on our website, including but not limited to text, graphics, logos, images, audio, video, and software, are the property of Odubo Studio and are protected by intellectual property laws.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Limitation of Liability</h3>
      <p className="text-sm">Odubo Studio shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of our services.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Contact Information</h3>
      <p className="text-sm">Questions about the Terms of Service should be sent to us at <span className="text-white">legal@odubo.com</span>.</p>
    </>
  ),

  shipping: (
    <>
      <p className="text-sm">We are a small studio, and many items are crafted with care. Here's what you need to know about shipping and returns:</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Processing Time</h3>
      <p className="text-sm">Orders are typically processed within 1-3 business days. During high-volume periods or for custom items, processing may take longer.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Shipping Options</h3>
      <p className="text-sm">We offer standard and expedited shipping options. Shipping times vary based on your location. You will receive tracking information once your order ships.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">International Shipping</h3>
      <p className="text-sm">We ship internationally to select countries. International customers are responsible for any customs duties or import taxes.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Returns</h3>
      <p className="text-sm">We accept returns within 30 days of delivery for most items in original, unworn condition with tags attached. Custom or personalized items are final sale.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Exchanges</h3>
      <p className="text-sm">We're happy to exchange items for different sizes or colors when available. Contact us to arrange an exchange.</p>

      <h3 className="text-sm font-semibold mt-6 mb-2 text-white">Questions?</h3>
      <p className="text-sm">Contact our support team at <span className="text-white">support@odubo.com</span> for any shipping or returns questions.</p>
    </>
  )
};

export default function AuthModal() {
  const {
    isOpen,
    currentView,
    legalTab,
    setView,
    setLegalTab,
    close,
  } = useAuthModal();


  // Customer login state via httpOnly cookie
  const [customerData, setCustomerData] = useState<{ email: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Screen size detection for desktop vs mobile behavior
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check if user is logged in via cookie
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/customer-status');
        const data = await res.json() as { loggedIn: boolean; email?: string };
        if (data.loggedIn && data.email) {
          setCustomerData({ email: data.email });
        }
      } catch {
        // Silent fail
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  // Helper to extract first name from email
  const getFirstName = (emailAddress: string) => {
    const localPart = emailAddress.split('@')[0];
    // Handle formats like john.doe, john_doe, johndoe
    const name = localPart.split('.')[0].split('_')[0];
    // Capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  const displayName = customerData?.email ? getFirstName(customerData.email) : '';
  const isLoggedIn = !!customerData;

  // Handle customer sign out
  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/customer-logout', { method: 'POST' });
      setCustomerData(null);
    } catch {
      // Silent fail - cookie will expire anyway
    }
  };

  // Swipe-to-dismiss
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 150 || info.velocity.y > 500) {
      close();
    }
    setDragY(0);
  }, [close]);

  const handleShopifyLogin = () => {
    // New Customer Accounts - just redirect to Shopify's hosted login
    close();
    window.location.href = 'https://account.odubo.studio/login';
  };


  const renderSignIn = () => (
    <div className="px-6 pb-8">
      {/* Header - personalized when logged in */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        {isLoggedIn ? (
          <h2 className="text-xl font-medium text-white">Hi, {displayName}</h2>
        ) : (
          <h2 className="text-xl font-medium text-white">Sign In</h2>
        )}
      </div>

      {/* Shopify login/account access */}
      {checkingAuth ? (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-[#843c2d] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isLoggedIn ? (
        <>
          <a
            href="https://account.odubo.studio"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-white font-medium hover:opacity-90 transition-opacity mb-3 relative z-50 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            View My Account
          </a>
          <p className="text-[10px] text-white/40 text-center mb-6">
            Access orders, tracking & account details
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log('🔵 Shopify button clicked!');
              handleShopifyLogin();
            }}
            className="w-full py-3 rounded-xl bg-white text-[#171616] font-medium hover:bg-white/90 transition-colors mb-3 relative z-50"
          >
            Sign in with Shopify Account
          </button>
          <p className="text-[10px] text-white/40 text-center mb-6">
            For customers and regular users
          </p>
        </>
      )}

      {/* Footer links */}
      <div className="mt-6 space-y-3">
        {isLoggedIn ? (
          <button
            onClick={handleSignOut}
            className="w-full text-sm text-white/50 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        ) : (
          <button
            onClick={() => setView('signup')}
            className="w-full text-sm text-white/50 hover:text-white transition-colors"
          >
            Don't have an account? <span className="text-white/80">Create one</span>
          </button>
        )}

        <div className="flex justify-center gap-4 text-[10px] text-white/40">
          <button onClick={() => { setView('legal'); setLegalTab('privacy'); }} className="hover:text-white transition-colors">
            Privacy
          </button>
          <span className="text-white/20">|</span>
          <button onClick={() => { setView('legal'); setLegalTab('terms'); }} className="hover:text-white transition-colors">
            Terms
          </button>
          <span className="text-white/20">|</span>
          <button onClick={() => { setView('legal'); setLegalTab('shipping'); }} className="hover:text-white transition-colors">
            Shipping & Returns
          </button>
        </div>
      </div>
    </div>
  );

  const renderSignUp = () => (
    <div className="px-6 pb-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
        </div>
        <h2 className="text-xl font-medium text-white">Create Account</h2>
        <p className="text-sm text-white/50 mt-2">Join the Odubo community</p>
      </div>

      {/* Shopify signup - redirect to Shopify account page */}
      <button
        onClick={() => {
          const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
          window.location.href = `${shopifyStore}/account/register`;
        }}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-white font-medium hover:opacity-90 transition-opacity"
      >
        Create Shopify Account
      </button>
      <p className="text-[10px] text-white/40 text-center mt-3">
        Your Shopify account lets you track orders, save favorites, and more
      </p>

      {/* Back to sign in */}
      <button
        onClick={() => setView('signin')}
        className="w-full mt-6 text-sm text-white/50 hover:text-white transition-colors"
      >
        Already have an account? <span className="text-white/80">Sign in</span>
      </button>
    </div>
  );

  const renderAccount = () => (
    <div className="px-6 pb-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <h2 className="text-xl font-medium text-white">Account</h2>
      </div>

      {/* Account actions */}
      <div className="space-y-3">
        <button
          onClick={() => {
            const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
            window.location.href = `${shopifyStore}/account`;
          }}
          className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          Manage Orders
        </button>

        <button
          onClick={() => {
            localStorage.removeItem('token');
            close();
          }}
          className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Legal links */}
      <div className="mt-8 pt-6 border-t border-white/10">
        <div className="flex justify-center gap-4 text-[10px] text-white/40">
          <button onClick={() => { setView('legal'); setLegalTab('privacy'); }} className="hover:text-white transition-colors">
            Privacy
          </button>
          <span className="text-white/20">|</span>
          <button onClick={() => { setView('legal'); setLegalTab('terms'); }} className="hover:text-white transition-colors">
            Terms
          </button>
          <span className="text-white/20">|</span>
          <button onClick={() => { setView('legal'); setLegalTab('shipping'); }} className="hover:text-white transition-colors">
            Shipping
          </button>
        </div>
      </div>
    </div>
  );

  const renderLegal = () => (
    <div className="px-6 pb-8">
      {/* Back button */}
      <button
        onClick={() => setView('signin')}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        {(['privacy', 'terms', 'shipping'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setLegalTab(tab)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              legalTab === tab
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            {tab === 'privacy' && 'Privacy'}
            {tab === 'terms' && 'Terms'}
            {tab === 'shipping' && 'Shipping'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="text-white/60 space-y-4 max-h-[50vh] overflow-y-auto">
        {legalTab === 'privacy' && LegalContent.privacy}
        {legalTab === 'terms' && LegalContent.terms}
        {legalTab === 'shipping' && LegalContent.shipping}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'signin':
        return renderSignIn();
      case 'signup':
        return renderSignUp();
      case 'account':
        return renderAccount();
      case 'legal':
        return renderLegal();
      default:
        return null;
    }
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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
            onClick={close}
          />

          {/* Modal */}
          <motion.div
            ref={containerRef}
            initial={{ y: '100%' }}
            animate={{ y: dragY }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag={isMobile ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.5 }}
            onDrag={(_, info) => setDragY(Math.max(0, info.offset.y))}
            onDragEnd={handleDragEnd}
            className="fixed bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md md:rounded-3xl z-[110] bg-gradient-to-br from-[#1a1714] via-[#0f0d0c] to-[#1a1714] border-t md:border border-white/10 rounded-t-3xl overflow-hidden"
            style={{
              maxHeight: '85vh',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Drag handle - mobile only */}
            <div className="md:hidden flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Close button */}
            <button
              onClick={close}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 60px)' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentView}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
