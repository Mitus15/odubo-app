'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePWA } from './PWAProvider';

const STORAGE_KEY = 'odubo:pwa-banner-dismissed';

/**
 * Subtle install banner for PWA promotion.
 * Shows only when:
 * - App is not already installed (not standalone)
 * - App is installable (beforeinstallprompt fired)
 * - User hasn't dismissed the banner
 */
export default function PWAInstallBanner() {
  const { isStandalone, isInstallable, promptInstall } = usePWA();
  const [dismissed, setDismissed] = useState(true); // Start dismissed to prevent flash

  useEffect(() => {
    // Check if user previously dismissed
    try {
      const wasDismissed = localStorage.getItem(STORAGE_KEY);
      setDismissed(wasDismissed === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  };

  // Don't show if: already installed, not installable, or dismissed
  const shouldShow = !isStandalone && isInstallable && !dismissed;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-0 inset-x-0 z-50 safe-area-top pointer-events-none"
        >
          <div className="mx-4 mt-2 p-3 rounded-xl glass-surface border border-white/10 flex items-center justify-between gap-3 pointer-events-auto shadow-lg">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/odubo_logo_emboss.png"
                alt=""
                className="w-8 h-8 object-contain flex-shrink-0"
                draggable={false}
              />
              <p className="text-sm text-[#ede8df] truncate">
                Install Odubo for the best experience
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 text-xs font-medium bg-[#843c2d] text-white rounded-lg hover:bg-[#9a4535] transition-colors active:scale-95"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="p-1.5 text-[#726d6c] hover:text-[#ede8df] transition-colors"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
