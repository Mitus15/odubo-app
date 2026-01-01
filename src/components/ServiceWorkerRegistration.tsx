'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration Component
 * 
 * Registers both the main service worker (sw.js) for offline support
 * and the clips service worker (clips-sw.js) for HLS caching.
 * 
 * Features:
 * - Automatic registration on mount
 * - Network quality detection
 * - Prefetching on good connections
 * - Update notification handling
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Only register in production or when explicitly enabled
    const shouldRegister = process.env.NODE_ENV === 'production' || 
      process.env.NEXT_PUBLIC_SW_DEV === 'true';
    
    if (!shouldRegister) {
      console.log('[SW] Skipping service worker registration in development');
      return;
    }

    // Register main service worker
    const registerMainSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none'
        });
        
        console.log('[SW] Main service worker registered:', registration.scope);

        // Check for updates periodically (every 30 minutes)
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              console.log('[SW] New version available');
              
              // Could dispatch a custom event for the app to show an update notification
              window.dispatchEvent(new CustomEvent('swUpdateAvailable', {
                detail: { registration }
              }));
            }
          });
        });
      } catch (err) {
        console.warn('[SW] Main service worker registration failed:', err);
      }
    };

    // DISABLED: Clips service worker was causing autoplay issues in production
    // The SW was intercepting HLS requests and returning cached/stale responses
    // that confused HLS.js state management. Native browser caching is sufficient.
    const registerClipsSW = async () => {
      // Unregister any existing clips-sw to clean up
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.scope.includes('/clips')) {
            await reg.unregister();
            console.log('[SW] Unregistered clips service worker');
          }
        }
      } catch (err) {
        // Ignore errors
      }
    };

    // Prefetch critical routes on good connections
    const prefetchCriticalRoutes = async () => {
      const conn = (navigator as any).connection;
      const effectiveType = conn?.effectiveType || '4g';
      const saveData = conn?.saveData || false;
      
      // Only prefetch on good connections
      if (saveData || (effectiveType !== '4g' && effectiveType !== '3g')) {
        return;
      }

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Send prefetch message
      navigator.serviceWorker.controller?.postMessage({
        type: 'PREFETCH_URLS',
        payload: {
          urls: [
            '/clips',
            '/media',
            '/store',
            '/api/clips?limit=10',
          ]
        }
      });
    };

    // Register main SW and cleanup clips SW
    // IMPORTANT: Unregister clips-sw FIRST before registering main SW
    registerClipsSW().then(() => {
      return registerMainSW();
    }).then(() => {
      prefetchCriticalRoutes();
    });

    // Cleanup function
    return () => {
      // No cleanup needed for service workers
    };
  }, []);

  // This component doesn't render anything
  return null;
}

/**
 * Helper hook to check if app is online
 */
export function useOnlineStatus() {
  if (typeof window === 'undefined') return true;
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Helper hook to get network quality
 */
export function useNetworkQuality() {
  if (typeof window === 'undefined') return { isWeak: false, effectiveType: '4g' };

  const [quality, setQuality] = useState(() => {
    const conn = (navigator as any).connection;
    return {
      isWeak: conn?.saveData || (conn?.effectiveType && conn.effectiveType !== '4g'),
      effectiveType: conn?.effectiveType || '4g',
      downlink: conn?.downlink || 10,
      rtt: conn?.rtt || 0
    };
  });

  useEffect(() => {
    const conn = (navigator as any).connection;
    if (!conn) return;

    const handleChange = () => {
      setQuality({
        isWeak: conn.saveData || conn.effectiveType !== '4g',
        effectiveType: conn.effectiveType || '4g',
        downlink: conn.downlink || 10,
        rtt: conn.rtt || 0
      });
    };

    conn.addEventListener('change', handleChange);
    return () => conn.removeEventListener('change', handleChange);
  }, []);

  return quality;
}

// Need this import for hooks
import { useState } from 'react';
