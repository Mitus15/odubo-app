/**
 * File Organization Utility for R2 Storage
 * Provides consistent folder structure and naming conventions
 */

export type FileType = 'track' | 'album-cover' | 'video' | 'video-poster' | 'video-thumbnail';
export type VideoType = 'music-video' | 'short-film' | 'feature';
export type ContentType = 'music' | 'video' | 'poster';

export interface FileOrganizationOptions {
  fileType: FileType;
  albumId?: string;
  videoId?: string;
  videoType?: VideoType;
  fileName: string;
  isTemporary?: boolean;
}

/**
 * Generates the appropriate folder path for uploaded files
 */
export function generateFilePath(options: FileOrganizationOptions): string {
  const {
    fileType,
    albumId,
    videoId,
    videoType,
    fileName,
    isTemporary = false
  } = options;

  // If temporary upload, use temp folder
  if (isTemporary) {
    return `temp/${Date.now()}_${fileName}`;
  }

  const timestamp = Date.now();
  const sanitizedFileName = sanitizeFileName(fileName);
  const uniqueFileName = `${timestamp}_${sanitizedFileName}`;

  switch (fileType) {
    case 'track':
      if (!albumId) throw new Error('Album ID required for track uploads');
      return `music/albums/${albumId}/tracks/${uniqueFileName}`;

    case 'album-cover':
      if (!albumId) throw new Error('Album ID required for album cover uploads');
      // Store both in album folder and posters folder for easy access
      return `music/albums/${albumId}/cover-art/${uniqueFileName}`;

    case 'video':
      if (!videoId || !videoType) throw new Error('Video ID and type required for video uploads');
      return `videos/${videoType}/${videoId}/${uniqueFileName}`;

    case 'video-poster':
      if (!videoId || !videoType) throw new Error('Video ID and type required for video poster uploads');
      return `videos/${videoType}/${videoId}/poster_${uniqueFileName}`;

    case 'video-thumbnail':
      if (!videoId || !videoType) throw new Error('Video ID and type required for video thumbnail uploads');
      return `videos/${videoType}/${videoId}/thumbnail_${uniqueFileName}`;

    default:
      throw new Error(`Unknown file type: ${fileType}`);
  }
}

/**
 * Generates poster/thumbnail paths for cross-referencing
 */
export function generatePosterPath(options: {
  contentType: 'album' | 'video';
  contentId: string;
  videoType?: VideoType;
  fileName: string;
  isMain?: boolean;
}): string {
  const { contentType, contentId, videoType, fileName, isMain = true } = options;
  const timestamp = Date.now();
  const sanitizedFileName = sanitizeFileName(fileName);
  const uniqueFileName = `${timestamp}_${sanitizedFileName}`;
  const prefix = isMain ? 'main' : 'thumb';

  if (contentType === 'album') {
    return `posters/albums/${contentId}/${prefix}_${uniqueFileName}`;
  } else if (contentType === 'video') {
    if (!videoType) throw new Error('Video type required for video posters');
    return `posters/videos/${videoType}/${contentId}/${prefix}_${uniqueFileName}`;
  }

  throw new Error(`Unknown content type: ${contentType}`);
}

/**
 * Extracts information from an existing file path
 */
export function parseFilePath(filePath: string): {
  contentType: string;
  subType?: string;
  contentId?: string;
  fileType: string;
  fileName: string;
} {
  const parts = filePath.split('/');
  
  if (parts[0] === 'music' && parts[1] === 'albums') {
    return {
      contentType: 'music',
      subType: 'album',
      contentId: parts[2],
      fileType: parts[3], // 'tracks' or 'cover-art'
      fileName: parts[4]
    };
  }
  
  if (parts[0] === 'videos') {
    return {
      contentType: 'video',
      subType: parts[1], // 'music-video', 'short-film', 'feature'
      contentId: parts[2],
      fileType: 'video',
      fileName: parts[3]
    };
  }
  
  if (parts[0] === 'posters') {
    return {
      contentType: 'poster',
      subType: parts[1], // 'albums' or 'videos'
      contentId: parts[2] || parts[3], // depends on structure
      fileType: 'poster',
      fileName: parts[parts.length - 1]
    };
  }
  
  // Fallback for unknown structures
  return {
    contentType: 'unknown',
    fileType: 'unknown',
    fileName: parts[parts.length - 1]
  };
}

/**
 * Sanitizes file names for safe storage
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .toLowerCase();
}

/**
 * Validates file type against expected content
 */
export function validateFileType(fileName: string, expectedType: FileType): boolean {
  const extension = fileName.toLowerCase().split('.').pop();
  
  const audioExtensions = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'webm'];
  const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'];
  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  
  switch (expectedType) {
    case 'track':
      return audioExtensions.includes(extension || '');
    case 'video':
      return videoExtensions.includes(extension || '');
    case 'album-cover':
    case 'video-poster':
    case 'video-thumbnail':
      return imageExtensions.includes(extension || '');
    default:
      return false;
  }
}

/**
 * Gets the MIME type mapping for proper content type
 */
export function getMimeType(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop();
  
  const mimeTypes: { [key: string]: string } = {
    // Audio
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'ogg': 'audio/ogg',
    'webm': 'audio/webm',
    
    // Video
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'm4v': 'video/mp4',
    
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif'
  };
  
  return mimeTypes[extension || ''] || 'application/octet-stream';
}

/**
 * Cleanup function to remove temporary files
 */
export function isTempFile(filePath: string): boolean {
  return filePath.startsWith('temp/');
}

/**
 * Generate a temporary file path for uploads that need processing
 */
export function generateTempPath(fileName: string): string {
  const timestamp = Date.now();
  const sanitizedFileName = sanitizeFileName(fileName);
  return `temp/${timestamp}_${sanitizedFileName}`;
}
