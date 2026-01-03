/**
 * Standardized Video Types
 *
 * All videos in the system must use one of these types.
 * This ensures consistency across the database, API, and UI.
 */

export const VIDEO_TYPES = {
  CLIP: 'clip',
  MUSIC_VIDEO: 'music-video',
  FILM: 'film',
  LIVE_PERFORMANCE: 'live-performance',
  BEHIND_THE_SCENES: 'behind-the-scenes',
  DOCUMENTARY: 'documentary',
  INTERVIEW: 'interview',
} as const;

export type VideoType = typeof VIDEO_TYPES[keyof typeof VIDEO_TYPES];

// All valid video types as an array (for validation)
export const VALID_VIDEO_TYPES: VideoType[] = Object.values(VIDEO_TYPES);

// Parent video types (excludes clips)
export const PARENT_VIDEO_TYPES: VideoType[] = [
  VIDEO_TYPES.MUSIC_VIDEO,
  VIDEO_TYPES.FILM,
  VIDEO_TYPES.LIVE_PERFORMANCE,
  VIDEO_TYPES.BEHIND_THE_SCENES,
  VIDEO_TYPES.DOCUMENTARY,
  VIDEO_TYPES.INTERVIEW,
];

// Display labels for UI
export const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
  [VIDEO_TYPES.CLIP]: 'Clip',
  [VIDEO_TYPES.MUSIC_VIDEO]: 'Music Video',
  [VIDEO_TYPES.FILM]: 'Film',
  [VIDEO_TYPES.LIVE_PERFORMANCE]: 'Live Performance',
  [VIDEO_TYPES.BEHIND_THE_SCENES]: 'Behind the Scenes',
  [VIDEO_TYPES.DOCUMENTARY]: 'Documentary',
  [VIDEO_TYPES.INTERVIEW]: 'Interview',
};

/**
 * Normalize a video type string to a valid VideoType
 * Handles legacy/malformed types
 */
export function normalizeVideoType(type: string | null | undefined): VideoType {
  if (!type) return VIDEO_TYPES.MUSIC_VIDEO;

  const normalized = type.toLowerCase().trim();

  // Direct matches
  if (VALID_VIDEO_TYPES.includes(normalized as VideoType)) {
    return normalized as VideoType;
  }

  // Legacy/variant mappings
  if (normalized.includes('music') && normalized.includes('video')) {
    return VIDEO_TYPES.MUSIC_VIDEO;
  }
  if (normalized.includes('clip')) {
    return VIDEO_TYPES.CLIP;
  }
  if (normalized.includes('film') || normalized.includes('movie')) {
    return VIDEO_TYPES.FILM;
  }
  if (normalized.includes('live') || normalized.includes('performance')) {
    return VIDEO_TYPES.LIVE_PERFORMANCE;
  }
  if (normalized.includes('behind') || normalized.includes('bts')) {
    return VIDEO_TYPES.BEHIND_THE_SCENES;
  }
  if (normalized.includes('documentary') || normalized.includes('doc')) {
    return VIDEO_TYPES.DOCUMENTARY;
  }
  if (normalized.includes('interview')) {
    return VIDEO_TYPES.INTERVIEW;
  }

  // Default to music-video for unknown types
  return VIDEO_TYPES.MUSIC_VIDEO;
}

/**
 * Check if a type is a valid VideoType
 */
export function isValidVideoType(type: string | null | undefined): type is VideoType {
  return typeof type === 'string' && VALID_VIDEO_TYPES.includes(type as VideoType);
}

/**
 * Check if a type is a parent video (not a clip)
 */
export function isParentVideoType(type: string | null | undefined): boolean {
  return typeof type === 'string' && PARENT_VIDEO_TYPES.includes(type as VideoType);
}
