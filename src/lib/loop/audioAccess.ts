import type { NextRequest } from "next/server";
import { queryDatabase } from "@/lib/db";
import { verifyUserFromRequest, isAdminUser } from "@/lib/auth";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/loop/admin-auth";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/identity/voter";
import { albumAccessFor, earlySetFor } from "@/lib/loop/album";
import { getSetting } from "@/lib/loop/loopSetting";
import { releasedSingleTitles } from "@/lib/loop/singlesStore";
import { fieldPackOfKey, singleByFieldPack } from "@/lib/loop/singles";
import { hlsDirOfKey, mediaKeyBelongsTo } from "@/lib/release/audioSource";

/**
 * Who may actually hear a recording.
 *
 * Found live in production on 2026-09-15: the unreleased album was streamable
 * by anyone. `/api/tracks` handed out every title with its audio URL, and both
 * byte-serving routes answered an anonymous range request with real audio. The
 * record the whole product sells as "yours when you pre-order" was public, and
 * the single's own copy said it was not streaming anywhere.
 *
 * The rule is the same one `/loop/album` already shows on screen, moved to
 * where the bytes leave the building — because a gate drawn in the UI is a
 * suggestion, and this is the thing being sold.
 */

export type AudioFacts = {
  /** The album is out. A published catalogue is public and should stay that way. */
  albumPublished: boolean;
  /** The song behind the flyer's QR, or a single whose release date has come.
   *  Promised publicly, so it stays public. */
  isFeaturedSingle: boolean;
  /** Owner or team, by a VERIFIED session — never a decoded-but-unchecked token. */
  isAdmin: boolean;
  /** Holds a pass, or is owed the record by a pre-order. */
  owed: boolean;
  /** The owner has flipped the record to released. */
  albumReleased: boolean;
  /** This exact track is in this listener's early draw. */
  inEarlySet: boolean;
};

/** Pure, so the rule is testable and cannot drift between the two routes. */
export function decideAudioAccess(f: AudioFacts): boolean {
  if (f.albumPublished) return true;
  if (f.isFeaturedSingle) return true;
  if (f.isAdmin) return true;
  if (!f.owed) return false;
  return f.albumReleased || f.inEarlySet;
}

type TrackRow = {
  id: string;
  album_id: string | null;
  track_number: number;
  title: string;
  album_status: string | null;
};

async function trackById(id: string): Promise<TrackRow | null> {
  const rows = (await queryDatabase(
    `SELECT t.id, t.album_id, t.track_number, t.title, a.status AS album_status
       FROM tracks t LEFT JOIN albums a ON a.id = t.album_id
      WHERE t.id = ? LIMIT 1`,
    [id],
  )) as TrackRow[];
  return rows[0] ?? null;
}

/**
 * The tracks a media key belongs to: the one whose recording it is, however
 * its audio_url names it (the proxy path, the dead public host, the bare key),
 * or whose HLS renditions it sits among (`song.hls/…` beside `song.web.m4a`).
 * Usually one. None when the key is not a track at all (a master in the
 * warehouse, a field stem): those keep their existing behaviour, so this only
 * ever tightens the catalogue.
 *
 * Until 2026-10-02 only a key equal to audio_url counted, so a track's HLS
 * files and the key of a track still stored on the dead host were served to
 * anyone.
 */
async function tracksByMediaKey(key: string): Promise<TrackRow[]> {
  // Every form an owner's audio_url takes contains this text, so the database
  // narrows the search and mediaKeyBelongsTo decides it exactly.
  const hlsDir = hlsDirOfKey(key);
  const text = hlsDir ? hlsDir.slice(0, -".hls/".length) : key;
  const rows = (await queryDatabase(
    `SELECT t.id, t.album_id, t.track_number, t.title, t.audio_url, a.status AS album_status
       FROM tracks t LEFT JOIN albums a ON a.id = t.album_id
      WHERE instr(t.audio_url, ?) > 0`,
    [text],
  )) as Array<TrackRow & { audio_url: string | null }>;
  return rows.filter((track) => mediaKeyBelongsTo(key, track.audio_url));
}

/**
 * The facts for tracks of ONE album, in order. Whatever is true of the caller
 * (an admin, owed the record, their early draw) is the same for every track,
 * so it is asked once: a whole album costs what a single track does.
 */
async function gatherFacts(req: NextRequest | null, tracks: TrackRow[]): Promise<AudioFacts[]> {
  const albumPublished = (tracks[0]?.album_status ?? "").toLowerCase() === "published";
  const nothingElse = { isFeaturedSingle: false, isAdmin: false, owed: false, albumReleased: false, inEarlySet: false };

  // A published album needs none of the rest, and asking would cost four
  // round trips on the hot path of a public catalogue.
  if (albumPublished || tracks.length === 0) {
    return tracks.map(() => ({ albumPublished, ...nothingElse }));
  }

  const [featured, released, loopAdminOk, odubo] = await Promise.all([
    getSetting("featured_track").catch(() => null),
    releasedSingleTitles().catch(() => new Set<string>()),
    (async () => {
      try {
        const { cookies } = await import("next/headers");
        return await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
      } catch {
        return false;
      }
    })(),
    req ? verifyUserFromRequest(req).catch(() => null) : Promise.resolve(null),
  ]);

  const wanted = (featured ?? "1984").trim().toLowerCase();
  const isFeaturedSingle = (track: TrackRow) => {
    const title = track.title.trim().toLowerCase();
    return title === wanted || released.has(title);
  };
  const isAdmin = loopAdminOk || isAdminUser(odubo);
  // Nothing owed: enough to open a public single, or anything to an admin,
  // and the closed answer for everyone else.
  const settled = (track: TrackRow): AudioFacts => ({
    ...nothingElse,
    albumPublished,
    isFeaturedSingle: isFeaturedSingle(track),
    isAdmin,
  });

  if (isAdmin || tracks.every(isFeaturedSingle)) return tracks.map(settled);

  try {
    const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
    const access = await albumAccessFor(event.id, voterId);
    const owed = access.entitled || access.holder;
    // Owed, but before release only their own draw plays. Otherwise a
    // pass-holder could pull all fourteen through the API while the page
    // shows them three.
    let earlySet: number[] = [];
    if (owed) {
      const { loadAlbum } = await import("@/lib/loop/album");
      const data = await loadAlbum(tracks[0].album_id ?? undefined);
      if (data) earlySet = earlySetFor(access.email ?? voterId, data.tracks, featured, access.early);
    }
    return tracks.map((track) =>
      isFeaturedSingle(track)
        ? settled(track)
        : {
            ...nothingElse,
            albumPublished,
            owed,
            albumReleased: access.released,
            inEarlySet: earlySet.includes(track.track_number),
          },
    );
  } catch {
    // The gate fails CLOSED. An unreleased record is the one thing here worth
    // protecting, and a database wobble must not open it.
    return tracks.map(settled);
  }
}

/**
 * Which of an album's tracks this caller may hear, by id: the same rule as a
 * single track, decided for the whole album at once, for the routes that
 * serve every track of it.
 */
export async function audibleTrackIds(req: NextRequest | null, albumId: string): Promise<Set<string>> {
  const tracks = (await queryDatabase(
    `SELECT t.id, t.album_id, t.track_number, t.title, a.status AS album_status
       FROM tracks t LEFT JOIN albums a ON a.id = t.album_id
      WHERE t.album_id = ?`,
    [albumId],
  )) as TrackRow[];
  const facts = await gatherFacts(req, tracks);
  return new Set(tracks.filter((_, i) => decideAudioAccess(facts[i])).map((track) => track.id));
}

export async function mayHearTrackId(req: NextRequest | null, trackId: string): Promise<boolean> {
  const track = await trackById(trackId);
  if (!track) return false;
  const [facts] = await gatherFacts(req, [track]);
  return decideAudioAccess(facts);
}

/** An owner or team session, verified. */
export async function isAdminRequest(req: NextRequest | null): Promise<boolean> {
  const [loopAdminOk, odubo] = await Promise.all([
    (async () => {
      try {
        const { cookies } = await import("next/headers");
        return await verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
      } catch {
        return false;
      }
    })(),
    req ? verifyUserFromRequest(req).catch(() => null) : Promise.resolve(null),
  ]);
  return loopAdminOk || isAdminUser(odubo);
}

/**
 * A stem-field pack is the song in five parts: all five together ARE the
 * song. Found 2026-09-29: News Peak's stems were public while News Peak was
 * not. A pack now opens with its single's release, or to an admin; a pack no
 * single claims stays closed. Fails closed.
 */
async function mayHearFieldPack(req: NextRequest | null, pack: string): Promise<boolean> {
  const single = singleByFieldPack(pack);
  try {
    if (single && (await releasedSingleTitles()).has(single.title.toLowerCase())) return true;
    return await isAdminRequest(req);
  } catch {
    return false;
  }
}

/** null when the key is not a catalogue track — the caller leaves it alone. */
export async function mayHearMediaKey(req: NextRequest | null, key: string): Promise<boolean | null> {
  const pack = fieldPackOfKey(key);
  if (pack) return mayHearFieldPack(req, pack);
  const tracks = await tracksByMediaKey(key);
  if (tracks.length === 0) return null;
  // A recording two tracks share (one master on two releases) is as open as
  // the more open of them: the bytes are the same either way.
  for (const track of tracks) {
    const [facts] = await gatherFacts(req, [track]);
    if (decideAudioAccess(facts)) return true;
  }
  return false;
}
