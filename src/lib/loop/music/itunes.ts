/**
 * iTunes Search API — free, no auth, returns 30-second preview MP3s + artwork.
 * This is the "Apple Music preview" the spec wants (the real Apple Music API
 * needs a paid MusicKit token; we deliberately avoid it).
 *
 * Results are cached in module memory so we don't re-hit the API per request.
 */

export type Preview = {
  previewUrl: string;
  artworkUrl: string;
  trackName: string;
  artistName: string;
};

/** A single searchable result, identified by its stable iTunes trackId. */
export type TrackResult = {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl: string;
};

const cache = new Map<string, Preview | null>();

function upscaleArtwork(url: string): string {
  // iTunes returns 100x100 by default; request a crisp 600x600.
  return url.replace(/\/\d+x\d+bb\.(jpg|png)/, "/600x600bb.$1");
}

export async function findPreview(term: string): Promise<Preview | null> {
  if (cache.has(term)) return cache.get(term) ?? null;

  try {
    const url =
      "https://itunes.apple.com/search?" +
      new URLSearchParams({
        term,
        media: "music",
        entity: "song",
        limit: "1",
      });
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) throw new Error(`itunes ${res.status}`);
    const data = (await res.json()) as {
      results: Array<{
        previewUrl?: string;
        artworkUrl100?: string;
        trackName?: string;
        artistName?: string;
      }>;
    };
    const hit = data.results?.[0];
    if (!hit?.previewUrl) {
      cache.set(term, null);
      return null;
    }
    const preview: Preview = {
      previewUrl: hit.previewUrl,
      artworkUrl: hit.artworkUrl100 ? upscaleArtwork(hit.artworkUrl100) : "",
      trackName: hit.trackName ?? term,
      artistName: hit.artistName ?? "",
    };
    cache.set(term, preview);
    return preview;
  } catch {
    cache.set(term, null);
    return null;
  }
}

const searchCache = new Map<string, TrackResult[]>();

/**
 * Multi-result search powering the "suggest a song" box. Returns only tracks
 * with a real preview (so a nominated candidate can always be played), each
 * keyed by its stable iTunes trackId for natural dedupe.
 */
export async function searchTracks(term: string, limit = 8): Promise<TrackResult[]> {
  const key = `${limit}:${term}`;
  const cached = searchCache.get(key);
  if (cached) return cached;

  try {
    const url =
      "https://itunes.apple.com/search?" +
      new URLSearchParams({
        term,
        media: "music",
        entity: "song",
        limit: String(limit),
      });
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) throw new Error(`itunes ${res.status}`);
    const data = (await res.json()) as {
      results: Array<{
        trackId?: number;
        previewUrl?: string;
        artworkUrl100?: string;
        trackName?: string;
        artistName?: string;
      }>;
    };
    const results: TrackResult[] = (data.results ?? [])
      .filter((r) => r.trackId && r.previewUrl)
      .map((r) => ({
        id: String(r.trackId),
        title: r.trackName ?? "Unknown",
        artist: r.artistName ?? "",
        previewUrl: r.previewUrl as string,
        artworkUrl: r.artworkUrl100 ? upscaleArtwork(r.artworkUrl100) : "",
      }));
    searchCache.set(key, results);
    return results;
  } catch {
    return [];
  }
}
