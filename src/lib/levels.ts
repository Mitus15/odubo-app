/**
 * The levels: the dance pieces that are out.
 *
 * A level is a post planned in the Social Studio (a campaign named
 * "1-2 · Fils de joie" or "Training · Monkey") whose video is on Stream and
 * which is out on at least one app: the Studio ticked it, from the app's feed
 * or from his tap. Nothing reaches the site before it is out, so the site never
 * runs ahead of the schedule. Shorts are left out: they are the Reels cut for
 * YouTube, the same piece twice. The site shows one room a song (bySong),
 * however many of its posts are out.
 *
 * The site never carries the song. The apps' posts do (the full songs have it
 * laid in, the Reels the room's sound), and the apps are licensed to play it;
 * this site is not. So a room plays the song's own site copy: clean and
 * silent, him, the lacquer floor, his shadow and the seal over his head, no HUD
 * (scripts/loop/posts/site_copies.py; the campaign's site_video). A song
 * without one yet shows a still and streams nothing. The sound is a link to
 * where the piece is out.
 */
import { queryDatabase } from '@/lib/db';
import { KIND_LABEL, kindOf, platformMark, type PostKind } from '@/lib/social/postQueue';

export { KIND_LABEL };

export interface LevelLink {
  platform: string;
  /** The post itself when the Studio knows it, otherwise null (the account's page) */
  url: string | null;
}

export interface Level {
  /** The piece the room shows (see bySong) */
  id: string;
  /** Every piece of this song that is out, so an address of any of them finds the room */
  pieceIds: string[];
  /** "1-2", or null for a training piece */
  code: string | null;
  /** "Level 1-2" or "Training" */
  label: string;
  song: string;
  artist: string | null;
  kind: PostKind;
  /** The field the dancer is on: its campaign's colour, one of the pop-art palette */
  colour: string;
  /** The song's clean, silent site copy on Cloudflare Stream; null until it is made (the room shows the still) */
  hls: string | null;
  poster: string;
  /** When it first went out */
  outAt: string;
  /** Where it is out, the apps in the order the audience is */
  links: LevelLink[];
}

export interface LevelRow {
  id: string;
  tags: string | null;
  platforms?: string | null;
  platform_status: string | null;
  platform_post_ids?: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  campaign_id?: string;
  campaign_name: string;
  campaign_color: string | null;
}

const APP_ORDER = ['youtube', 'instagram', 'tiktok'];
/** "1-2 · Fils de joie", "Training · Monkey" */
const LEVEL_CAMPAIGN = /^(\d+-\d+|Training)\s*·\s*(.+)$/;
const STREAM_UID = /(?:videodelivery\.net|cloudflarestream\.com)\/([a-f0-9]{32})/;
const FALLBACK_COLOUR = '#843c2d';

function json<T>(raw: unknown, fallback: T): T {
  if (raw && typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** The song's credit from a note's first line, "Monkey · M.I Abaga" */
export function creditOf(notes: string | null | undefined, song: string): string | null {
  const [name, artist] = (notes || '').split('\n')[0].split(' · ');
  return name?.trim() === song && artist?.trim() ? artist.trim() : null;
}

/** One posted piece as a level, or null when it is not one (no Stream video, a Short, not out) */
export function levelFrom(row: LevelRow, credits: Record<string, string> = {}, siteVideos: Record<string, string> = {}): Level | null {
  const campaign = LEVEL_CAMPAIGN.exec(row.campaign_name.trim());
  const uid = STREAM_UID.exec(row.media_url || '')?.[1];
  if (!campaign || !uid) return null;

  const tags = json<string[]>(row.tags, []);
  const kind = pieceKind(tags, json<string[]>(row.platforms, []));
  if (kind === 'shorts') return null;

  const status = json<Record<string, unknown>>(row.platform_status, {});
  const out = Object.keys(status)
    .map((platform) => ({ platform, mark: platformMark({ platform_status: status }, platform) }))
    .filter(({ mark }) => mark?.posted);
  if (!out.length) return null;

  const code = campaign[1] === 'Training' ? null : campaign[1];
  const song = campaign[2].trim();
  return {
    id: row.id,
    pieceIds: [row.id],
    code,
    label: code ? `Level ${code}` : 'Training',
    song,
    artist: credits[song] || null,
    kind,
    colour: row.campaign_color || FALLBACK_COLOUR,
    ...siteCopy(siteVideos[row.campaign_id || ''], row.thumbnail_url || `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`),
    outAt: out.map(({ mark }) => mark?.at || '').filter(Boolean).sort()[0] || '',
    links: out
      .map(({ platform, mark }) => ({ platform, url: mark?.url || null }))
      .sort((a, b) => rank(a.platform) - rank(b.platform)),
  };
}

/**
 * Full song or Reel. The staged pieces are tagged; the first ones (Billie
 * Jean's) are not, and say it by where they go: YouTube alone is the full song.
 */
function pieceKind(tags: string[], platforms: string[]): PostKind {
  const kind = kindOf({ tags, platforms });
  if (kind !== 'post') return kind;
  return platforms.length === 1 && platforms[0] === 'youtube' ? 'full' : 'reels';
}

/** A song's room video: its site copy when there is one; otherwise only the piece's still, and no stream */
function siteCopy(uid: string | undefined, still: string): { hls: string | null; poster: string } {
  if (!uid || !/^[a-f0-9]{32}$/.test(uid)) return { hls: null, poster: still };
  return { hls: `https://videodelivery.net/${uid}/manifest/video.m3u8`, poster: `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=2s&height=960` };
}

function rank(platform: string): number {
  const i = APP_ORDER.indexOf(platform);
  return i < 0 ? 99 : i;
}

/** Newest first */
export function sortLevels(levels: Level[]): Level[] {
  return [...levels].sort((a, b) => b.outAt.localeCompare(a.outAt));
}

/** Which piece a song's room shows: the whole dance when it is out, else a Reel */
const SHOWS_FIRST: PostKind[] = ['full', 'reels', 'post'];

/**
 * One room a song: a level is the song, not each post of it. Its room shows
 * the whole dance when that is out, else a Reel; it opened when its first
 * piece went out; it is out wherever any of its pieces is.
 */
export function bySong(pieces: Level[]): Level[] {
  const songs = new Map<string, Level[]>();
  for (const p of pieces) songs.set(p.song, [...(songs.get(p.song) || []), p]);
  const rooms = [...songs.values()].map((all) => {
    const shown = [...all].sort((a, b) => SHOWS_FIRST.indexOf(a.kind) - SHOWS_FIRST.indexOf(b.kind))[0];
    const links = new Map<string, LevelLink>();
    for (const p of [shown, ...all]) for (const l of p.links) if (!links.get(l.platform)?.url) links.set(l.platform, l);
    return {
      ...shown,
      pieceIds: all.map((p) => p.id),
      outAt: all.map((p) => p.outAt).filter(Boolean).sort()[0] || shown.outAt,
      links: [...links.values()].sort((a, b) => rank(a.platform) - rank(b.platform)),
    };
  });
  return sortLevels(rooms);
}

/** Every level that is out, newest first. Empty when the database cannot be read. */
export async function getLevels(): Promise<Level[]> {
  try {
    const rows = (await queryDatabase(
      `SELECT p.id, p.tags, p.platforms, p.platform_status, p.media_url, p.thumbnail_url,
              p.campaign_id, c.name AS campaign_name, c.color AS campaign_color
         FROM social_posts p
         JOIN campaigns c ON c.id = p.campaign_id
        WHERE p.platform_status LIKE '%posted%'`,
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
    ).catch(() => [])) as { campaign_name: string; notes: string }[];
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
    ).catch(() => [])) as { id: string; site_video?: string | null }[];
    const siteVideos: Record<string, string> = {};
    for (const c of songRows) if (c.site_video) siteVideos[c.id] = c.site_video;

    return bySong(rows.map((r) => levelFrom(r, credits, siteVideos)).filter((l): l is Level => !!l));
  } catch {
    return [];
  }
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

/** The character he plays in the game (the show files' hud.player; there could be others) */
export const PLAYER = 'Mitus Young History';

/** What the site's HUD says for a level (components/room/RoomHud): the film's own layout, from the Studio's data */
export function hudOf(level: Level) {
  return {
    level: level.code || 'Training',
    credit: [level.song, level.artist].filter(Boolean).join(' · '),
    player: PLAYER,
    progress: !!level.code,
  };
}

export const APP_NAME: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok' };

/**
 * Where to hear a level: the post itself when the Studio has its link, else
 * the account it is out on (the bio link's own marks). Null when neither is known.
 */
export function hearIt(level: Level, accounts: { platform?: string | null; url: string }[]): { platform: string; app: string; url: string } | null {
  for (const link of level.links) {
    const url = link.url || accounts.find((a) => a.platform === link.platform)?.url;
    if (url) return { platform: link.platform, app: APP_NAME[link.platform] || link.platform, url };
  }
  return null;
}
