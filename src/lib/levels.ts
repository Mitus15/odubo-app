/**
 * The levels: the dance pieces that are out. This half is what the browser
 * may read too (the shapes, and how a piece becomes a level); reading them
 * from the database and sampling their colours is lib/levelsServer.ts.
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
import { isStreamUid, stillUrl } from '@/lib/stills';
import { streamUrl } from '@/lib/streams';
import { onRoom } from '@/lib/room';
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
  /** The field the dancer is on, sampled from his video (lib/sampler); before that, its campaign's colour */
  colour: string;
  /** The writing in his room: the ink he is drawn in where it reads, else the house's ink or sand (room.ts) */
  ink: string;
  /** The song's clean, silent site copy on Cloudflare Stream; null until it is made (the room shows the still) */
  hls: string | null;
  poster: string;
  /** The moment, seconds in, the still is taken at and the video starts from: where he first stands in the room */
  posterAt: number;
  /** When it first went out; '' while it is not out */
  outAt: string;
  /** Out on at least one app. A preview shows the rest too, to test them (lib/levelsServer) */
  released: boolean;
  /** When its first piece is planned for, from the Studio's schedule; '' when it is not planned */
  plannedAt: string;
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
  scheduled_at?: string | null;
}

const APP_ORDER = ['youtube', 'instagram', 'tiktok'];
/** "1-2 · Fils de joie", "Training · Monkey" */
export const LEVEL_CAMPAIGN = /^(\d+-\d+|Training)\s*·\s*(.+)$/;
export const STREAM_UID = /(?:videodelivery\.net|cloudflarestream\.com)\/([a-f0-9]{32})/;
/** A campaign with no colour yet, until its video is sampled: the house's oxblood */
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

/**
 * One posted piece as a level, or null when it is not one (no Stream video, a
 * Short, not out). With `unreleased`, a piece that is not out yet is one too
 * (a preview, to test it before it is posted).
 */
export function levelFrom(
  row: LevelRow,
  credits: Record<string, string> = {},
  siteVideos: Record<string, string> = {},
  { unreleased = false }: { unreleased?: boolean } = {},
): Level | null {
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
  if (!out.length && !unreleased) return null;

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
    ink: onRoom(row.campaign_color || FALLBACK_COLOUR),
    ...siteCopy(siteVideos[row.campaign_id || ''], row.thumbnail_url || `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`),
    outAt: out.map(({ mark }) => mark?.at || '').filter(Boolean).sort()[0] || '',
    released: out.length > 0,
    plannedAt: row.scheduled_at || '',
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

/**
 * A song's room video: its site copy when there is one; otherwise only the
 * piece's still, and no stream. The still is the copy's first frame at its
 * full size (a flat field compresses to ~35 KB), so it is sharp on any screen
 * and the video takes over from it without a jump, in the video's own colour.
 */
function siteCopy(uid: string | undefined, still: string): { hls: string | null; poster: string; posterAt: number } {
  if (!isStreamUid(uid)) return { hls: null, poster: still, posterAt: 0 };
  // Both come through the site: the manifest with only its sharp renditions (lib/streams), the still with its
  // colour corrected to the video's (lib/stills); the sampler may move the still (levelsServer)
  return { hls: streamUrl(uid), poster: stillUrl(uid), posterAt: 0 };
}

/** A copy's still at another height (a small tile needs nothing like the full frame); any other still as it is */
export function stillAt(poster: string, height: number): string {
  return poster.startsWith('/stills/') ? poster.replace(/([?&]h=)\d+/, `$1${height}`) : poster;
}

function rank(platform: string): number {
  const i = APP_ORDER.indexOf(platform);
  return i < 0 ? 99 : i;
}

/** What is out, newest first; then (a preview) what is not out yet, in the order it is planned */
export function sortLevels(levels: Level[]): Level[] {
  return [...levels].sort((a, b) => {
    if (a.released !== b.released) return a.released ? -1 : 1;
    if (a.released) return b.outAt.localeCompare(a.outAt);
    return (a.plannedAt || '~').localeCompare(b.plannedAt || '~');
  });
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
      released: all.some((p) => p.released),
      plannedAt: all.map((p) => p.plannedAt).filter(Boolean).sort()[0] || '',
      links: [...links.values()].sort((a, b) => rank(a.platform) - rank(b.platform)),
    };
  });
  return sortLevels(rooms);
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
