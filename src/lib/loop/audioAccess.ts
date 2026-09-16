import type { NextRequest } from "next/server";
import { queryDatabase } from "@/lib/db";
import { verifyUserFromRequest, isAdminUser } from "@/lib/auth";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/loop/admin-auth";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/identity/voter";
import { albumAccessFor, earlySetFor } from "@/lib/loop/album";
import { getSetting } from "@/lib/loop/loopSetting";

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
  /** The song behind the flyer's QR. Promised publicly, so it stays public. */
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
 * The track a media key belongs to, or null when the key is not a track at all
 * (a master in the warehouse, a field stem). Those keep their existing
 * behaviour: this function only ever tightens the catalogue.
 */
async function trackByMediaKey(key: string): Promise<TrackRow | null> {
  const rows = (await queryDatabase(
    `SELECT t.id, t.album_id, t.track_number, t.title, a.status AS album_status
       FROM tracks t LEFT JOIN albums a ON a.id = t.album_id
      WHERE t.audio_url = ? OR t.audio_url = ? LIMIT 1`,
    [`/api/media/audio/${key}`, key],
  )) as TrackRow[];
  return rows[0] ?? null;
}

async function gatherFacts(req: NextRequest | null, track: TrackRow): Promise<AudioFacts> {
  const albumPublished = (track.album_status ?? "").toLowerCase() === "published";

  // A published album needs none of the rest, and asking would cost four
  // round trips on the hot path of a public catalogue.
  if (albumPublished) {
    return {
      albumPublished: true,
      isFeaturedSingle: false,
      isAdmin: false,
      owed: false,
      albumReleased: false,
      inEarlySet: false,
    };
  }

  const [featured, loopAdminOk, odubo] = await Promise.all([
    getSetting("featured_track").catch(() => null),
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
  const isFeaturedSingle = track.title.trim().toLowerCase() === wanted;
  const isAdmin = loopAdminOk || isAdminUser(odubo);

  if (isFeaturedSingle || isAdmin) {
    return { albumPublished, isFeaturedSingle, isAdmin, owed: false, albumReleased: false, inEarlySet: false };
  }

  try {
    const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
    const access = await albumAccessFor(event.id, voterId);
    const owed = access.entitled || access.holder;
    if (!owed) {
      return { albumPublished, isFeaturedSingle, isAdmin, owed: false, albumReleased: access.released, inEarlySet: false };
    }
    // Owed, but before release only their own draw plays. Otherwise a
    // pass-holder could pull all fourteen through the API while the page
    // shows them three.
    const { loadAlbum } = await import("@/lib/loop/album");
    const data = await loadAlbum(track.album_id ?? undefined);
    const inEarlySet =
      !!data &&
      earlySetFor(access.email ?? voterId, data.tracks, featured, access.early).includes(track.track_number);
    return { albumPublished, isFeaturedSingle, isAdmin, owed, albumReleased: access.released, inEarlySet };
  } catch {
    // The gate fails CLOSED. An unreleased record is the one thing here worth
    // protecting, and a database wobble must not open it.
    return { albumPublished, isFeaturedSingle, isAdmin, owed: false, albumReleased: false, inEarlySet: false };
  }
}

export async function mayHearTrackId(req: NextRequest | null, trackId: string): Promise<boolean> {
  const track = await trackById(trackId);
  if (!track) return false;
  return decideAudioAccess(await gatherFacts(req, track));
}

/** null when the key is not a catalogue track — the caller leaves it alone. */
export async function mayHearMediaKey(req: NextRequest | null, key: string): Promise<boolean | null> {
  const track = await trackByMediaKey(key);
  if (!track) return null;
  return decideAudioAccess(await gatherFacts(req, track));
}
