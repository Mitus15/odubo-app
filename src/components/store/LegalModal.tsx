'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type LegalTab = 'privacy' | 'terms' | 'shipping';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
}

export default function LegalModal({ isOpen, onClose, initialTab = 'privacy' }: LegalModalProps) {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  // Update active tab when initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const tabs: { key: LegalTab; label: string }[] = [
    { key: 'privacy', label: 'Privacy' },
    { key: 'terms', label: 'Terms' },
    { key: 'shipping', label: 'Shipping' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'privacy':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#ede8df]">Privacy Policy</h1>
            <div className="space-y-4 text-[#c7b8a8] leading-relaxed">
              <p>Odubo Studio ("we," "us," or "our") is built on a foundation of trust. We understand that trusting us with your personal information is a big deal, and we don't take it lightly.</p>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Information We Collect</h2>
                <p>We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us. This may include your name, email address, shipping address, and payment information.</p>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">How We Use Your Information</h2>
                <p>We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you about orders, products, and promotional offers.</p>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Information Sharing</h2>
                <p>We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as necessary to fulfill orders (such as shipping carriers) or as required by law.</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Data Security</h2>
                <p>We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.</p>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Contact Us</h2>
                <p>If you have any questions about this Privacy Policy, please contact us at <span className="text-[#ede8df]">privacy@odubo.studio</span>.</p>
              </div>
            </div>
          </div>
        );

      case 'terms':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#ede8df]">Terms of Service</h1>
            <div className="space-y-4 text-[#c7b8a8] leading-relaxed">
              <p>Welcome to Odubo Studio. These Terms of Service ("Terms") govern your access to and use of the Odubo Studio website and services.</p>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Acceptance of Terms</h2>
                <p>By accessing or using our services, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to these terms, please do not use our services.</p>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Use of Services</h2>
                <p>You may use our services only in compliance with these Terms and all applicable laws and regulations. You agree not to misuse our services or help anyone else do so.</p>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Intellectual Property</h2>
                <p>All content and materials available on our website, including but not limited to text, graphics, logos, images, audio, video, and software, are the property of Odubo Studio and are protected by intellectual property laws.</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Limitation of Liability</h2>
                <p>Odubo Studio shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of our services.</p>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Contact Information</h2>
                <p>Questions about the Terms of Service should be sent to us at <span className="text-[#ede8df]">legal@odubo.studio</span>.</p>
              </div>
            </div>
          </div>
        );

      case 'shipping':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#ede8df]">Shipping & Returns</h1>
            <div className="space-y-4 text-[#c7b8a8] leading-relaxed">
              <p>We are a small studio, and many items are crafted with care. Here's what you need to know about shipping and returns:</p>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Processing Time</h2>
                <p>Orders are typically processed within 1-3 business days. During high-volume periods or for custom items, processing may take longer.</p>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Shipping Options</h2>
                <p>We offer standard and expedited shipping options. Shipping times vary based on your location. You will receive tracking information once your order ships.</p>
              </div>

              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">International Shipping</h2>
                <p>We ship internationally to select countries. International customers are responsible for any customs duties or import taxes.</p>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Returns</h2>
                <p>We accept returns within 30 days of delivery for most items in original, unworn condition with tags attached. Custom or personalized items are final sale.</p>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Exchanges</h2>
                <p>We're happy to exchange items for different sizes or colors when available. Contact us to arrange an exchange.</p>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mt-6 mb-3 text-[#ede8df]">Questions?</h2>
                <p>Contact our support team at <span className="text-[#ede8df]">baad@odubo.studio</span> for any shipping or returns questions.</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Legal Information">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Close button */}
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 z-10 text-[#0b0b0b] bg-[#f8f2ea] hover:bg-white rounded-full p-2.5 border border-white/60 shadow-2xl transition-colors"
            style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="absolute inset-0 flex items-center justify-center overflow-y-auto"
            style={{
              paddingTop: 'calc(60px + env(safe-area-inset-top, 0px))',
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(1rem, env(safe-area-inset-left, 16px))',
              paddingRight: 'max(1rem, env(safe-area-inset-right, 16px))',
            }}
          >
            <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="rounded-2xl sm:rounded-3xl glass-surface border border-white/10 bg-[#0f0b0b]/95 shadow-[0_30px_120px_rgba(0,0,0,0.45)] overflow-hidden">
                {/* Tab Switcher */}
                <div className="p-4 sm:p-6 border-b border-white/10">
                  <div className="flex gap-1 p-1 rounded-xl bg-black/40 border border-white/5">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                          activeTab === tab.key
                            ? 'bg-[#843c2d] text-[#f8f2ea] shadow-lg'
                            : 'text-[#b2a491] hover:text-[#ede8df] hover:bg-white/5'
                        }`}
                        onClick={() => setActiveTab(tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 sm:p-6 max-h-[60vh] overflow-y-auto">
                  {renderContent()}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-white/10 text-center">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">
                    © {new Date().getFullYear()} B.A.A.D@Odubo
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
