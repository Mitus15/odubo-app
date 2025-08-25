/**
 * Enhanced Audio Streaming Utilities
 * Provides robust track fetching and streaming capabilities
 */

export interface TrackStreamInfo {
  id: string;
  title: string;
  audio_url: string;
  audio_status: 'pending' | 'ready' | 'error';
  duration: number;
  streamUrl: string;
}

/**
 * Fetches track information with streaming URLs
 */
export async function fetchTrackStreamInfo(trackId: string): Promise<TrackStreamInfo | null> {
  try {
    const response = await fetch(`/api/tracks/${trackId}`, {
      cache: 'no-store', // Always get fresh data
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch track ${trackId}:`, response.status);
      return null;
    }

    const data = await response.json() as any;
    const track = data.track || data;

    if (!track) {
      console.error(`No track data returned for ${trackId}`);
      return null;
    }

    return {
      id: track.id,
      title: track.title,
      audio_url: track.audio_url,
      audio_status: track.audio_status,
      duration: track.duration,
      streamUrl: `/api/tracks/${track.id}/stream`
    };
  } catch (error) {
    console.error(`Error fetching track stream info for ${trackId}:`, error);
    return null;
  }
}

/**
 * Tests if an audio stream is accessible
 */
export async function testAudioStream(streamUrl: string): Promise<boolean> {
  try {
    const response = await fetch(streamUrl, {
      method: 'HEAD',
      cache: 'no-cache'
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error testing audio stream:', error);
    return false;
  }
}

/**
 * Preloads audio metadata for faster playback
 */
export async function preloadAudioMetadata(streamUrl: string): Promise<{
  duration: number | null;
  contentType: string | null;
  contentLength: number | null;
}> {
  try {
    const response = await fetch(streamUrl, {
      method: 'HEAD',
      cache: 'force-cache'
    });

    if (!response.ok) {
      return { duration: null, contentType: null, contentLength: null };
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const duration = response.headers.get('x-duration'); // Custom header if available

    return {
      duration: duration ? parseFloat(duration) : null,
      contentType,
      contentLength: contentLength ? parseInt(contentLength) : null
    };
  } catch (error) {
    console.error('Error preloading audio metadata:', error);
    return { duration: null, contentType: null, contentLength: null };
  }
}

/**
 * Enhanced audio loading with retry logic
 */
export async function loadAudioWithRetry(
  audio: HTMLAudioElement, 
  streamUrl: string, 
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Loading audio attempt ${attempt}/${maxRetries}: ${streamUrl}`);
      
      // Set source and configure audio element
      audio.crossOrigin = 'anonymous';
      audio.preload = 'metadata';
      audio.src = streamUrl;
      
      // Wait for the audio to load
      await new Promise<void>((resolve, reject) => {
        const handleCanPlay = () => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          resolve();
        };
        
        const handleError = (event: Event) => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
          reject(new Error('Audio failed to load'));
        };
        
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('error', handleError);
        
        audio.load();
      });
      
      console.log(`Audio loaded successfully on attempt ${attempt}`);
      return true;
      
    } catch (error) {
      console.error(`Audio load attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        console.error('All audio load attempts failed');
        return false;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  
  return false;
}

/**
 * Enhanced audio playback with retry logic
 */
export async function playAudioWithRetry(
  audio: HTMLAudioElement, 
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await audio.play();
      console.log(`Audio playback started successfully on attempt ${attempt}`);
      return true;
      
    } catch (error: any) {
      console.error(`Play attempt ${attempt} failed:`, error);
      
      // Don't retry certain types of errors
      if (error.name === 'NotAllowedError') {
        console.error('Audio playback blocked by browser policy');
        return false;
      }
      
      if (attempt === maxRetries) {
        console.error('All audio play attempts failed');
        return false;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
  
  return false;
}

/**
 * Validates audio format support
 */
export function canPlayAudioFormat(url: string): boolean {
  const audio = new Audio();
  const extension = url.toLowerCase().split('.').pop();
  
  const formatTests: { [key: string]: string } = {
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'ogg': 'audio/ogg',
    'webm': 'audio/webm'
  };
  
  const mimeType = formatTests[extension || ''];
  if (!mimeType) {
    return false;
  }
  
  const canPlay = audio.canPlayType(mimeType);
  return canPlay === 'probably' || canPlay === 'maybe';
}

/**
 * Gets optimal audio quality based on network conditions
 */
export function getOptimalAudioQuality(): 'high' | 'medium' | 'low' {
  // Simple heuristic based on connection type
  const connection = (navigator as any).connection;
  
  if (!connection) {
    return 'medium'; // Default fallback
  }
  
  const effectiveType = connection.effectiveType;
  
  switch (effectiveType) {
    case '4g':
      return 'high';
    case '3g':
      return 'medium';
    case '2g':
    case 'slow-2g':
      return 'low';
    default:
      return 'medium';
  }
}


