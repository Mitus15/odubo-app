'use client';

import { useEffect, useState } from 'react';

/**
 * Offline Indicator Component
 * 
 * Shows a banner when the user goes offline or has a poor connection.
 * Automatically hides when connection is restored.
 */
export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [isWeakConnection, setIsWeakConnection] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setDismissed(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection quality
    const conn = (navigator as any).connection;
    if (conn) {
      const checkConnection = () => {
        const isWeak = conn.saveData || 
          conn.effectiveType === 'slow-2g' || 
          conn.effectiveType === '2g' ||
          (conn.downlink && conn.downlink < 1);
        setIsWeakConnection(isWeak);
      };
      
      checkConnection();
      conn.addEventListener('change', checkConnection);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        conn.removeEventListener('change', checkConnection);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show if dismissed or online with good connection
  if (dismissed || (isOnline && !isWeakConnection)) return null;

  return (
    <div 
      className={`fixed top-14 left-0 right-0 z-50 px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium transition-all duration-300 ${
        !isOnline 
          ? 'bg-red-900/95 text-red-100 border-b border-red-800' 
          : 'bg-amber-900/95 text-amber-100 border-b border-amber-800'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656M6.343 6.343a8 8 0 000 11.314" />
              <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
            <span>You&apos;re offline. Some features may not work.</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Slow connection detected. Content may load slowly.</span>
          </>
        )}
      </div>
      
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
