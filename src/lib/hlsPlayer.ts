import { getDeviceInfo, getNetworkInfo, getHLSBufferConfig } from './deviceInfo';

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
  isActive: () => boolean;
};

// Track active HLS instances to prevent memory leaks
const activeInstances = new WeakMap<HTMLVideoElement, any>();

export async function attachHls(video: HTMLVideoElement, src: string, preloadOnly: boolean = false): Promise<HlsHandle | null> {
  // Cleanup any existing instance on this video element
  const existing = activeInstances.get(video);
  if (existing) {
    try { existing.destroy(); } catch {}
    activeInstances.delete(video);
  }

  // Native HLS (Safari/iOS) - most reliable for autoplay
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
    // Pre-load for faster start
    video.load();
    return {
      destroy: () => {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch {}
      },
      isActive: () => !!video.src
    };
  }

  const Hls = await ensureHls();
  if (!Hls || !Hls.isSupported?.()) {
    // Fallback: set src directly (may work for MP4 or if browser supports HLS)
    video.src = src;
    return {
      destroy: () => { try { video.removeAttribute('src'); video.load(); } catch {} },
      isActive: () => !!video.src
    };
  }

  // Use centralized device and network detection
  const { isMobile } = getDeviceInfo();
  const { isSlowNetwork, downlink } = getNetworkInfo();
  const bufferConfig = getHLSBufferConfig(preloadOnly);
  const autoCap = isSlowNetwork || downlink < 3 ? 2 : -1;
  
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

    // MINIMAL buffers for short-form video - optimized for seamless scrolling
    // Using centralized buffer config from deviceInfo
    maxBufferLength: bufferConfig.maxBufferLength,
    maxMaxBufferLength: bufferConfig.maxMaxBufferLength,
    maxBufferSize: bufferConfig.maxBufferSize,
    backBufferLength: 0, // No back buffer needed for clips

    // Cap initial bitrate to avoid stalls
    capLevelToPlayerSize: true,
    autoLevelCapping: autoCap,

    // Faster timeouts for snappy experience
    manifestLoadingTimeOut: 3000,
    levelLoadingTimeOut: 3000,
    fragLoadingTimeOut: 4000,

    // More aggressive retry for reliability
    manifestLoadingMaxRetry: 3,
    levelLoadingMaxRetry: 3,
    fragLoadingMaxRetry: 4,

    // Reduce latency by loading small fragments quickly
    fragLoadPolicy: {
      default: {
        maxTimeToFirstByteMs: isSlowNetwork ? 1500 : 1000,
        maxLoadDurationMs: isSlowNetwork ? 2000 : 1500,
      },
    } as any,
  });
  
  // Track this instance
  activeInstances.set(video, hls);
  
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
  
  // Resilient error handling with automatic recovery
  hls.on((Hls as any).Events.ERROR, (_event: any, data: any) => {
    try {
      if (data?.fatal) {
        // Try to recover from fatal errors
        if (data.type === 'networkError') {
          // Network error - try to recover
          hls.startLoad();
        } else if (data.type === 'mediaError') {
          // Media error - try to recover
          hls.recoverMediaError();
        } else {
          // Other fatal error - fallback to direct src
          try { hls.destroy(); } catch {}
          activeInstances.delete(video);
          try { video.src = src; } catch {}
        }
        return;
      }
      
      // On buffer stalls or fragment load issues, temporarily cap to lowest level
      const detail = data?.details || '';
      if (detail === 'bufferStalledError' || detail === 'fragLoadError' || detail === 'fragLoadTimeout') {
        try { (hls as any).currentLevel = 0; } catch {}
      }
    } catch {}
  });
  
  return { 
    destroy: () => { 
      try { 
        hls.destroy(); 
        activeInstances.delete(video);
      } catch {} 
    },
    isActive: () => activeInstances.has(video)
  };
}
