let HlsCtor: any = null;

async function ensureHls() {
  if (typeof window === 'undefined') return null;
  if (HlsCtor) return HlsCtor;
  try {
    // Dynamic import to avoid SSR issues
    const mod = await import('hls.js');
    HlsCtor = (mod as any).default || (mod as any);
  } catch {}
  return HlsCtor;
}

export type HlsHandle = {
  destroy: () => void;
};

export async function attachHls(video: HTMLVideoElement, src: string, preloadOnly: boolean = false): Promise<HlsHandle | null> {
  // Native HLS (Safari/iOS)
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
    return { destroy: () => { try { video.removeAttribute('src'); video.load(); } catch {} } };
  }
  const Hls = await ensureHls();
  if (!Hls || !Hls.isSupported?.()) {
    // Fallback: set src directly (may work for MP4 or if browser supports HLS)
    video.src = src;
    return { destroy: () => { try { video.removeAttribute('src'); video.load(); } catch {} } };
  }
  // Adaptive buffering: smaller buffers for preload, network-aware for active playback
  const connection = (navigator as any)?.connection;
  const effectiveType = connection?.effectiveType || '4g';
  const isSlow = effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';
  
  // TikTok's Secret: Get cached quality preference for warm start
  const getCachedQuality = (): number => {
    try {
      const cached = localStorage.getItem('clips:preferred-quality');
      if (cached) {
        const { level, timestamp } = JSON.parse(cached);
        // Use cached if < 1 hour old and not preload
        if (!preloadOnly && Date.now() - timestamp < 3600000) {
          return level;
        }
      }
    } catch {}
    return 0; // Always start at lowest for instant playback
  };
  
  const hls = new Hls({
    // TikTok Strategy: Start at lowest quality for INSTANT playback
    lowLatencyMode: true,
    startLevel: getCachedQuality(), // Start low, upgrade fast
    
    // AGGRESSIVE quality upgrade (TikTok-style)
    abrEwmaFastLive: 1.0, // Upgrade quality faster (was 2.0)
    abrEwmaSlowLive: 9.0,
    abrMaxWithRealBitrate: true, // Use measured bandwidth
    abrEwmaDefaultEstimate: 500000, // ~0.5 Mbps starting point
    
    // MINIMAL buffers for short-form video
    maxBufferLength: preloadOnly ? 2 : (isSlow ? 3 : 4), // Reduced from 3/4/8
    maxMaxBufferLength: preloadOnly ? 4 : (isSlow ? 6 : 8), // Reduced from 6/8/12
    maxBufferSize: 10 * 1000 * 1000, // 10MB max buffer size (prevent memory bloat)
    
    // Cap initial bitrate to avoid stalls
    capLevelToPlayerSize: true,
    
    // INSTANT start - fail fast if network is slow
    manifestLoadingTimeOut: 2000, // 2s timeout for manifest (was infinite)
    levelLoadingTimeOut: 2000, // 2s timeout for quality playlist
    fragLoadingTimeOut: 3000, // 3s timeout for segments
    
    // Reduce latency by loading small fragments quickly
    fragLoadPolicy: {
      default: {
        maxTimeToFirstByteMs: isSlow ? 1200 : 800,
        maxLoadDurationMs: isSlow ? 1500 : 1000,
      },
    } as any,
  });
  hls.loadSource(src);
  hls.attachMedia(video);
  
  // Cache quality preference for warm-start on next video
  if (!preloadOnly) {
    hls.on((Hls as any).Events.LEVEL_SWITCHED, (_event: any, data: any) => {
      try {
        localStorage.setItem('clips:preferred-quality', JSON.stringify({
          level: data.level,
          timestamp: Date.now()
        }));
      } catch {}
    });
  }
  
  // Resilient error handling
  hls.on((Hls as any).Events.ERROR, (_event: any, data: any) => {
    if (data?.fatal) {
      try { hls.destroy(); } catch {}
      // Fallback: try native or direct src
      try { video.src = src; } catch {}
    }
  });
  return { destroy: () => { try { hls.destroy(); } catch {} } };
}
