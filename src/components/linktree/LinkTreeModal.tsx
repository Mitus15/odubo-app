'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { LinkTreeItem } from '@/types/linktree';
import { useOmniShop } from '@/contexts/OmniShopContext';
import { useStore } from '@/contexts/StoreContext';
import { useEmailCapture } from '@/contexts/EmailCaptureContext';
import ContactModal from '@/components/store/ContactModal';
import PlatformIcon from '@/components/linktree/PlatformIcon';
import LegalModal from '@/components/store/LegalModal';

interface LinkTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LinkTreeModal({ isOpen, onClose }: LinkTreeModalProps) {
  const [links, setLinks] = useState<LinkTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const { storeAccessible: legacyStoreAccessible, checkingStoreAccess: legacyCheckingAccess, closeAll: closeAllShopModals } = useOmniShop();
  const { openStore, isStoreAccessible, isCheckingAccess } = useStore();
  const { hasSubscribed, subscribe, isSubmitting } = useEmailCapture();

  // Footer modal state
  const [contactOpen, setContactOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);

  // Email capture form state
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Sync success state with context (e.g., already subscribed from previous session)
  useEffect(() => {
    if (hasSubscribed) setEmailSuccess(true);
  }, [hasSubscribed]);

  const handleEmailSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    if (!email.trim()) return;

    const result = await subscribe(email.trim());
    if (result.success) {
      setEmailSuccess(true);
    } else {
      setEmailError(result.error || 'Something went wrong');
    }
  }, [email, subscribe]);

  const handleVisitShop = useCallback(() => {
    onClose();
    closeAllShopModals();
    openStore();
  }, [onClose, closeAllShopModals, openStore]);

  // Use new store values with fallback to legacy
  const storeAccessible = isStoreAccessible || legacyStoreAccessible;
  const checkingStoreAccess = isCheckingAccess && legacyCheckingAccess;

  // Wait for client-side mount for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/linktree')
        .then(res => res.json())
        .then(data => setLinks((data as { links?: LinkTreeItem[] }).links || []))
        .catch(() => setLinks([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  // Filter and sort links
  const visibleLinks = useMemo(() => {
    let filtered = links;

    // Filter out store links when store is not accessible
    if (!checkingStoreAccess && !storeAccessible) {
      filtered = links.filter(link => link.platform !== 'shopify' && link.platform !== 'odubo');
    }

    // Custom sort: Store first, YouTube second, then rest in original order
    const platformPriority: Record<string, number> = {
      'shopify': 0,
      'odubo': 0,
      'youtube': 1,
    };

    return [...filtered].sort((a, b) => {
      const priorityA = platformPriority[a.platform || ''] ?? 99;
      const priorityB = platformPriority[b.platform || ''] ?? 99;
      return priorityA - priorityB;
    });
  }, [links, storeAccessible, checkingStoreAccess]);

  if (!mounted) return null;

  const handleLinkClick = (link: LinkTreeItem) => {
    fetch(`/api/linktree/${link.id}`, { method: 'POST' }).catch(() => {});

    // Special handling for shopify/odubo store link - close this modal and open new Store
    if (link.platform === 'shopify' || link.platform === 'odubo') {
      onClose();
      closeAllShopModals();
      openStore();
      return;
    }

    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  // Use portal with AnimatePresence for enter/exit animation
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col"
          initial={{
            opacity: 0,
            scale: 0.3,
            borderRadius: '24px',
            transformOrigin: 'bottom left',
          }}
          animate={{
            opacity: 1,
            scale: 1,
            borderRadius: '0px',
            transformOrigin: 'bottom left',
          }}
          exit={{
            opacity: 0,
            scale: 0.3,
            borderRadius: '24px',
            transformOrigin: 'bottom left',
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 35,
            mass: 0.8,
          }}
          style={{
            background: 'linear-gradient(145deg, #1a1714 0%, #0d0c0a 50%, #1a1714 100%)',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
          }}
        >
          {/* Subtle noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }} />

          {/* Close button — top right */}
          <motion.div
            className="relative flex items-center justify-end px-5 pt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.25 }}
          >
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-[#ede8df]/60 hover:text-[#ede8df] hover:bg-white/10 transition-all active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>

          {/* Content — shifted up from center */}
          <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ paddingBottom: '4vh' }}>
            {/* Brand mark */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="mb-7 lg:mb-10"
            >
              <img
                 src="/brand-logos/Danceman_Logo_Red.png"
                alt="Odubo Studio"
                className="w-20 h-20 lg:w-36 lg:h-36 object-contain opacity-40"
                draggable={false}
              />
            </motion.div>

            {/* Icon grid — 2 columns */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-[#843c2d]/30 border-t-[#843c2d] rounded-full animate-spin" />
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-2 gap-3 lg:gap-5 w-full max-w-[220px] lg:max-w-[360px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.3 }}
              >
                {visibleLinks.map((link, index) => (
                  <motion.button
                    key={link.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 + index * 0.04, type: 'spring', stiffness: 500, damping: 30 }}
                    onClick={() => handleLinkClick(link)}
                    className="group flex flex-col items-center justify-center aspect-square rounded-xl transition-all duration-200 active:scale-95"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    title={link.title}
                  >
                    <div className="w-6 h-6 lg:w-10 lg:h-10 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                      <PlatformIcon platform={link.platform ?? null} />
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* Email Capture — centered below icons */}
            {!loading && (
              <motion.div
                className="mt-7 lg:mt-10 w-full max-w-[220px] lg:max-w-[360px]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.3 }}
              >
                {emailSuccess ? (
                  <div className="text-center space-y-3">
                    <p className="text-[#ede8df]/40 text-xs">You&rsquo;re in. Check your email.</p>
                    <button
                      onClick={handleVisitShop}
                      className="mt-1 px-5 py-2 rounded-full text-xs font-medium text-[#ede8df]/80 transition-all active:scale-95 bg-white/5 border border-white/10 hover:bg-white/10"
                    >
                      Visit Shop
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleEmailSubmit} className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                      placeholder="Your email"
                      required
                      className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-[#ede8df] text-sm placeholder:text-[#ede8df]/25 outline-none focus:border-[#843c2d]/40 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#ede8df]/80 transition-all active:scale-95 disabled:opacity-50 bg-white/5 border border-white/8 hover:bg-white/10"
                    >
                      {isSubmitting ? '...' : 'Join'}
                    </button>
                  </form>
                )}
                {emailError && (
                  <p className="mt-2 text-xs text-red-400/70 text-center">{emailError}</p>
                )}
              </motion.div>
            )}
          </div>

          {/* Footer — Contact Us + Privacy Policy */}
          <motion.div
            className="px-6 pb-4 pt-2 flex items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            <button
              onClick={() => setContactOpen(true)}
              className="text-[11px] text-[#ede8df]/30 hover:text-[#ede8df]/60 transition-colors tracking-wide"
            >
              Contact Us
            </button>
            <span className="text-[#ede8df]/15">|</span>
            <button
              onClick={() => setLegalOpen(true)}
              className="text-[11px] text-[#ede8df]/30 hover:text-[#ede8df]/60 transition-colors tracking-wide"
            >
              Privacy Policy
            </button>
          </motion.div>

          {/* Contact & Legal modals */}
          <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
          <LegalModal isOpen={legalOpen} onClose={() => setLegalOpen(false)} initialTab="privacy" />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
