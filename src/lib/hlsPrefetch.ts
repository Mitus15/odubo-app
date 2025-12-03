/**
 * HLS Prefetching Utilities for TikTok-Speed Video Delivery
 * 
 * Prefetches HLS manifests and first video segments to achieve
 * instant playback on scroll.
 */

/**
 * Prefetch the first video segment from an HLS manifest
 * This loads the first 2-6 seconds of video into browser cache
 * before the user scrolls to it.
 */
export async function prefetchFirstSegment(hlsUrl: string): Promise<void> {
  try {
    // Fetch manifest with low priority (don't block active video)
    const manifestRes = await fetch(hlsUrl, { 
      priority: 'low' as any,
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!manifestRes.ok) return;
    
    const manifestText = await manifestRes.text();
    
    // Parse HLS manifest for first segment URL
    const lines = manifestText.split('\n');
    let firstSegmentUrl = '';
    let baseUrl = hlsUrl.substring(0, hlsUrl.lastIndexOf('/') + 1);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip comments and metadata
      if (line.startsWith('#')) continue;
      
      // Find first .ts or .m4s segment
      if (line.endsWith('.ts') || line.endsWith('.m4s') || line.includes('.m3u8')) {
        // Resolve relative URL
        firstSegmentUrl = line.startsWith('http') ? line : baseUrl + line;
        
        // If it's a nested playlist (multi-bitrate), fetch that and find first segment
        if (firstSegmentUrl.endsWith('.m3u8')) {
          const nestedRes = await fetch(firstSegmentUrl, { priority: 'low' as any, mode: 'cors' });
          if (nestedRes.ok) {
            const nestedText = await nestedRes.text();
            const nestedLines = nestedText.split('\n');
            const nestedBase = firstSegmentUrl.substring(0, firstSegmentUrl.lastIndexOf('/') + 1);
            
            for (const nLine of nestedLines) {
              const trimmed = nLine.trim();
              if (trimmed.startsWith('#')) continue;
              if (trimmed.endsWith('.ts') || trimmed.endsWith('.m4s')) {
                firstSegmentUrl = trimmed.startsWith('http') ? trimmed : nestedBase + trimmed;
                break;
              }
            }
          }
        }
        break;
      }
    }
    
    if (firstSegmentUrl && !firstSegmentUrl.endsWith('.m3u8')) {
      // Prefetch the actual video segment into browser cache
      fetch(firstSegmentUrl, { 
        priority: 'low' as any,
        mode: 'cors',
        credentials: 'omit'
      }).catch(() => {}); // Silent fail - prefetch is best-effort
    }
  } catch (e) {
    // Silent fail - prefetch is best-effort, don't break the app
  }
}

/**
 * Prefetch HLS manifest only (lighter than full segment)
 * Useful for prefetching multiple videos ahead
 */
export async function prefetchManifest(hlsUrl: string): Promise<void> {
  try {
    await fetch(hlsUrl, { 
      priority: 'low' as any,
      mode: 'cors',
      credentials: 'omit'
    });
  } catch (e) {
    // Silent fail
  }
}

/**
 * Create link prefetch hints for next videos
 * This tells the browser to prefetch resources in the background
 */
export function addPrefetchHints(hlsUrls: string[]): void {
  // Remove old prefetch hints
  document.querySelectorAll('link[data-clip-prefetch]').forEach(el => el.remove());
  
  // Add new prefetch hints for next videos
  hlsUrls.forEach((url, index) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = 'fetch';
    link.crossOrigin = 'anonymous';
    link.dataset.clipPrefetch = 'true';
    link.dataset.prefetchIndex = String(index);
    document.head.appendChild(link);
  });
}

/**
 * Remove all prefetch hints (cleanup on unmount)
 */
export function removePrefetchHints(): void {
  document.querySelectorAll('link[data-clip-prefetch]').forEach(el => el.remove());
}

/**
 * Clear Service Worker HLS cache
 * Useful for debugging or forcing fresh content
 */
export async function clearHlsCache(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return false;
    
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event: MessageEvent) => {
        resolve(event.data.success || false);
      };
      
      reg.active!.postMessage({ type: 'CLEAR_CACHE' }, [messageChannel.port2]);
      
      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000);
    });
  } catch (e) {
    console.error('Failed to clear HLS cache:', e);
    return false;
  }
}
