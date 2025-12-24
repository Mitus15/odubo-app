'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

type InquiryType = 'order' | 'refund' | 'shipping' | 'general';

interface FormData {
  name: string;
  email: string;
  orderNumber: string;
  inquiryType: InquiryType;
  message: string;
}

export default function ContactPage() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    orderNumber: '',
    inquiryType: 'general',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

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
      setFormData({
        name: '',
        email: '',
        orderNumber: '',
        inquiryType: 'general',
        message: '',
      });
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const inquiryLabels: Record<InquiryType, string> = {
    order: 'Order Status / Tracking',
    refund: 'Returns & Refunds',
    shipping: 'Shipping Question',
    general: 'General Inquiry',
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#302927] via-[#171616] to-[#302927] text-[#ede8df]">
      {/* Ambient light effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#843c2d]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-[#b2a491]/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12 sm:py-20">
        {/* Back link */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-[#b2a491] hover:text-[#ede8df] transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-serif font-medium mb-4">Contact Us</h1>
          <p className="text-[#b2a491] max-w-md mx-auto">
            Have a question about your order, need help with a return, or just want to say hi? 
            We're here to help.
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3 mb-10">
          <a
            href="https://account.odubo.studio"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-surface border border-[#502d26]/30 rounded-xl p-4 hover:border-[#843c2d]/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#843c2d]/20 flex items-center justify-center group-hover:bg-[#843c2d]/30 transition-colors">
                <svg className="w-5 h-5 text-[#843c2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-[#ede8df]">Order History</div>
                <div className="text-xs text-[#726d6c]">View via Shopify</div>
              </div>
            </div>
          </a>
          <a
            href="https://account.odubo.studio"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-surface border border-[#502d26]/30 rounded-xl p-4 hover:border-[#843c2d]/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#843c2d]/20 flex items-center justify-center group-hover:bg-[#843c2d]/30 transition-colors">
                <svg className="w-5 h-5 text-[#843c2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-[#ede8df]">Track Order</div>
                <div className="text-xs text-[#726d6c]">Check status</div>
              </div>
            </div>
          </a>
        </div>

        {/* Success Message */}
        {status === 'success' && (
          <div className="glass-surface border border-green-500/30 rounded-xl p-6 mb-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[#ede8df] mb-2">Message Sent!</h3>
            <p className="text-[#b2a491] text-sm">
              We've received your message and will get back to you within 24-48 hours.
            </p>
          </div>
        )}

        {/* Contact Form */}
        {status !== 'success' && (
          <form onSubmit={handleSubmit} className="glass-surface border border-[#502d26]/30 rounded-2xl p-6 sm:p-8">
            {/* Name */}
            <div className="mb-5">
              <label htmlFor="name" className="block text-sm font-medium text-[#b2a491] mb-2">
                Your Name
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] placeholder-[#726d6c] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 focus:border-[#843c2d]/50 transition-colors"
                placeholder="Jane Doe"
              />
            </div>

            {/* Email */}
            <div className="mb-5">
              <label htmlFor="email" className="block text-sm font-medium text-[#b2a491] mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] placeholder-[#726d6c] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 focus:border-[#843c2d]/50 transition-colors"
                placeholder="jane@example.com"
              />
            </div>

            {/* Order Number (optional) */}
            <div className="mb-5">
              <label htmlFor="orderNumber" className="block text-sm font-medium text-[#b2a491] mb-2">
                Order Number <span className="text-[#726d6c]">(optional)</span>
              </label>
              <input
                type="text"
                id="orderNumber"
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] placeholder-[#726d6c] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 focus:border-[#843c2d]/50 transition-colors"
                placeholder="#1234"
              />
            </div>

            {/* Inquiry Type */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[#b2a491] mb-2">
                What can we help with?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(inquiryLabels) as InquiryType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, inquiryType: type })}
                    className={`px-3 py-2.5 rounded-lg text-sm transition-all ${
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
            <div className="mb-6">
              <label htmlFor="message" className="block text-sm font-medium text-[#b2a491] mb-2">
                Message
              </label>
              <textarea
                id="message"
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[#ede8df] placeholder-[#726d6c] text-sm focus:outline-none focus:ring-2 focus:ring-[#843c2d]/50 focus:border-[#843c2d]/50 transition-colors resize-none"
                placeholder="Tell us how we can help..."
              />
            </div>

            {/* Error Message */}
            {status === 'error' && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {errorMessage}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#843c2d] to-[#6d3224] text-[#ede8df] font-medium hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
          </form>
        )}

        {/* Additional Contact Info */}
        <div className="mt-10 text-center text-sm text-[#726d6c]">
          <p className="mb-2">You can also reach us directly at:</p>
          <a href="mailto:support@odubo.com" className="text-[#b2a491] hover:text-[#ede8df] transition-colors">
            support@odubo.com
          </a>
        </div>
      </div>
    </div>
  );
}
