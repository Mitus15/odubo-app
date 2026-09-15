import { executeQuery, queryDatabase, queryOne } from "@/lib/loop/db";
import { queryDatabase as appQuery } from "@/lib/db";
import { isHolder } from "@/lib/loop/event-codes";
import { attendeeForVoter } from "@/lib/loop/identity";
import { LOOP_SOUL_ALBUM_ID } from "@/lib/loop/ballots";
import { getSetting, setSetting } from "@/lib/loop/loopSetting";
import type { Album, Track } from "@/types/music";

/**
 * The record, delivered.
 *
 * A pass is a pre-order. This is the ledger that makes that true: who is owed
 * the album, written at the moment of purchase, and the two questions the
 * listening page asks afterwards — is it out yet, and is this person owed it.
 *
 * Access is decided by the same proof as everything else in Loop Soul: the
 * checkout email. A device that has proven its inbox at /loop/code is bound to
 * an attendee carrying that email, and the entitlement is keyed on the email.
 * A device that redeemed a code is a holder and is let in the same way. There
 * is no third path and no password.
 */

export const ALBUM_ID = LOOP_SOUL_ALBUM_ID;
const RELEASED_KEY = "album_released";
const EARLY_KEY = "album_early_tracks";
/** What an owed listener may hear BEFORE the record is out. Unset means the
 *  opening three; an explicit empty setting means nothing until release. The
 *  owner picks the tracks from /loop/admin, one tap each. */
const EARLY_DEFAULT = [1, 2, 3];

export function normEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// ── the ledger ───────────────────────────────────────────────────────────────

/** Grant one pass unit's share of the record. Idempotent on the order id. Never throws. */
export async function grantAlbumForOrder(
  email: string | null,
  orderId: string,
  eventId: string,
  albumId: string = ALBUM_ID,
): Promise<boolean> {
  if (!email) return false;
  try {
    const id = `ent_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const meta = await executeQuery(
      `INSERT OR IGNORE INTO loop_album_entitlements (id, album_id, email, source, order_id, event_id, granted_at)
       VALUES (?1, ?2, ?3, 'pass', ?4, ?5, ?6)`,
      [id, albumId, normEmail(email), orderId, eventId, new Date().toISOString()],
    );
    return meta.changes > 0;
  } catch (err) {
    // The money path must not fail because the ledger did. Loud, then on.
    console.error("[loop:album] entitlement NOT written:", orderId, err);
    return false;
  }
}

/** Every real pass order that has no entitlement yet gets one. Safe to rerun. */
export async function backfillFromCodes(eventId: string, albumId: string = ALBUM_ID): Promise<number> {
  const rows = await queryDatabase<{ order_id: string; email: string }>(
    `SELECT c.order_id, c.email FROM event_codes c
      WHERE c.event_id = ?1 AND c.order_id IS NOT NULL AND c.order_id NOT LIKE 'sim:%' AND c.email IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM loop_album_entitlements e WHERE e.album_id = ?2 AND e.order_id = c.order_id)`,
    [eventId, albumId],
  );
  let n = 0;
  for (const r of rows) if (await grantAlbumForOrder(r.email, r.order_id, eventId, albumId)) n++;
  return n;
}

export async function isEntitled(email: string | null | undefined, albumId: string = ALBUM_ID): Promise<boolean> {
  if (!email) return false;
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM loop_album_entitlements WHERE album_id = ?1 AND email = ?2`,
    [albumId, normEmail(email)],
  );
  return (row?.n ?? 0) > 0;
}

export async function markClaimed(email: string, albumId: string = ALBUM_ID): Promise<void> {
  await executeQuery(
    `UPDATE loop_album_entitlements SET claimed_at = COALESCE(claimed_at, ?3) WHERE album_id = ?1 AND email = ?2`,
    [albumId, normEmail(email), new Date().toISOString()],
  );
}

export type EntitlementStats = { entitled: number; addresses: number; notified: number; claimed: number };

export async function entitlementStats(albumId: string = ALBUM_ID): Promise<EntitlementStats> {
  const row = await queryOne<EntitlementStats>(
    `SELECT COUNT(*) AS entitled, COUNT(DISTINCT email) AS addresses,
            COUNT(notified_at) AS notified, COUNT(claimed_at) AS claimed
       FROM loop_album_entitlements WHERE album_id = ?1`,
    [albumId],
  );
  return row ?? { entitled: 0, addresses: 0, notified: 0, claimed: 0 };
}

/** Addresses owed the record that have not been told it is out. One per inbox. */
export async function unnotifiedAddresses(albumId: string = ALBUM_ID): Promise<string[]> {
  const rows = await queryDatabase<{ email: string }>(
    `SELECT DISTINCT email FROM loop_album_entitlements WHERE album_id = ?1 AND notified_at IS NULL ORDER BY email`,
    [albumId],
  );
  return rows.map((r) => r.email);
}

export async function markNotified(email: string, albumId: string = ALBUM_ID): Promise<void> {
  await executeQuery(
    `UPDATE loop_album_entitlements SET notified_at = ?3 WHERE album_id = ?1 AND email = ?2 AND notified_at IS NULL`,
    [albumId, normEmail(email), new Date().toISOString()],
  );
}

// ── released or not ──────────────────────────────────────────────────────────

/** The owner's switch. Nothing derives this from a date: the record is out when he says so. */
export async function albumReleased(): Promise<boolean> {
  try {
    const row = await queryOne<{ value: string }>(`SELECT value FROM loop_settings WHERE key = ?1`, [RELEASED_KEY]);
    return row?.value === "1";
  } catch {
    return false;
  }
}

export async function setAlbumReleased(released: boolean): Promise<void> {
  await setSetting(RELEASED_KEY, released ? "1" : "0");
}

// ── early tracks ─────────────────────────────────────────────────────────────

/** "1,2,3" → [1, 2, 3]. Null (never set) falls back to the default; "" is none. */
export function parseEarlyTracks(raw: string | null | undefined): number[] {
  if (raw == null) return EARLY_DEFAULT;
  const nums = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

export async function earlyTrackNumbers(): Promise<number[]> {
  try {
    return parseEarlyTracks(await getSetting(EARLY_KEY));
  } catch {
    return EARLY_DEFAULT;
  }
}

export async function setEarlyTracks(nums: number[]): Promise<void> {
  const clean = parseEarlyTracks(nums.join(","));
  await setSetting(EARLY_KEY, clean.join(","));
}

// ── access ───────────────────────────────────────────────────────────────────

export type AlbumAccess = {
  released: boolean;
  /** Track numbers that play before release. Empty means wait. */
  early: number[];
  /** This device proved an inbox that is owed the record. */
  entitled: boolean;
  /** This device redeemed a pass (a holder), which also counts. */
  holder: boolean;
  email: string | null;
};

/** The one rule, pure so it is under test. */
export function decideAlbumAccess(
  a: Pick<AlbumAccess, "released" | "entitled" | "holder"> & { early?: boolean },
): "listen" | "early" | "wait" | "prove" {
  const owed = a.entitled || a.holder;
  if (!owed) return "prove";
  if (a.released) return "listen";
  return a.early ? "early" : "wait";
}

export async function albumAccessFor(eventId: string, voterId: string): Promise<AlbumAccess> {
  const [released, early, attendee, holder] = await Promise.all([
    albumReleased(),
    earlyTrackNumbers(),
    attendeeForVoter(voterId),
    voterId && voterId !== "anonymous" ? isHolder(eventId, voterId) : Promise.resolve(false),
  ]);
  const email = attendee?.email ?? null;
  return { released, early, entitled: await isEntitled(email), holder, email };
}

// ── the record itself ────────────────────────────────────────────────────────

export async function loadAlbum(albumId: string = ALBUM_ID): Promise<{ album: Album; tracks: Track[] } | null> {
  const albums = (await appQuery(`SELECT * FROM albums WHERE id = ?`, [albumId])) as Album[];
  if (!albums.length) return null;
  const tracks = (await appQuery(`SELECT * FROM tracks WHERE album_id = ? ORDER BY track_number ASC`, [albumId])) as Track[];
  return { album: albums[0], tracks };
}
