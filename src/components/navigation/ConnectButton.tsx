'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LinkTreeModal from '@/components/linktree/LinkTreeModal';
import { useEmailCapture } from '@/contexts/EmailCaptureContext';

interface ConnectButtonProps {
  /** External control to open Connect page (e.g., from URL route) */
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
  /** Suppress auto-trigger while welcome/intro is showing */
  suppressAutoTrigger?: boolean;
  /** Hide the fixed button (for when it's triggered from another component like ClipsHeader) */
  hideButton?: boolean;
  /** Callback to let parent trigger the connect modal open */
  onConnectOpen?: (openFn: () => void) => void;
}

/**
 * ConnectButton — Always-visible persistent button for the Connect page.
 *
 * Positioned top-right, below the mute button.
 * Tapping opens the Connect page (LinkTreeModal) which animates from this button.
 * Also auto-opens when EmailCaptureContext triggers (after welcome is dismissed).
 */
export default function ConnectButton({ externalOpen, onExternalOpenHandled, suppressAutoTrigger, hideButton, onConnectOpen }: ConnectButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { isOpen: emailAutoTrigger, closeModal: dismissEmailTrigger } = useEmailCapture();

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Expose the open function to parent so external triggers (e.g. ClipsHeader) can open the modal
  useEffect(() => {
    if (onConnectOpen) {
      onConnectOpen(handleOpen);
    }
  }, [onConnectOpen, handleOpen]);

  return (
    <>
      {/* Persistent Connect button — top-right, below mute. Hidden when hideButton is true. */}
      <AnimatePresence>
        {!isOpen && !hideButton && (
          <motion.button
            ref={buttonRef}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={handleOpen}
            className="fixed z-40 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white shadow-lg active:scale-90 transition-transform right-4 md:right-16"
            style={{
              top: 'calc(max(env(safe-area-inset-top, 12px), 12px) + 52px)',
              width: 44,
              height: 44,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label="Connect"
          >
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Connect page (LinkTree modal) */}
      <LinkTreeModal isOpen={isOpen} onClose={handleClose} />
    </>
  );
}
