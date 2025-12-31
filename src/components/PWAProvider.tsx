'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { isPWAStandalone } from '@/lib/deviceInfo';

interface PWAContextValue {
  /** True if app is running as installed PWA (no browser UI) */
  isStandalone: boolean;
  /** True if browser supports PWA install and app is installable */
  isInstallable: boolean;
  /** Deferred install prompt event (for triggering install) */
  deferredPrompt: any | null;
  /** Trigger the install prompt */
  promptInstall: () => Promise<boolean>;
}

const PWAContext = createContext<PWAContextValue>({
  isStandalone: false,
  isInstallable: false,
  deferredPrompt: null,
  promptInstall: async () => false,
});

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check standalone mode on mount
    setIsStandalone(isPWAStandalone());

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67+ from showing the mini-infobar
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for user choice
      const { outcome } = await deferredPrompt.userChoice;
      // Clear the deferred prompt
      setDeferredPrompt(null);
      setIsInstallable(false);
      return outcome === 'accepted';
    } catch {
      return false;
    }
  };

  return (
    <PWAContext.Provider value={{ isStandalone, isInstallable, deferredPrompt, promptInstall }}>
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA() {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
}
