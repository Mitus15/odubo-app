import { FormData, Blob } from 'formdata-node';

// Cloudflare Stream API utilities
// For uploading and managing videos with Cloudflare Stream

interface StreamUploadResponse {
  result: {
    uid: string;
    watermark?: {
      uid: string;
    };
    created: string;
    modified: string;
    size: number;
    preview: string;
    allowedOrigins: string[];
    requireSignedURLs: boolean;
    uploaded: string;
    uploadExpiry: string | null;
    maxSizeBytes: number;
    maxDurationSeconds: number;
    duration: number;
    input: {
      width: number;
      height: number;
    };
    playback: {
      hls: string;
      dash: string;
    };
    thumbnail: string;
    thumbnailTimestampPct: number;
    readyToStream: boolean;
    status: {
      state: 'pendingupload' | 'downloading' | 'queued' | 'inprogress' | 'ready' | 'error';
      pctComplete: string;
      errorReasonCode?: string;
      errorReasonText?: string;
    };
    meta: Record<string, any>;
    clippedFrom?: {
      uid: string;
      startTimeSeconds: number;
      endTimeSeconds: number;
    };
  };
  success: boolean;
  errors: any[];
  messages: any[];
}

interface StreamVideoDetails {
  result: {
    uid: string;
    created: string;
    modified: string;
    size: number;
    preview: string;
    allowedOrigins: string[];
    requireSignedURLs: boolean;
    uploaded: string;
    uploadExpiry: string | null;
    maxSizeBytes: number;
    maxDurationSeconds: number;
    duration: number;
    input: {
      width: number;
      height: number;
    };
    playback: {
      hls: string;
      dash: string;
    };
    thumbnail: string;
    thumbnailTimestampPct: number;
    readyToStream: boolean;
    status: {
      state: 'pendingupload' | 'downloading' | 'queued' | 'inprogress' | 'ready' | 'error';
      pctComplete: string;
      errorReasonCode?: string;
      errorReasonText?: string;
    };
    meta: Record<string, any>;
  };
  success: boolean;
  errors: any[];
  messages: any[];
}

class CloudflareStreamAPI {
  private accountId: string;
  private apiToken: string;
  private baseUrl: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    // Prefer a dedicated stream token if provided, fall back to generic API token
    this.apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream`;

    if (!this.accountId || !this.apiToken) {
      throw new Error('Cloudflare Stream credentials not configured');
    }
  }

  private async makeRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Stream API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    // Handle 204 No Content responses (e.g., DELETE requests)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as T;
  }

  /**
   * Upload a video file directly to Cloudflare Stream
   * @param file - The video file to upload
   * @param metadata - Optional metadata for the video
   */
  async uploadVideo(
    file: File, 
    metadata: {
      name?: string;
      requireSignedURLs?: boolean;
      allowedOrigins?: string[];
      thumbnailTimestampPct?: number;
      watermark?: string;
      meta?: Record<string, any>;
    } = {}
  ): Promise<StreamUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    // Add metadata
    if (metadata.name) formData.append('name', metadata.name);
    if (metadata.requireSignedURLs !== undefined) {
      formData.append('requireSignedURLs', metadata.requireSignedURLs.toString());
    }
    if (metadata.allowedOrigins) {
      formData.append('allowedOrigins', JSON.stringify(metadata.allowedOrigins));
    }
    if (metadata.thumbnailTimestampPct !== undefined) {
      formData.append('thumbnailTimestampPct', metadata.thumbnailTimestampPct.toString());
    }
    if (metadata.watermark) {
      formData.append('watermark', metadata.watermark);
    }
    if (metadata.meta) {
      formData.append('meta', JSON.stringify(metadata.meta));
    }

    return this.makeRequest<StreamUploadResponse>('', {
      method: 'POST',
      body: formData as any,
    });
  }

  /**
   * Upload a video stream directly to Cloudflare Stream
   * @param stream - The video stream to upload
   * @param metadata - Optional metadata for the video
   */
  async uploadVideoStream(
    stream: any, 
    metadata: {
      name?: string;
      requireSignedURLs?: boolean;
      allowedOrigins?: string[];
      thumbnailTimestampPct?: number;
      watermark?: string;
      meta?: Record<string, any>;
    } = {}
  ): Promise<StreamUploadResponse> {
    const formData = new FormData();
    
    let fileToUpload = stream;
    if (Buffer.isBuffer(stream)) {
      fileToUpload = new Blob([stream]);
    }
    
    formData.append('file', fileToUpload, 'video.mp4');

    // Add metadata
    if (metadata.name) formData.append('name', metadata.name);
    if (metadata.requireSignedURLs !== undefined) {
      formData.append('requireSignedURLs', metadata.requireSignedURLs.toString());
    }
    if (metadata.allowedOrigins) {
      formData.append('allowedOrigins', JSON.stringify(metadata.allowedOrigins));
    }
    if (metadata.thumbnailTimestampPct !== undefined) {
      formData.append('thumbnailTimestampPct', metadata.thumbnailTimestampPct.toString());
    }
    if (metadata.watermark) {
      formData.append('watermark', metadata.watermark);
    }
    if (metadata.meta) {
      formData.append('meta', JSON.stringify(metadata.meta));
    }

    return this.makeRequest<StreamUploadResponse>('', {
      method: 'POST',
      body: formData as any,
    });
  }

  /**
   * Upload via direct upload URL (for large files)
   * This creates an upload URL that can be used for resumable uploads
   */
  async createUploadUrl(
    maxDurationSeconds?: number,
    metadata: {
      name?: string;
      requireSignedURLs?: boolean;
      allowedOrigins?: string[];
      thumbnailTimestampPct?: number;
      watermark?: string;
      meta?: Record<string, any>;
    } = {}
  ): Promise<{
    result: {
      uploadURL: string;
      uid: string;
    };
    success: boolean;
  }> {
    const body: any = {};
    
    if (maxDurationSeconds) body.maxDurationSeconds = maxDurationSeconds;
    if (metadata.name) body.name = metadata.name;
    if (metadata.requireSignedURLs !== undefined) body.requireSignedURLs = metadata.requireSignedURLs;
    if (metadata.allowedOrigins) body.allowedOrigins = metadata.allowedOrigins;
    if (metadata.thumbnailTimestampPct !== undefined) body.thumbnailTimestampPct = metadata.thumbnailTimestampPct;
    if (metadata.watermark) body.watermark = metadata.watermark;
    if (metadata.meta) body.meta = metadata.meta;

    return this.makeRequest<{
      result: {
        uploadURL: string;
        uid: string;
      };
      success: boolean;
    }>('/direct_upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Get video details by UID
   */
  async getVideo(uid: string): Promise<StreamVideoDetails> {
    return this.makeRequest<StreamVideoDetails>(`/${uid}`);
  }

  /**
   * Delete a video from Stream
   */
  async deleteVideo(uid: string): Promise<{ success: boolean }> {
    return this.makeRequest<{ success: boolean }>(`/${uid}`, {
      method: 'DELETE',
    });
  }

  /**
   * List all videos in the account
   */
  async listVideos(options: {
    search?: string;
    creator?: string;
    includeCounts?: boolean;
    start?: string;
    end?: string;
    asc?: boolean;
    status?: 'pendingupload' | 'downloading' | 'queued' | 'inprogress' | 'ready' | 'error';
    type?: 'live' | 'on-demand';
    after?: string; // Pagination cursor
    before?: string; // Pagination cursor
    limit?: number; // Max results per page (default 1000)
  } = {}) {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const query = params.toString();
    return this.makeRequest(`${query ? `?${query}` : ''}`);
  }

  /**
   * Fetch all videos with automatic pagination
   * Returns all videos by following pagination cursors
   */
  async listAllVideos(options: {
    search?: string;
    creator?: string;
    start?: string;
    end?: string;
    asc?: boolean;
    status?: 'pendingupload' | 'downloading' | 'queued' | 'inprogress' | 'ready' | 'error';
    type?: 'live' | 'on-demand';
  } = {}): Promise<any[]> {
    const allVideos: any[] = [];
    let after: string | undefined = undefined;
    
    // Fetch pages until no more results
    while (true) {
      const response = await this.listVideos({
        ...options,
        after,
        limit: 1000, // Max per page
      }) as { result?: any[]; result_info?: { cursors?: { after?: string } } };

      const videos = response.result || [];
      allVideos.push(...videos);

      // Check if there's a next page
      const nextCursor = response.result_info?.cursors?.after;
      if (!nextCursor || videos.length === 0) {
        break;
      }

      after = nextCursor;
    }

    return allVideos;
  }

  /**
   * Update video metadata
   */
  async updateVideo(
    uid: string,
    updates: {
      name?: string;
      requireSignedURLs?: boolean;
      allowedOrigins?: string[];
      thumbnailTimestampPct?: number;
      meta?: Record<string, any>;
    }
  ): Promise<StreamVideoDetails> {
    return this.makeRequest<StreamVideoDetails>(`/${uid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
  }

  /**
   * Get embed code for a video
   */
  getEmbedUrl(uid: string, options: {
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
    preload?: 'auto' | 'metadata' | 'none';
    poster?: string;
    primaryColor?: string;
    letterboxColor?: string;
    startTime?: string;
  } = {}): string {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const query = params.toString();
    return `https://iframe.videodelivery.net/${uid}${query ? `?${query}` : ''}`;
  }

  /**
   * Get HLS manifest URL for a video
   */
  getHlsUrl(uid: string): string {
    return `https://videodelivery.net/${uid}/manifest/video.m3u8`;
  }

  /**
   * Get DASH manifest URL for a video
   */
  getDashUrl(uid: string): string {
    return `https://videodelivery.net/${uid}/manifest/video.mpd`;
  }

  /**
   * Get thumbnail URL for a video
   */
  getThumbnailUrl(uid: string, options: {
    time?: string; // timestamp in format like "1m2s" or "62s"
    width?: number;
    height?: number;
    fit?: 'clip' | 'crop' | 'pad' | 'scale';
  } = {}): string {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const query = params.toString();
    return `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg${query ? `?${query}` : ''}`;
  }

  /**
   * Upload a video from URL
   */
  async uploadFromUrl(
    url: string,
    metadata: {
      name?: string;
      requireSignedURLs?: boolean;
      allowedOrigins?: string[];
      thumbnailTimestampPct?: number;
      watermark?: string;
      meta?: Record<string, any>;
    } = {}
  ): Promise<StreamUploadResponse> {
    const body: any = { url };
    
    if (metadata.name) body.name = metadata.name;
    if (metadata.requireSignedURLs !== undefined) body.requireSignedURLs = metadata.requireSignedURLs;
    if (metadata.allowedOrigins) body.allowedOrigins = metadata.allowedOrigins;
    if (metadata.thumbnailTimestampPct !== undefined) body.thumbnailTimestampPct = metadata.thumbnailTimestampPct;
    if (metadata.watermark) body.watermark = metadata.watermark;
    if (metadata.meta) body.meta = metadata.meta;

    return this.makeRequest<StreamUploadResponse>('/copy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Check if video is ready for streaming
   */
  async isVideoReady(uid: string): Promise<boolean> {
    try {
      const video = await this.getVideo(uid);
      return video.result.readyToStream && video.result.status.state === 'ready';
    } catch (error) {
      console.error('Error checking video status:', error);
      return false;
    }
  }

  /**
   * Wait for video to be ready (with polling)
   */
  async waitForVideoReady(
    uid: string, 
    options: { 
      maxWaitTime?: number; // milliseconds
      pollInterval?: number; // milliseconds
      onProgress?: (status: string, pctComplete: string) => void;
    } = {}
  ): Promise<boolean> {
    const { maxWaitTime = 600000, pollInterval = 5000, onProgress } = options; // 10 minutes max wait
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const video = await this.getVideo(uid);
        const { status, readyToStream } = video.result;

        onProgress?.(status.state, status.pctComplete);

        if (readyToStream && status.state === 'ready') {
          return true;
        }

        if (status.state === 'error') {
          console.error('Video processing failed:', status.errorReasonText);
          return false;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('Error polling video status:', error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    return false;
  }

  // ===== Live Inputs =====
  /** Create a Live Input (RTMPS/WHIP) with optional automatic recording */
  async createLiveInput(name: string, options: { recordingMode?: 'automatic' | 'off'; allowedOrigins?: string[] } = {}) {
    const recMode = options.recordingMode || 'automatic';
    const body: any = {
      meta: { name },
      recording: { mode: recMode },
    };
    if (options.allowedOrigins) body.allowedOrigins = options.allowedOrigins;
    return this.makeRequest(`/live_inputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /** List Live Inputs */
  async listLiveInputs(params: { search?: string } = {}) {
    const qs = params.search ? `?search=${encodeURIComponent(params.search)}` : '';
    return this.makeRequest(`/live_inputs${qs}`);
  }

  /** Get Live Input by UID */
  async getLiveInput(uid: string) {
    return this.makeRequest(`/live_inputs/${uid}`);
  }

  /** Delete a Live Input */
  async deleteLiveInput(uid: string) {
    return this.makeRequest(`/live_inputs/${uid}`, { method: 'DELETE' });
  }

  /**
   * Enable MP4 downloads for a video
   */
  async enableDownloads(uid: string): Promise<{ result: { default: { status: string; url: string; percentComplete: number } }; success: boolean }> {
    return this.makeRequest(`/${uid}/downloads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'default' }),
    });
  }

  /**
   * Disable MP4 downloads for a video
   */
  async disableDownloads(uid: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/${uid}/downloads/default`, {
      method: 'DELETE',
    });
  }

  /**
   * Get download URL (if enabled)
   */
  async getDownloadUrl(uid: string): Promise<string | null> {
    try {
      const res = await this.makeRequest<{ result: { default?: { status: string; url: string } } }>(`/${uid}/downloads`);
      if (res.result?.default?.status === 'ready') {
        return res.result.default.url;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}

export default CloudflareStreamAPI;
export type { StreamUploadResponse, StreamVideoDetails };
