/**
 * Storage Types
 * Shared types for all storage operations
 */

export type ContentType =
  | 'gallery-photo'
  | 'gallery-video'
  | 'album-cover'
  | 'track-audio'
  | 'music-video'
  | 'video-thumbnail'
  | 'featured-asset'
  | 'brand-asset'
  | 'social-media';

export type VideoType = 'official' | 'lyric' | 'visualizer' | 'live' | 'behind-the-scenes' | 'performance';

export type StorageBackend = 'r2' | 'stream';

export interface PathMetadata {
  // Gallery
  gallerySlug?: string;
  galleryId?: string | number;

  // Music
  albumSlug?: string;
  albumId?: string;
  trackSlug?: string;
  trackNumber?: number;
  videoType?: VideoType;

  // Generic
  filename?: string;
  extension?: string;
  uuid?: string;

  // Featured
  featuredType?: 'cover' | 'background';
  version?: number;

  // Brand Assets
  categorySlug?: string;
  albumSlug2?: string; // For brand-assets/{category}/{album}

  // Social
  entitySlug?: string;
  date?: Date;
}

export interface UploadOptions {
  contentType: ContentType;
  file: File | Buffer | Uint8Array;
  filename?: string;
  metadata: PathMetadata;
  customKey?: string; // Override automatic path generation
}

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  backend?: StorageBackend;
  error?: string;
}

export interface R2Object {
  key: string;
  size: number;
  lastModified: Date;
  eTag?: string;
}

export interface StreamVideoMetadata {
  uid: string;
  title?: string;
  meta?: Record<string, any>;
}

// Stream-specific content types
export type StreamContentType = 
  | 'clip'           // Short-form social content
  | 'music-video'    // Music video (official, lyric, etc.)
  | 'long-form'      // Media hub videos, documentaries
  | 'live'           // Live stream recordings
  | 'behind-scenes'; // BTS content

// Stream video metadata for organized uploads
export interface StreamUploadMetadata {
  // Required: What type of content
  contentType: StreamContentType;
  
  // Display info
  title: string;
  description?: string;
  artistName?: string;
  
  // Organization tags
  category?: string;      // e.g., 'music', 'performance', 'documentary'
  mood?: string;          // e.g., 'energetic', 'chill', 'introspective'
  credits?: string;
  relatedProjects?: string;
  
  // Music-specific
  albumSlug?: string;     // For music videos
  trackSlug?: string;     // For music videos
  videoType?: VideoType;  // official, lyric, visualizer, etc.
  
  // Gallery-specific
  gallerySlug?: string;   // For event/gallery videos
  
  // Clips-specific
  shopifyHandle?: string; // For shoppable clips
  
  // System
  uploadedBy?: string;
  uploadedAt?: string;
}

export interface PresignedUrlOptions {
  key: string;
  operation: 'get' | 'put';
  expiresIn?: number; // seconds
  contentType?: string;
}
