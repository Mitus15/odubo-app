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

/**
 * What a pass-holder hears before the record is out.
 *
 * The rule (owner, 2026-09-15): the single is free to everyone, and every
 * pass-holder is dealt TWO more at random from the rest of the album. Not the
 * same two — the draw is seeded by the listener, so the room compares notes
 * and between them they have heard most of it by the night. Their own two
 * never change: the seed is their address, so a new phone plays the same pair.
 *
 * Two kinds of track are never dealt. The intro, because opening someone's
 * first listen with the door-opener and nothing else is a worse gift than a
 * song. And the interludes — Loop Soul has three at thirty-five seconds —
 * because being dealt two of those instead of music would read as a mistake.
 */
const EARLY_ENABLED_KEY = "album_early_enabled";
const EARLY_EXTRA_KEY = "album_early_extra";
/** Anything shorter than this is an interlude, not one of the two you get. */
export const SKIT_MAX_SECONDS = 90;
const EARLY_EXTRA_DEFAULT = 2;

export type EarlyRule = { enabled: boolean; extra: number };

export async function earlyRule(): Promise<EarlyRule> {
  try {
    const [on, n] = await Promise.all([getSetting(EARLY_ENABLED_KEY), getSetting(EARLY_EXTRA_KEY)]);
    // An UNSET setting must mean the default, not zero. Number(null) is 0, not
    // NaN, so the obvious `Number(n)` check silently dealt every buyer nothing
    // but the free track — which is how a live email said "Welcome is yours to
    // hear right now" and offered one song, the intro, to everybody.
    const raw = (n ?? "").trim();
    const extra = raw === "" ? EARLY_EXTRA_DEFAULT : Number(raw);
    return {
      enabled: on !== "0",
      extra: Number.isInteger(extra) && extra >= 0 ? extra : EARLY_EXTRA_DEFAULT,
    };
  } catch {
    return { enabled: true, extra: EARLY_EXTRA_DEFAULT };
  }
}

export async function setEarlyRule(rule: Partial<EarlyRule>): Promise<void> {
  if (rule.enabled !== undefined) await setSetting(EARLY_ENABLED_KEY, rule.enabled ? "1" : "0");
  if (rule.extra !== undefined) {
    await setSetting(EARLY_EXTRA_KEY, String(Math.max(0, Math.min(Math.floor(rule.extra), 12))));
  }
}

type TrackLike = { track_number: number; title: string; duration?: number | null };

/** The same default `single.ts` uses, so the free song and the front door agree. */
export const DEFAULT_FREE_TITLE = "1984";

/**
 * The one everybody gets, free: whatever song the front door is playing.
 *
 * It must never be the intro or an interlude. The first version fell back to
 * `tracks[0]` when `featured_track` was unset — which in production it is —
 * and handed every buyer the intro as their one free song. A fallback that
 * can produce the exact thing the rule forbids is not a fallback.
 */
export function freeTrackNumber(tracks: TrackLike[], featured: string | null): number | null {
  const pick = (title: string) =>
    tracks.find((t) => t.title.trim().toLowerCase() === title.trim().toLowerCase());
  const proper = (t: TrackLike) => t.track_number !== 1 && (t.duration ?? 0) >= SKIT_MAX_SECONDS;

  const named = (featured ?? "").trim() ? pick(featured!.trim()) : undefined;
  if (named) return named.track_number;
  const fallback = pick(DEFAULT_FREE_TITLE);
  if (fallback) return fallback.track_number;
  return (tracks.find(proper) ?? tracks[0])?.track_number ?? null;
}

/** Everything that may be dealt: no intro, no interludes, not the free one. */
export function dealablePool(tracks: TrackLike[], free: number | null): number[] {
  return tracks
    .filter(
      (t) =>
        t.track_number !== 1 &&
        t.track_number !== free &&
        (t.duration ?? 0) >= SKIT_MAX_SECONDS,
    )
    .map((t) => t.track_number)
    .sort((a, b) => a - b);
}

/** FNV-1a. Small, stable, and the same answer on every machine forever. */
export function seedOf(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic shuffle: same listener, same order, always. */
function dealtFrom(pool: number[], seed: number, take: number): number[] {
  const a = [...pool];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, take)).sort((x, y) => x - y);
}

/**
 * The track numbers this listener may play before release: the free one, plus
 * their own draw. `listenerKey` should be the address, so the pair follows the
 * person rather than the phone.
 */
export function earlySetFor(
  listenerKey: string,
  tracks: TrackLike[],
  featured: string | null,
  rule: EarlyRule,
): number[] {
  if (!rule.enabled || tracks.length === 0) return [];
  const free = freeTrackNumber(tracks, featured);
  const dealt = dealtFrom(dealablePool(tracks, free), seedOf(listenerKey), rule.extra);
  return [...new Set([...(free ? [free] : []), ...dealt])].sort((a, b) => a - b);
}

// ── access ───────────────────────────────────────────────────────────────────

export type AlbumAccess = {
  released: boolean;
  /** Whether anything at all plays before release. The set is per listener. */
  early: EarlyRule;
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
    earlyRule(),
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
