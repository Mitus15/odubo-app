'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { ecommerce } from '@/components/analytics/GoogleAnalytics';

interface EmailCaptureContextValue {
  // Modal state
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;

  // Subscription state
  hasSubscribed: boolean;
  subscribedEmail: string | null;

  // Subscribe action
  subscribe: (email: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  isSubmitting: boolean;

  // Incentive tracking
  discountCode: string | null;
}

const EmailCaptureContext = createContext<EmailCaptureContextValue | null>(null);

const STORAGE_KEY = 'email-capture-status';
const MODAL_DELAY_MS = 15000; // Show modal after 15 seconds on site
const DISMISS_COOLDOWN_DAYS = 7; // Don't show again for 7 days after dismiss

interface StorageData {
  subscribed: boolean;
  email: string | null;
  discountCode: string | null;
  dismissedAt: number | null;
}

export function EmailCaptureProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSubscribed, setHasSubscribed] = useState(false);
  const [subscribedEmail, setSubscribedEmail] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasShownAuto, setHasShownAuto] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: StorageData = JSON.parse(raw);
        setHasSubscribed(data.subscribed);
        setSubscribedEmail(data.email);
        setDiscountCode(data.discountCode);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Auto-show modal after delay (only once per session, respects cooldown)
  useEffect(() => {
    if (hasSubscribed || hasShownAuto) return;

    // Check if user dismissed recently
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: StorageData = JSON.parse(raw);
        if (data.dismissedAt) {
          const daysSinceDismiss = (Date.now() - data.dismissedAt) / (1000 * 60 * 60 * 24);
          if (daysSinceDismiss < DISMISS_COOLDOWN_DAYS) {
            return; // Still in cooldown
          }
        }
      }
    } catch {
      // Ignore
    }

    const timer = setTimeout(() => {
      setIsOpen(true);
      setHasShownAuto(true);
    }, MODAL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [hasSubscribed, hasShownAuto]);

  const openModal = useCallback(() => {
    if (!hasSubscribed) {
      setIsOpen(true);
    }
  }, [hasSubscribed]);

  const closeModal = useCallback(() => {
    setIsOpen(false);

    // Record dismissal time for cooldown
    if (!hasSubscribed) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const data: StorageData = raw ? JSON.parse(raw) : {
          subscribed: false,
          email: null,
          discountCode: null,
          dismissedAt: null,
        };
        data.dismissedAt = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Ignore
      }
    }
  }, [hasSubscribed]);

  const subscribe = useCallback(async (email: string, name?: string): Promise<{ success: boolean; error?: string }> => {
    setIsSubmitting(true);

    interface SubscribeResponse {
      success?: boolean;
      error?: string;
      discountCode?: string;
      alreadySubscribed?: boolean;
    }

    try {
      const res = await fetch('/api/email/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });

      const data = (await res.json()) as SubscribeResponse;

      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to subscribe' };
      }

      // Update state
      setHasSubscribed(true);
      setSubscribedEmail(email);
      setDiscountCode(data.discountCode || null);

      // Track in GA4
      ecommerce.signUp('email_popup');

      // Persist to localStorage
      const storageData: StorageData = {
        subscribed: true,
        email,
        discountCode: data.discountCode || null,
        dismissedAt: null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return (
    <EmailCaptureContext.Provider
      value={{
        isOpen,
        openModal,
        closeModal,
        hasSubscribed,
        subscribedEmail,
        subscribe,
        isSubmitting,
        discountCode,
      }}
    >
      {children}
    </EmailCaptureContext.Provider>
  );
}

export function useEmailCapture() {
  const context = useContext(EmailCaptureContext);
  if (!context) {
    throw new Error('useEmailCapture must be used within an EmailCaptureProvider');
  }
  return context;
}
