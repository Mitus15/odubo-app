import { queryDatabase } from "@/lib/loop/db";

/**
 * Where the album can be heard, once it can.
 *
 * Release Control is the source of truth for the release; when a distributor
 * sends the album live, each store's link goes into distribution_release_dsps
 * (dsp, external_url, status 'live'). The pages read it here: until there is a
 * live link they keep saying the album is not streaming yet, and the moment
 * there is one they say where to listen instead.
 */
export type ListenLink = { dsp: string; label: string; url: string };

const STORES: Record<string, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  youtube_music: "YouTube Music",
  amazon: "Amazon Music",
  tidal: "TIDAL",
  deezer: "Deezer",
};
const ORDER = Object.keys(STORES);

/** Pure: live rows to links, in the order people look for them, one per store. */
export function toListenLinks(rows: { dsp: string; external_url: string | null; status: string | null }[]): ListenLink[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => r.status === "live" && !!r.external_url && /^https:\/\//.test(r.external_url))
    .sort((a, b) => (ORDER.indexOf(a.dsp) + 99) % 99 - ((ORDER.indexOf(b.dsp) + 99) % 99))
    .filter((r) => (seen.has(r.dsp) ? false : (seen.add(r.dsp), true)))
    .map((r) => ({ dsp: r.dsp, label: STORES[r.dsp] ?? r.dsp, url: r.external_url! }));
}

export async function listenLinks(albumId: string): Promise<ListenLink[]> {
  try {
    const rows = await queryDatabase<{ dsp: string; external_url: string | null; status: string | null }>(
      `SELECT d.dsp, d.external_url, d.status
         FROM distribution_release_dsps d
         JOIN distribution_releases r ON r.id = d.release_id
        WHERE r.internal_album_id = ?1`,
      [albumId],
    );
    return toListenLinks(rows);
  } catch {
    return [];
  }
}
