/**
 * File Organization Utility for R2 Storage
 * Provides consistent folder structure and naming conventions
 */

export type FileType =
  | 'video'
  | 'audio'
  | 'poster'
  | 'poster-thumb'
  | 'gallery-photo'
  | 'gallery-video'
  | 'misc';

export interface FileOrganizationOptions {
  fileType: FileType;
  fileName?: string;
  galleryId?: string;
  galleryName?: string;
  galleryCode?: string;
  gallerySlug?: string;
  uid?: string;
}

/**
 * Generates the appropriate folder path for uploaded files
 */
export function generateFilePath(opts: FileOrganizationOptions) {
  const fileName = opts.fileName || `${Date.now()}`;
  // Prefer friendly folder names when possible: galleryName > galleryCode > gallerySlug > galleryId
  const rawFolder = (opts.galleryName || opts.galleryCode || opts.gallerySlug || opts.galleryId || 'unknown').toString();
  const galleryFolder = toSlug(rawFolder);
  switch (opts.fileType) {
    case 'gallery-photo':
      return `galleries/${sanitizeFileName(galleryFolder)}/photos/${sanitizeFileName(fileName)}`;
    case 'gallery-video':
      return `galleries/${sanitizeFileName(galleryFolder)}/videos/${sanitizeFileName(fileName)}`;
    default:
      return `uploads/${sanitizeFileName(fileName)}`;
  }
}

export function getMimeType(fileName: string | undefined) {
  if (!fileName) return undefined;
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    pdf: 'application/pdf',
    txt: 'text/plain',
    csv: 'text/csv',
    svg: 'image/svg+xml'
  };

  if (!ext) return undefined;
  return map[ext] || 'application/octet-stream';
}

// Simple filename sanitizer used by generateFilePath
export function sanitizeFileName(name: string) {
  // Normalize whitespace, remove control chars, and replace unsafe chars with underscore
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '');
}

// Simple slug for folder names: lowercase, spaces->dash, strip invalid
export function toSlug(name: string) {
  return (name || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Determine if a file extension is valid for a given expected type/category
export function validateFileType(fileName: string | undefined, expectedType: string) {
  if (!fileName) return false;
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const audioExts = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'webm'];
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'];
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
  const docExts = ['pdf', 'txt', 'csv'];

  const type = (expectedType || '').toLowerCase();
  if (['track', 'audio', 'song'].includes(type)) return audioExts.includes(ext);
  if (['video', 'music-video', 'movie', 'short-film', 'feature'].includes(type)) return videoExts.includes(ext);
  if (['album-cover', 'cover', 'poster', 'image', 'photo', 'thumbnail'].includes(type)) return imageExts.includes(ext);
  if (['pdf', 'document', 'doc', 'txt', 'csv'].includes(type)) return docExts.includes(ext);
  if (['gallery-photo', 'gallery-video', 'gallery'].includes(type)) {
    return imageExts.includes(ext) || videoExts.includes(ext);
  }
  // Fallback: allow common media types
  return audioExts.includes(ext) || videoExts.includes(ext) || imageExts.includes(ext) || docExts.includes(ext);
}

// Lightweight parser for known organized paths (used by migration/tests)
export function parseFilePath(path: string) {
  if (!path) return null;
  const normalized = path.replace(/^\/+/, '');
  const parts = normalized.split('/');
  // Simple heuristics
  if (parts[0] === 'music' && parts[1] === 'albums') {
    const albumId = parts[2];
    const filename = parts.slice(4).join('/');
    return { type: 'album-track', albumId, filename };
  }
  if (parts[0] === 'videos') {
    const videoType = parts[1];
    const filename = parts.slice(2).join('/');
    return { type: 'video', videoType, filename };
  }
  if (parts[0] === 'galleries') {
    const galleryId = parts[1];
    const kind = parts[2];
    const filename = parts.slice(3).join('/');
    return { type: `gallery-${kind}`, galleryId, filename };
  }
  return { type: 'unknown', path: normalized };
}