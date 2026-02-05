/**
 * Path Generators
 * Centralized path generation for all storage operations
 */

import { PathMetadata, VideoType } from './types';
import { queryDatabase } from '@/lib/db';

async function getAlbumSlug(albumId: string): Promise<string> {
  try {
    const result = await queryDatabase('SELECT title FROM albums WHERE id = ?', [albumId]);
    if (result && result.length > 0) {
      return toSlug(result[0].title as string);
    }
  } catch (error) {
    console.error('Failed to fetch album for slug generation:', error);
  }
  return albumId; // Fallback to ID if fetch fails
}

/**
 * Converts a string to a URL-safe slug
 */
export function toSlug(str: string): string {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Sanitizes a filename for safe storage
 */
export function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '');
}

/**
 * Pads a number with leading zeros
 */
function pad(num: number, size: number = 2): string {
  return String(num).padStart(size, '0');
}

/**
 * Generates a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Gallery paths
 */
export const gallery = {
  photo: (slug: string, filename: string): string => {
    const safeSlug = toSlug(slug);
    const safeFilename = sanitizeFilename(filename);
    return `galleries/${safeSlug}/photos/${safeFilename}`;
  },

  video: (slug: string, filename: string): string => {
    const safeSlug = toSlug(slug);
    const safeFilename = sanitizeFilename(filename);
    return `galleries/${safeSlug}/videos/${safeFilename}`;
  },

  thumbnail: (slug: string, filename: string): string => {
    const safeSlug = toSlug(slug);
    const safeFilename = sanitizeFilename(filename);
    return `galleries/${safeSlug}/thumbs/${safeFilename}`;
  },
};

/**
 * Music paths
 */
export const music = {
  albumCover: (albumSlug: string, ext: string = 'jpg'): string => {
    const safeSlug = toSlug(albumSlug);
    return `music/albums/${safeSlug}/cover.${ext}`;
  },

  track: (albumSlug: string, trackNumber: number, trackSlug: string, ext: string): string => {
    const safeAlbum = toSlug(albumSlug);
    const safeTrack = toSlug(trackSlug);
    const paddedNum = pad(trackNumber, 2);
    return `music/albums/${safeAlbum}/tracks/${paddedNum}-${safeTrack}.${ext}`;
  },

  video: (albumSlug: string, trackSlug: string, videoType: VideoType, ext: string = 'mp4'): string => {
    const safeAlbum = toSlug(albumSlug);
    const safeTrack = toSlug(trackSlug);
    return `music/videos/${safeAlbum}/${safeTrack}-${videoType}.${ext}`;
  },
};

/**
 * Video thumbnail paths
 */
export const videoThumbnails = {
  generate: (videoId: string, filename: string): string => {
    const safeFilename = sanitizeFilename(filename);
    return `thumbnails/videos/${videoId}/${safeFilename}`;
  },
};

/**
 * Featured page asset paths
 */
export const featured = {
  asset: (type: 'cover' | 'background', version: number, ext: string = 'jpg'): string => {
    return `featured/${type}-${version}.${ext}`;
  },

  // Slug-based (legacy support)
  slugAsset: (slug: string, baseName: string, version: number, ext: string): string => {
    const safeSlug = toSlug(slug);
    return `featured/${safeSlug}/${baseName}-${version}.${ext}`;
  },
};

/**
 * Brand asset paths
 */
export const brandAssets = {
  original: (categorySlug: string, albumSlug: string, uuid: string, ext: string): string => {
    const safeCat = toSlug(categorySlug);
    const safeAlbum = toSlug(albumSlug);
    return `brand-assets/${safeCat}/${safeAlbum}/originals/${uuid}.${ext}`;
  },

  thumbnail: (categorySlug: string, albumSlug: string, uuid: string, ext: string): string => {
    const safeCat = toSlug(categorySlug);
    const safeAlbum = toSlug(albumSlug);
    return `brand-assets/${safeCat}/${safeAlbum}/thumbs/${uuid}.${ext}`;
  },

  web: (categorySlug: string, albumSlug: string, uuid: string, ext: string): string => {
    const safeCat = toSlug(categorySlug);
    const safeAlbum = toSlug(albumSlug);
    return `brand-assets/${safeCat}/${safeAlbum}/web/${uuid}.${ext}`;
  },
};

/**
 * Social media asset paths (date-organized)
 */
export const social = {
  asset: (entitySlug: string, date: Date, uuid: string, ext: string): string => {
    const safeEntity = toSlug(entitySlug);
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `social/${safeEntity}/${year}/${month}/${day}/${uuid}.${ext}`;
  },
};

/**
 * Main path generator - delegates to specific generators
 */
export function generatePath(contentType: string, metadata: PathMetadata): string {
  const meta = metadata;

  switch (contentType) {
    case 'gallery-photo':
      if (!meta.gallerySlug && !meta.galleryId) throw new Error('gallerySlug or galleryId required');
      const gSlug = meta.gallerySlug || String(meta.galleryId);
      const photoFilename = meta.filename || `${generateUUID()}.jpg`;
      return gallery.photo(gSlug, photoFilename);

    case 'gallery-video':
      if (!meta.gallerySlug && !meta.galleryId) throw new Error('gallerySlug or galleryId required');
      const gvSlug = meta.gallerySlug || String(meta.galleryId);
      const videoFilename = meta.filename || `${generateUUID()}.mp4`;
      return gallery.video(gvSlug, videoFilename);

    case 'album-cover':
      if (!meta.albumSlug) throw new Error('albumSlug required for album cover');
      return music.albumCover(meta.albumSlug, meta.extension || 'jpg');

    case 'track-audio':
      if (!meta.albumSlug || !meta.trackSlug || meta.trackNumber === undefined) {
        throw new Error('albumSlug, trackSlug, and trackNumber required for track audio');
      }
      return music.track(meta.albumSlug, meta.trackNumber, meta.trackSlug, meta.extension || 'mp3');

    case 'music-video':
      if (!meta.albumSlug || !meta.trackSlug || !meta.videoType) {
        throw new Error('albumSlug, trackSlug, and videoType required for music video');
      }
      return music.video(meta.albumSlug, meta.trackSlug, meta.videoType, meta.extension || 'mp4');

    case 'video-thumbnail':
      if (!meta.uuid || !meta.filename) throw new Error('uuid and filename required for video thumbnail');
      return videoThumbnails.generate(meta.uuid, meta.filename);

    case 'featured-asset':
      if (!meta.featuredType || meta.version === undefined) {
        throw new Error('featuredType and version required for featured asset');
      }
      return featured.asset(meta.featuredType, meta.version, meta.extension || 'jpg');

    case 'brand-asset':
      if (!meta.categorySlug || !meta.albumSlug2 || !meta.uuid) {
        throw new Error('categorySlug, albumSlug2, and uuid required for brand asset');
      }
      return brandAssets.original(meta.categorySlug, meta.albumSlug2, meta.uuid, meta.extension || 'jpg');

    case 'social-media':
      if (!meta.entitySlug || !meta.date || !meta.uuid) {
        throw new Error('entitySlug, date, and uuid required for social media');
      }
      return social.asset(meta.entitySlug, meta.date, meta.uuid, meta.extension || 'jpg');

    default:
      throw new Error(`Unknown content type: ${contentType}`);
  }
}
