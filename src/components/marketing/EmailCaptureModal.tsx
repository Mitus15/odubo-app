'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEmailCapture } from '@/contexts/EmailCaptureContext';

export default function EmailCaptureModal() {
  const router = useRouter();
  const {
    isOpen,
    closeModal,
    subscribe,
    isSubmitting,
    hasSubscribed,
    discountCode,
  } = useEmailCapture();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus email input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setName('');
      setError(null);
      setShowSuccess(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    const result = await subscribe(email.trim(), name.trim() || undefined);

    if (result.success) {
      setShowSuccess(true);
    } else {
      setError(result.error || 'Something went wrong');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeModal]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="glass-surface border border-white/10 rounded-2xl max-w-md w-full overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {showSuccess ? (
              // Success state
              <div className="p-8 text-center">
                <div className="text-5xl mb-4">✨</div>
                <h2 className="text-2xl font-semibold text-[#ede8df] mb-2">
                  Check Your Email
                </h2>
                <p className="text-stone-300 mb-6">
                  Your code is waiting.
                </p>

                {discountCode && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                    <p className="text-sm text-stone-400 mb-1">Your exclusive code</p>
                    <p className="text-2xl font-mono font-bold text-[#d2a79a] tracking-wider">
                      {discountCode}
                    </p>
                    <p className="text-xs text-stone-500 mt-2">
                      10% off. First order.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => {
                    router.push('/store');
                    closeModal();
                  }}
                  className="w-full px-6 py-3 bg-[#843c2d] text-white rounded-xl hover:bg-[#6f2f23] transition-colors font-medium"
                >
                  Visit Shop
                </button>
              </div>
            ) : (
              // Form state
              <div className="p-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <input
                      ref={inputRef}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your email"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[#ede8df] placeholder-stone-500 focus:outline-none focus:border-[#843c2d] focus:ring-1 focus:ring-[#843c2d] transition-colors"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name (optional)"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[#ede8df] placeholder-stone-500 focus:outline-none focus:border-[#843c2d] focus:ring-1 focus:ring-[#843c2d] transition-colors"
                      disabled={isSubmitting}
                    />
                  </div>

                  {error && (
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full px-6 py-3 bg-[#843c2d] text-white rounded-xl hover:bg-[#6f2f23] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Joining...
                      </span>
                    ) : (
                      "Let's go"
                    )}
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
