import type { ClipApiRow, ClipItem } from '@/types/clips';

function buildHlsUrl(row: ClipApiRow): string | null {
  if (row.hls_url) return row.hls_url;
  if (row.uid) return `https://videodelivery.net/${row.uid}/manifest/video.m3u8`;
  return null;
}

export function mapClipRow(row: ClipApiRow): ClipItem | null {
  const hls = buildHlsUrl(row);
  if (!hls) return null;
  return {
    id: row.id,
    hlsUrl: hls,
    poster: row.poster_url || row.preview_url || null,
    title: (row.title || '').trim() || 'Untitled',
    artist: (row.artist_name || '').trim() || 'Unknown Artist',
    duration: row.duration_seconds ?? null,
    createdAt: row.created_at ?? null,
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
