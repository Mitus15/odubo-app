import type { ClipApiRow, ClipItem } from '@/types/clips';

function buildHlsUrl(row: ClipApiRow): string | null {
  if (row.hls_url) return row.hls_url;
  if (row.uid) return `https://videodelivery.net/${row.uid}/manifest/video.m3u8`;
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
    poster: row.poster_url || row.preview_url || null,
    title: displayTitle,
    artist: (row.artist_name || '').trim() || 'Unknown Artist',
    duration: row.duration_seconds ?? null,
    createdAt: row.created_at ?? null,
    productHandle: row.shopify_product_handle || null,
    parentId: parseParentId(row.related_projects),
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
