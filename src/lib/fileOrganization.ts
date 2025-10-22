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
  uid?: string;
}

/**
 * Generates the appropriate folder path for uploaded files
 */
export function generateFilePath(opts: FileOrganizationOptions) {
  const fileName = opts.fileName || `${Date.now()}`;
  switch (opts.fileType) {
    case 'gallery-photo':
      return `galleries/${opts.galleryId}/photos/${sanitizeFileName(fileName)}`;
    case 'gallery-video':
      return `galleries/${opts.galleryId}/videos/${sanitizeFileName(fileName)}`;
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