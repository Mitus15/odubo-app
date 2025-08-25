"use client";

import { useEffect } from 'react';

export default function ClientCapabilities() {
  useEffect(() => {
    // Only run on client side after hydration
    try {
      const nav = navigator as any;
      const deviceMemory = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined;
      const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : undefined;
      const saveData = typeof nav.connection?.saveData === 'boolean' ? nav.connection.saveData : false;

      // Heuristics: <= 4 GB memory OR <= 4 cores OR Save-Data enabled
      if ((deviceMemory && deviceMemory <= 4) || (cores && cores <= 4) || saveData) {
        document.body.classList.add('reduced-effects');
      }
    } catch (error) {
      // Silently fail if any navigator APIs are not available
      console.warn('Client capabilities detection failed:', error);
    }
  }, []);

  // Always return null - no visual content, just side effects
  return null;
}


