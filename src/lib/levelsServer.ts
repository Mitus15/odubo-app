import { unstable_cache } from 'next/cache';
import { queryDatabase } from '@/lib/db';
import { bySong, creditOf, LEVEL_CAMPAIGN, levelFrom, type Level, type LevelRow } from '@/lib/levels';
import { writingOn } from '@/lib/room';
import { stillUrl } from '@/lib/stills';
import { videoLook } from '@/lib/samplerServer';

/**
 * The levels, read on the server: the Studio's posts, each song's site copy,
 * and each room's colours sampled from the copy itself (lib/sampler), so the
 * page is the colour he dances on, whatever colour a new piece brings.
 *
 * The live site shows what is out. A preview (and the dev server) shows every
 * song with its dance on Stream, out or not, so a new piece can be tried in
 * its room before it is posted (his word, 2026-10-27).
 */

/** Everything, posted or not, everywhere but the live site */
export const SHOWS_UNRELEASED = process.env.VERCEL_ENV !== 'production';

/** Every level, newest first. Throws when the database cannot be read, so a failed read is never kept. */
async function readLevels(unreleased: boolean): Promise<Level[]> {
  const rows = (await queryDatabase(
    `SELECT p.id, p.tags, p.platforms, p.platform_status, p.media_url, p.thumbnail_url, p.scheduled_at,
            p.campaign_id, c.name AS campaign_name, c.color AS campaign_color
       FROM social_posts p
       JOIN campaigns c ON c.id = p.campaign_id
      WHERE ${unreleased ? 'p.media_url IS NOT NULL' : "p.platform_status LIKE '%posted%'"}`,
    [],
  )) as LevelRow[];
  if (!rows.length) return [];

  // The credit is on the note of most of a song's posts, so read it from any of them
  const campaigns = [...new Set(rows.map((r) => r.campaign_id).filter((id): id is string => !!id))];
  const notes = (await queryDatabase(
    `SELECT c.name AS campaign_name, p.notes
       FROM social_posts p
       JOIN campaigns c ON c.id = p.campaign_id
      WHERE p.campaign_id IN (${campaigns.map(() => '?').join(',')}) AND p.notes LIKE '%·%'`,
    campaigns,
  )) as { campaign_name: string; notes: string }[];
  const credits: Record<string, string> = {};
  for (const n of notes) {
    const song = LEVEL_CAMPAIGN.exec(n.campaign_name.trim())?.[2]?.trim();
    const artist = song && creditOf(n.notes, song);
    if (song && artist && !credits[song]) credits[song] = artist;
  }

  // Each song's site copy (migration 170). Read with the whole row, so a database without the column yet reads as none
  const songRows = (await queryDatabase(
    `SELECT * FROM campaigns WHERE id IN (${campaigns.map(() => '?').join(',')})`,
    campaigns,
  )) as { id: string; site_video?: string | null }[];
  const siteVideos: Record<string, string> = {};
  for (const c of songRows) if (c.site_video) siteVideos[c.id] = c.site_video;

  const levels = bySong(rows.map((r) => levelFrom(r, credits, siteVideos, { unreleased })).filter((l): l is Level => !!l));

  // Each room in the colours of the video in it: its field, and the ink he is drawn in. A few videos at a
  // time: a new batch of copies is read once, and fifteen at once dropped most of their connections
  return inTurn(
    levels,
    SAMPLED_AT_ONCE,
    async (level) => {
      const uid = /videodelivery\.net\/([a-f0-9]{32})\//.exec(level.hls || '')?.[1];
      const look = uid ? await videoLook(uid) : null;
      if (!look || !uid) return level;
      // The room, its writing, and the still and start at the moment he first stands in it
      return { ...level, colour: look.field, ink: writingOn(look.field, look.figure), poster: stillUrl(uid, 1920, look.at), posterAt: look.at };
    },
  );
}

/** How many videos are sampled at once */
const SAMPLED_AT_ONCE = 3;

/** `work` over every item, at most `size` at a time, the results in the items' order */
async function inTurn<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

/** How long the site keeps the levels before reading them again: a piece marked posted in the Studio is on the site within this */
const LEVELS_KEPT_S = 120;
/** Only a whole read is kept: one that failed anywhere is tried again on the next visit */
const levelsKept = unstable_cache(readLevels, ['levels-v8'], { revalidate: LEVELS_KEPT_S, tags: ['levels'] });

/**
 * Every level, read from the Studio's posts and kept on the server for two
 * minutes (Next's data cache, shared by every server), so a visitor never
 * waits on the database's round trips. Nothing when it cannot be read.
 */
export async function getLevels(): Promise<Level[]> {
  try {
    return await levelsKept(SHOWS_UNRELEASED);
  } catch {
    return [];
  }
}

/** The same, failing loudly: for a cache of its own that must not keep an empty read (components/room/loadRoom) */
export function getLevelsOrThrow(): Promise<Level[]> {
  return levelsKept(SHOWS_UNRELEASED);
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The colour of the next room to open: the field of the next planned piece
 * whose song has nothing out yet. Only the colour leaves the database, never
 * the song or the day. Null when nothing is planned.
 */
export async function getNextRoomColour(levels: Level[]): Promise<string | null> {
  try {
    const rows = (await queryDatabase(
      `SELECT c.name AS campaign_name, c.color AS campaign_color
         FROM social_posts p
         JOIN campaigns c ON c.id = p.campaign_id
        WHERE p.scheduled_at > ?
        ORDER BY p.scheduled_at
        LIMIT 60`,
      [new Date().toISOString()],
    )) as { campaign_name: string; campaign_color: string | null }[];
    const out = new Set(levels.map((l) => l.song));
    for (const r of rows) {
      const song = LEVEL_CAMPAIGN.exec(r.campaign_name.trim())?.[2]?.trim();
      const colour = (r.campaign_color || '').trim();
      if (song && !out.has(song) && HEX.test(colour)) return colour.toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

/** The room of a piece: any of a song's pieces finds it */
export async function getLevel(id: string): Promise<Level | null> {
  return (await getLevels()).find((l) => l.pieceIds.includes(id)) || null;
}
