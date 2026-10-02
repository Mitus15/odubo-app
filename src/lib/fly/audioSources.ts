import { SONGS } from '@/lib/loop/songs';
import { flyAudioSecret, mintFlyAudioToken } from './audioGate';

/**
 * The game's song links, one per slug, for the /fly page to hand its client.
 *
 * SERVER ONLY: it signs with the server's secret. Import it from a server
 * component or a route, never from a 'use client' file.
 *
 * Each link is good for six hours from nowMs, so the page that calls this must
 * not be cached for long (force-dynamic, or revalidate well under six hours),
 * or it will hand out links that are already dead. With no secret in
 * production the answer is empty and the game plays on its silent clock.
 */
export async function flyAudioSources(nowMs: number = Date.now()): Promise<Record<string, string>> {
  const secret = flyAudioSecret();
  if (!secret) return {};
  const entries = await Promise.all(
    SONGS.map(async (song) => {
      const token = await mintFlyAudioToken(song.slug, nowMs, secret);
      return [song.slug, `/api/game/fly/audio/${encodeURIComponent(song.slug)}?k=${encodeURIComponent(token)}`] as const;
    }),
  );
  return Object.fromEntries(entries);
}
