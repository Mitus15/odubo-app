/**
 * Cloudflare Stream Metadata Helpers
 * Generates consistent, human-readable names and metadata for Stream uploads
 */

import { toSlug } from './pathGenerators';
import type { StreamUploadMetadata, StreamContentType, VideoType } from './types';

/**
 * Generate a human-readable name for a Stream video
 * Used in the Stream dashboard and API responses
 */
export function generateStreamName(metadata: StreamUploadMetadata): string {
  const { contentType, title, artistName, albumSlug, trackSlug, videoType } = metadata;
  
  switch (contentType) {
    case 'music-video': {
      const parts = ['music-video'];
      if (artistName) parts.push(toSlug(artistName));
      if (albumSlug) parts.push(albumSlug);
      if (trackSlug) parts.push(trackSlug);
      if (videoType) parts.push(videoType);
      return parts.join('-');
    }
    
    case 'clip': {
      const titleSlug = toSlug(title);
      return `clip-${titleSlug}`;
    }
    
    case 'long-form': {
      const titleSlug = toSlug(title);
      return `video-${titleSlug}`;
    }
    
    case 'live': {
      const date = new Date().toISOString().split('T')[0];
      const titleSlug = toSlug(title);
      return `live-${date}-${titleSlug}`;
    }
    
    case 'behind-scenes': {
      const titleSlug = toSlug(title);
      return `bts-${titleSlug}`;
    }
    
    default:
      return toSlug(title);
  }
}

/**
 * Generate Stream metadata object for API upload
 * All metadata is searchable and filterable in Stream dashboard
 */
export function generateStreamMeta(metadata: StreamUploadMetadata): Record<string, string> {
  const meta: Record<string, string> = {
    // Core identification
    contentType: metadata.contentType,
    title: metadata.title,
    
    // Organization
    uploadedAt: metadata.uploadedAt || new Date().toISOString(),
  };
  
  // Optional display fields
  if (metadata.description) meta.description = metadata.description;
  if (metadata.artistName) {
    meta.artistName = metadata.artistName;
    meta.creator = metadata.artistName; // Cloudflare standard field
  }
  
  // Tags for categorization
  const tags: string[] = [metadata.contentType];
  if (metadata.category) {
    meta.category = metadata.category;
    tags.push(metadata.category);
  }
  if (metadata.mood) {
    meta.mood = metadata.mood;
    tags.push(metadata.mood);
  }
  if (metadata.videoType) {
    meta.videoType = metadata.videoType;
    tags.push(metadata.videoType);
  }
  meta.tags = tags.join(',');
  
  // Music-specific metadata
  if (metadata.albumSlug) meta.albumSlug = metadata.albumSlug;
  if (metadata.trackSlug) meta.trackSlug = metadata.trackSlug;
  
  // Gallery-specific
  if (metadata.gallerySlug) meta.gallerySlug = metadata.gallerySlug;
  
  // Clips-specific
  if (metadata.shopifyHandle) meta.shopifyHandle = metadata.shopifyHandle;
  
  // Production credits
  if (metadata.credits) meta.credits = metadata.credits;
  if (metadata.relatedProjects) meta.relatedProjects = metadata.relatedProjects;
  
  // System info
  if (metadata.uploadedBy) meta.uploadedBy = metadata.uploadedBy;
  
  return meta;
}

/**
 * Generate complete Stream upload options
 * Use this for consistent uploads across all video endpoints
 */
export function generateStreamUploadOptions(metadata: StreamUploadMetadata) {
  return {
    name: generateStreamName(metadata),
    meta: generateStreamMeta(metadata),
    // Additional options
    requireSignedURLs: metadata.contentType !== 'clip', // Clips can be public
    allowedOrigins: process.env.NEXT_PUBLIC_SITE_URL 
      ? [process.env.NEXT_PUBLIC_SITE_URL]
      : undefined,
  };
}

/**
 * Parse contentType from old video 'type' field for migration
 * Legacy videos may have: 'music-video', 'clip', 'long-form', etc.
 */
export function parseContentTypeFromLegacy(type?: string): StreamContentType {
  if (!type) return 'long-form';
  
  const normalized = type.toLowerCase().trim();
  
  if (normalized.includes('clip') || normalized === 'short') return 'clip';
  if (normalized.includes('music')) return 'music-video';
  if (normalized.includes('live')) return 'live';
  if (normalized.includes('behind') || normalized === 'bts') return 'behind-scenes';
  
  return 'long-form';
}

/**
 * Generate search query for Stream API filtering
 * Example: search for all music videos for an album
 */
export function generateStreamSearchQuery(filters: {
  contentType?: StreamContentType;
  albumSlug?: string;
  trackSlug?: string;
  videoType?: VideoType;
  artistName?: string;
}): Record<string, string> {
  const search: Record<string, string> = {};
  
  if (filters.contentType) search['meta.contentType'] = filters.contentType;
  if (filters.albumSlug) search['meta.albumSlug'] = filters.albumSlug;
  if (filters.trackSlug) search['meta.trackSlug'] = filters.trackSlug;
  if (filters.videoType) search['meta.videoType'] = filters.videoType;
  if (filters.artistName) search['meta.artistName'] = filters.artistName;
  
  return search;
}
