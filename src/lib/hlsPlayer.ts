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
  /**
   * A room's stream, on screen or beside it: on screen it keeps its half
   * minute ahead; beside it, only its first seconds, so the one on screen has
   * the line. The browser's own player decides this for itself.
   */
  onScreen?: (on: boolean) => void;
};

// Track active HLS instances to prevent memory leaks
const activeInstances = new WeakMap<HTMLVideoElement, any>();

/**
 * A room's copy is one long piece, looped: it keeps half a minute ahead, so a
 * dip in the line never stops him. The clips' few seconds (getHLSBufferConfig:
 * 3 on a phone) were made for a feed swiped through, and froze a room on the
 * first weak patch of wifi (2026-10-27). Half a minute of a copy is ~3 MB.
 */
const ROOM_BUFFER = { maxBufferLength: 30, maxMaxBufferLength: 30, maxBufferSize: 60 * 1000 * 1000 };
/** A room beside the one on screen: one fragment, its start, ready for the swipe */
const ROOM_BESIDE_S = 4;

export type HlsOptions = {
  /**
   * The rooms: start at the level that fills the player instead of the
   * lowest, since a sharp still covers the wait (components/room/RoomVideo).
   * The bitrate logic takes over after the first fragment, and the clips'
   * remembered quality is left alone. A room's manifest holds only its sharp
   * levels (lib/streams), so the lowest it can fall to is 720p.
   */
  sharp?: boolean;
  /** Seconds in to start from (the room's still is that moment: lib/sampler), the first time it plays; it loops from the top after */
  startAt?: number;
};

export async function attachHls(video: HTMLVideoElement, src: string, preloadOnly: boolean = false, opts: HlsOptions = {}): Promise<HlsHandle | null> {
  // Cleanup any existing instance on this video element
  const existing = activeInstances.get(video);
  if (existing) {
    try { existing.destroy(); } catch {}
    activeInstances.delete(video);
  }

  // Native HLS (Safari/iOS) - most reliable for autoplay. Chrome plays HLS natively now too, but starts on
  // the lowest rendition (240p on a room's copy, 2026-10-27), so where sharpness is asked for, only Apple's
  // player (which starts on the first, tallest, rendition) is used natively; elsewhere hls.js picks the start.
  const applePlayer = typeof navigator !== 'undefined' && /apple/i.test(navigator.vendor || '');
  const startAt = opts.startAt && opts.startAt > 0 ? opts.startAt : 0;
  const seekOnce = () => {
    if (!startAt) return;
    video.addEventListener('loadedmetadata', () => { try { if (video.currentTime < startAt) video.currentTime = startAt; } catch {} }, { once: true });
  };
  if ((!opts.sharp || applePlayer) && video.canPlayType('application/vnd.apple.mpegurl')) {
    // Already started from the page itself, before any script (RoomVideo's `early`): taken over as it is
    if (video.getAttribute('src') !== src) {
      seekOnce();
      video.src = src;
      // Pre-load for faster start
      video.load();
    }
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
  if ((!Hls || !Hls.isSupported?.()) && video.canPlayType('application/vnd.apple.mpegurl')) {
    // No MediaSource for hls.js: the browser's own player after all
    seekOnce();
    video.src = src;
    video.load();
    return {
      destroy: () => { try { video.pause(); video.removeAttribute('src'); video.load(); } catch {} },
      isActive: () => !!video.src
    };
  }
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
  const bufferConfig = opts.sharp && !preloadOnly ? ROOM_BUFFER : getHLSBufferConfig(preloadOnly);
  // The clips cap at the third level on a guessed-slow line. A room's copy is light (its tallest level is
  // ~1 Mbps), so a room is never capped by the guess; its start is held to what the line carries (below)
  const { saveData } = getNetworkInfo();
  const autoCap = opts.sharp ? (saveData ? 1 : -1) : isSlowNetwork || downlink < 3 ? 2 : -1;
  
  // TikTok's Secret: Get cached quality preference for warm start
  // Enhanced with connection-aware initial quality
  const getCachedQuality = (): number => {
    // For preload, always use lowest quality
    if (preloadOnly) return 0;

    // Try cached preference first (from previous videos in session)
    try {
      const cached = localStorage.getItem('clips:preferred-quality');
      if (cached) {
        const { level, timestamp } = JSON.parse(cached);
        // Use cached if < 30 min old (reduced from 1 hour for fresher estimates)
        if (Date.now() - timestamp < 1800000) {
          return Math.min(level, 2); // Cap at level 2 to avoid stalls
        }
      }
    } catch {}

    // Network-aware initial quality for cold start
    const { effectiveType, downlink } = getNetworkInfo();

    // On great connections (wifi/5G), start at level 1 for better quality faster
    if (effectiveType === '4g' && downlink >= 5) {
      return 1; // Medium quality - good balance of speed and quality
    }

    // Default: lowest quality for instant start on slower networks
    return 0;
  };
  
  const hls = new Hls({
    // TikTok Strategy: Start at lowest quality for INSTANT playback
    lowLatencyMode: true,
    startLevel: getCachedQuality(), // Start low, upgrade fast
    // A room waits for the manifest to pick its own start (below), then loads
    autoStartLoad: !opts.sharp,

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

    // Faster timeouts for snappy experience. A room gets hls.js's own: its still covers the wait, and the
    // clips' 3 s gave up on a manifest that was slow to come over a weak line, four tries and nothing (2026-10-28)
    manifestLoadingTimeOut: opts.sharp ? 10000 : 3000,
    levelLoadingTimeOut: opts.sharp ? 10000 : 3000,
    fragLoadingTimeOut: opts.sharp ? 20000 : 4000,

    // More aggressive retry for reliability
    manifestLoadingMaxRetry: 3,
    levelLoadingMaxRetry: 3,
    fragLoadingMaxRetry: 4,

    // Reduce latency by loading small fragments quickly. Not in a room: there a sharp first fragment is
    // worth its wait (the still covers it), and a 1.5 s limit dropped it to 240p (2026-10-27)
    ...(opts.sharp
      ? {}
      : {
          fragLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: isSlowNetwork ? 1500 : 1000,
              maxLoadDurationMs: isSlowNetwork ? 2000 : 1500,
            },
          } as any,
        }),
  });
  
  // Track this instance
  activeInstances.set(video, hls);

  if (opts.sharp) {
    hls.once((Hls as any).Events.MANIFEST_PARSED, (_event: any, data: any) => {
      const levels: { height: number; bitrate?: number }[] = data?.levels || [];
      if (!levels.length) return hls.startLoad(startAt || -1);
      // The smallest level at least as tall as the player on this screen, else the tallest (levels run low to high)
      const need = (video.clientHeight || 960) * (window.devicePixelRatio || 1);
      let pick = levels.findIndex((l) => l.height >= need);
      if (pick < 0) pick = levels.length - 1;
      // ...within what the line is thought to carry, when the browser says (Mbps, a rough guess, with room to spare)
      const carries = downlink > 0 ? downlink * 1e6 * 0.8 : Infinity;
      while (pick > 0 && (levels[pick].bitrate || 0) > carries) pick--;
      if (autoCap >= 0) pick = Math.min(pick, autoCap);
      try { hls.startLevel = pick; } catch {}
      hls.startLoad(startAt || -1);
    });
  }

  hls.loadSource(src);
  hls.attachMedia(video);
  
  // Cache quality preference for warm-start on next video
  if (!preloadOnly && !opts.sharp) {
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
      if (!opts.sharp && (detail === 'bufferStalledError' || detail === 'fragLoadError' || detail === 'fragLoadTimeout')) {
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
    isActive: () => activeInstances.has(video),
    // read by hls.js as it decides each next fragment, so a change takes hold at once
    onScreen: opts.sharp
      ? (on) => {
          hls.config.maxBufferLength = on ? bufferConfig.maxBufferLength : ROOM_BESIDE_S;
          hls.config.maxMaxBufferLength = on ? bufferConfig.maxMaxBufferLength : ROOM_BESIDE_S;
        }
      : undefined,
  };
}
