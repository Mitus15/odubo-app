/**
 * Video Format Detection Utilities
 *
 * Determines video format from MIME type and file extension to decide
 * whether transcoding is needed before deployment.
 */

const MP4_MIME_TYPES = [
  'video/mp4',
  'video/x-m4v', // Apple variant
];

const FORMAT_EXTENSIONS: Record<string, string> = {
  '.mp4': 'mp4',
  '.m4v': 'mp4',
  '.mov': 'mov',
  '.avi': 'avi',
  '.mkv': 'mkv',
  '.webm': 'webm',
  '.flv': 'flv',
  '.wmv': 'wmv',
};

export interface VideoFormatInfo {
  format: string; // 'mp4', 'mov', 'avi', etc.
  isMP4: boolean; // True if already web-ready MP4
  requiresTranscoding: boolean;
  mimeType: string;
  extension: string;
}

/**
 * Detect video format from File object
 *
 * @param file - Browser File object from file input
 * @returns Format information including whether transcoding is needed
 */
export function detectVideoFormat(file: File): VideoFormatInfo {
  const extension = getFileExtension(file.name);
  const format = FORMAT_EXTENSIONS[extension] || 'unknown';
  const mimeType = file.type || 'application/octet-stream';

  // MP4 check: Must have .mp4 extension AND compatible MIME type
  const isMP4 = extension === '.mp4' && (
    MP4_MIME_TYPES.includes(mimeType) ||
    mimeType === 'application/octet-stream' // No MIME = trust extension
  );

  return {
    format,
    isMP4,
    requiresTranscoding: !isMP4,
    mimeType,
    extension,
  };
}

/**
 * Extract file extension (lowercase with dot)
 *
 * @param filename - File name with extension
 * @returns Lowercase extension including dot (e.g., '.mp4')
 */
function getFileExtension(filename: string): string {
  const match = filename.match(/(\.[^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Get human-readable format name
 *
 * @param format - Format code (e.g., 'mp4', 'mov')
 * @returns Display name (e.g., 'MP4', 'QuickTime MOV')
 */
export function getFormatLabel(format: string): string {
  const labels: Record<string, string> = {
    mp4: 'MP4',
    mov: 'QuickTime MOV',
    avi: 'AVI',
    mkv: 'Matroska MKV',
    webm: 'WebM',
    flv: 'Flash Video',
    wmv: 'Windows Media',
  };
  return labels[format] || format.toUpperCase();
}
