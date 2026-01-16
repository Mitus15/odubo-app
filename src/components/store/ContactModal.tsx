'use client';

import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type InquiryType = 'order' | 'refund' | 'shipping' | 'general';

interface FormData {
  name: string;
  email: string;
  orderNumber: string;
  inquiryType: InquiryType;
  message: string;
}

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    orderNumber: '',
    inquiryType: 'general',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Delay reset to allow exit animation
      const timer = setTimeout(() => {
        setFormData({
          name: '',
          email: '',
          orderNumber: '',
          inquiryType: 'general',
          message: '',
        });
        setStatus('idle');
        setErrorMessage('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const inquiryLabels: Record<InquiryType, string> = {
    order: 'Order Status',
    refund: 'Returns',
    shipping: 'Shipping',
    general: 'General',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Contact Us">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* Close button */}
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 z-50 text-[#0b0b0b] bg-[#f8f2ea] hover:bg-white rounded-full p-2.5 border border-white/60 shadow-2xl transition-colors"
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
              paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(1rem, env(safe-area-inset-left, 16px))',
              paddingRight: 'max(1rem, env(safe-area-inset-right, 16px))',
            }}
          >
            <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <div className="rounded-2xl sm:rounded-3xl glass-surface border border-white/10 bg-[#0f0b0b]/95 shadow-[0_30px_120px_rgba(0,0,0,0.45)] overflow-hidden">
                <div className="p-5 sm:p-6 text-[#ede8df]">
                  {/* Header */}
                  <div className="text-center mb-6">
                    <h2 className="text-xl sm:text-2xl font-serif font-medium mb-2">Contact Us</h2>
                    <p className="text-sm text-[#b2a491]">
                      We'll get back to you within 24-48 hours.
                    </p>
                  </div>

                  {/* Success Message */}
                  {status === 'success' ? (
                    <div className="text-center py-8">
                      <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-[#ede8df] mb-2">Message Sent!</h3>
                      <p className="text-sm text-[#b2a491] mb-6">
                        We've received your message and will get back to you soon.
                      </p>
                      <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl bg-white/10 text-[#ede8df] hover:bg-white/15 transition-colors text-sm"
                      >
                        Close
                      </button>
                    </div>
                  ) : (
                    /* Contact Form */
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Name & Email Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="modal-name" className="block text-xs font-medium text-[#b2a491] mb-1.5">
                            Name
                          </label>
                          <input
                            type="text"
                            id="modal-name"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[#ede8df] placeholder-[#726d6c] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 focus:border-[#843c2d]/50 transition-colors"
                            placeholder="Your name"
                          />
                        </div>
                        <div>
                          <label htmlFor="modal-email" className="block text-xs font-medium text-[#b2a491] mb-1.5">
                            Email
                          </label>
                          <input
                            type="email"
                            id="modal-email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[#ede8df] placeholder-[#726d6c] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 focus:border-[#843c2d]/50 transition-colors"
                            placeholder="you@example.com"
                          />
                        </div>
                      </div>

                      {/* Order Number (optional) */}
                      <div>
                        <label htmlFor="modal-order" className="block text-xs font-medium text-[#b2a491] mb-1.5">
                          Order Number <span className="text-[#726d6c]">(optional)</span>
                        </label>
                        <input
                          type="text"
                          id="modal-order"
                          value={formData.orderNumber}
                          onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[#ede8df] placeholder-[#726d6c] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 focus:border-[#843c2d]/50 transition-colors"
                          placeholder="#1234"
                        />
                      </div>

                      {/* Inquiry Type */}
                      <div>
                        <label className="block text-xs font-medium text-[#b2a491] mb-1.5">
                          What can we help with?
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(inquiryLabels) as InquiryType[]).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFormData({ ...formData, inquiryType: type })}
                              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                                formData.inquiryType === type
                                  ? 'bg-[#843c2d]/30 border-[#843c2d]/50 text-[#ede8df]'
                                  : 'bg-white/5 border-white/10 text-[#b2a491] hover:bg-white/10'
                              } border`}
                            >
                              {inquiryLabels[type]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Message */}
                      <div>
                        <label htmlFor="modal-message" className="block text-xs font-medium text-[#b2a491] mb-1.5">
                          Message
                        </label>
                        <textarea
                          id="modal-message"
                          required
                          rows={4}
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[#ede8df] placeholder-[#726d6c] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 focus:border-[#843c2d]/50 transition-colors resize-none"
                          placeholder="Tell us how we can help..."
                        />
                      </div>

                      {/* Error Message */}
                      {status === 'error' && (
                        <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                          {errorMessage}
                        </div>
                      )}

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-[#ede8df] font-medium hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm"
                      >
                        {status === 'loading' ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Sending...
                          </span>
                        ) : (
                          'Send Message'
                        )}
                      </button>

                      {/* Email fallback */}
                      <p className="text-center text-[10px] text-[#726d6c] pt-2">
                        Or email us at{' '}
                        <a href="mailto:baad@odubo.studio" className="text-[#b2a491] hover:text-[#ede8df] transition-colors">
                          baad@odubo.studio
                        </a>
                      </p>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
