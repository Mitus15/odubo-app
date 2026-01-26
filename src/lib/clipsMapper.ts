import type { ClipApiRow, ClipItem } from '@/types/clips';

function buildHlsUrl(row: ClipApiRow): string | null {
  if (row.hls_url) return row.hls_url;
  if (row.uid) return `https://videodelivery.net/${row.uid}/manifest/video.m3u8`;
  return null;
}

function buildMp4Url(row: ClipApiRow): string | null {
  // Use stored mp4_url if available, otherwise generate from UID
  if (row.mp4_url) return row.mp4_url;
  // Generate URL from UID if we know MP4 is enabled
  // The actual enabling happens via the admin API
  if (row.uid) return `https://videodelivery.net/${row.uid}/downloads/default.mp4`;
  return null;
}

function parseParentId(related?: string | null): number | null {
  if (!related) return null;
  const m = related.match(/parent_id:(\d+)/);
  if (m) {
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function mapClipRow(row: ClipApiRow): ClipItem | null {
  const hls = buildHlsUrl(row);
  if (!hls) return null;

  // Strip trailing numbers (e.g. "Song Name 1" -> "Song Name") for display
  // This ensures all clips from the same video show the parent title
  let displayTitle = (row.title || '').trim() || 'Untitled';
  displayTitle = displayTitle.replace(/\s+\d+$/, '');

  return {
    id: row.id,
    hlsUrl: hls,
    mp4Url: buildMp4Url(row),
    poster: row.poster_url || row.preview_url || null,
    title: displayTitle,
    artist: (row.artist_name || '').trim() || 'Unknown Artist',
    duration: row.duration_seconds ?? null,
    createdAt: row.created_at ?? null,
    productHandle: row.shopify_product_handle || null,
    parentId: parseParentId(row.related_projects),
    uid: row.uid, // Include UID for MP4 URL generation
    // Clip identity (Magazine & Bullets)
    originalFilename: row.original_filename ?? null,
    clipIndex: row.clip_index ?? null,
    totalSiblings: row.total_siblings ?? null,
    // Platform URL backfeed
    youtubeUrl: row.youtube_url ?? null,
    youtubeShortsUrl: row.youtube_shorts_url ?? null,
    tiktokUrl: row.tiktok_url ?? null,
    instagramReelsUrl: row.instagram_reels_url ?? null,
    // Include engagement data if present
    engagementScore: row.engagement_score,
    viewCount: row.view_count,
    completionCount: row.completion_count,
  };
}

export function mapClipRows(rows: ClipApiRow[]): ClipItem[] {
  const out: ClipItem[] = [];
  for (const r of rows || []) {
    const m = mapClipRow(r);
    if (m) out.push(m);
  }
  return out;
}
