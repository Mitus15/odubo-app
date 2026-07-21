import { queryDatabase } from '@/lib/db';
import { mapClipRows } from '@/lib/clipsMapper';
import { getDailyVerse } from '@/lib/bible-verse';
import type { ClipApiRow, ClipItem } from '@/types/clips';

export interface VerseOfTheDay {
  text: string;
  reference: string;
  error: string | null;
}

/**
 * Get verse of the day from the downloaded KJV Bible (Psalms & Proverbs).
 * Reads from data/bible-psalms-proverbs.json — no AI, no API calls.
 * Deterministic: same verse all day, different verse each day.
 */
export async function getVerse(): Promise<VerseOfTheDay> {
  try {
    const verse = getDailyVerse();
    return {
      text: verse.text,
      reference: verse.reference,
      error: null
    };
  } catch (error) {
    console.error('getVerse error:', error);
    return {
      text: "Trust in the Lord with all thine heart; and lean not unto thine own understanding.",
      reference: "Proverbs 3:5",
      error: null
    };
  }
}

/**
 * Get homepage mode from settings
 * Returns 'clips' if clips exist (in auto mode), 'music' otherwise
 */
export async function getHomepageMode(): Promise<'clips' | 'music'> {
  try {
    let mode = 'auto';
    try {
      const settings = await queryDatabase(
        `SELECT value FROM site_settings WHERE key = 'homepage_mode'`,
        []
      ) as { value: string }[];
      mode = settings[0]?.value || 'auto';
    } catch {
      mode = 'auto';
    }

    const countResult = await queryDatabase(
      `SELECT COUNT(*) as count FROM videos
       WHERE type = 'clip'
         AND (is_public = 1 OR is_public IS NULL)
         AND COALESCE(publication_status, 'live') = 'live'
         AND COALESCE(status, 'published') != 'archived'`,
      []
    ) as { count: number }[];

    const clipCount = countResult[0]?.count || 0;

    if (mode === 'auto') {
      return clipCount > 0 ? 'clips' : 'music';
    }
    return mode as 'clips' | 'music';
  } catch {
    return 'music';
  }
}

/**
 * Fetch initial clips for SSR
 */
export async function getInitialClips(limit = 12): Promise<ClipItem[]> {
  try {
    const baseFields = `v.id, v.title, v.artist_name, v.description, v.url, v.uid, v.mp4_url, v.duration, v.duration_seconds, v.poster_url, v.thumbnail, v.created_at, v.shopify_product_handle, v.related_projects, parent.title as parent_title`;
    const rows = await queryDatabase(
      `SELECT ${baseFields}
       FROM videos v
       LEFT JOIN videos parent ON v.parent_video_id = parent.id
       WHERE v.type = 'clip'
         AND (v.is_public = 1 OR v.is_public IS NULL)
         AND COALESCE(v.status, 'published') != 'archived'
         AND COALESCE(v.publication_status, 'live') = 'live'
       ORDER BY RANDOM()
       LIMIT ?`,
      [limit]
    ) as ClipApiRow[];
    return mapClipRows(rows);
  } catch {
    return [];
  }
}

/**
 * Get featured clip from a list of clips
 * Prioritizes clips with shop products, then by engagement, then random
 */
export function getFeaturedClip(clips: ClipItem[]): ClipItem | undefined {
  if (!clips || clips.length === 0) return undefined;
  
  // First, try to find a clip with a shop product
  const shopClip = clips.find(c => c.productHandle);
  if (shopClip) return shopClip;
  
  // Otherwise, return the first clip
  return clips[0];
}
