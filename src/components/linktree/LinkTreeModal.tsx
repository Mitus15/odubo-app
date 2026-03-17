'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { LinkTreeItem } from '@/types/linktree';
import { useOmniShop } from '@/contexts/OmniShopContext';
import { useStore } from '@/contexts/StoreContext';
import { useEmailCapture } from '@/contexts/EmailCaptureContext';
import ContactModal from '@/components/store/ContactModal';
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
      filtered = links.filter(link => link.platform !== 'shopify' && link.platform !== 'baad');
    }

    // Custom sort: Store first, YouTube second, then rest in original order
    const platformPriority: Record<string, number> = {
      'shopify': 0,
      'baad': 0,
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
    fetch(`/api/linktree/${link.id}/click`, { method: 'POST' }).catch(() => {});

    // Special handling for shopify/baad store link - close this modal and open new Store
    if (link.platform === 'shopify' || link.platform === 'baad') {
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
                src="/brand-logos/baad@odubo.png"
                alt="B.A.A.D @ Odubo.Studio"
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

function PlatformIcon({ platform }: { platform: string | null }) {
  const iconClass = "w-5 h-5 lg:w-8 lg:h-8";

  switch (platform) {
    case 'spotify':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} fill="#1DB954">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
      );
    case 'apple_music':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} fill="#FA2D48">
          <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.8.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.1-1.267-.315-.812-.09-1.79.574-2.306.37-.287.803-.46 1.26-.575.47-.118.944-.22 1.414-.337.25-.063.47-.18.59-.42.1-.19.12-.39.12-.59V8.76c0-.12-.02-.24-.09-.34-.1-.13-.24-.19-.4-.19-.18 0-.37.03-.55.07l-4.68 1.04c-.03 0-.06.01-.09.02-.35.07-.49.24-.52.6v7.69c0 .43-.06.85-.25 1.24-.3.59-.76.96-1.39 1.14-.35.1-.71.16-1.08.18-.96.04-1.8-.46-2.12-1.28-.31-.81-.09-1.78.58-2.3.37-.29.8-.46 1.26-.58.46-.12.93-.22 1.4-.34.26-.06.49-.19.6-.44.09-.18.11-.37.11-.57V7.13c0-.3.07-.58.27-.8.18-.2.4-.32.67-.38l6.32-1.41c.23-.05.46-.1.7-.13.3-.04.58.06.78.3.14.17.21.38.21.6v4.78z"/>
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} fill="#FF0000">
          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} fill="#E4405F">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" className={iconClass} fill="white">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
        </svg>
      );
    case 'shopify':
    case 'baad':
      return (
        <Image
          src="/brand-logos/baad-white.png"
          alt="BAAD"
          width={28}
          height={28}
          className={iconClass}
        />
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="white" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      );
  }
}
