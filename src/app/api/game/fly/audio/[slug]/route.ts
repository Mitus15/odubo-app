/**
 * GET /api/game/fly/audio/<slug>?k=<token>: a song, for the game.
 *
 * The owner decided every song on the album plays inside /fly for everyone.
 * That opens the GAME, not the record: /api/tracks and the album page keep
 * their own gate (src/lib/loop/audioAccess.ts) and nothing here touches it.
 * This route only answers a link the /fly page minted (src/lib/fly/audioGate.ts),
 * so the songs are reachable through the game and nowhere else.
 *
 * The owner can take it back without a deploy: loop_settings.fly_all_songs =
 * 'off' gates the game like the album page, and a released single (1984) still
 * plays. No row means open, because open is what the owner chose. A database
 * that cannot answer means gated: an unreleased record is the one thing here
 * worth protecting, and a wobble must not open it.
 *
 * Every refusal is the same bare 404, so a probe learns nothing about which
 * songs exist, which links were real or why. The token is never logged.
 */
import { NextRequest, NextResponse } from 'next/server';

import { queryDatabase } from '@/lib/db';
import { decideFlyAudio, flyAudioSecret, verifyFlyAudioToken } from '@/lib/fly/audioGate';
import { mayHearTrackId } from '@/lib/loop/audioAccess';
import { SONGS, type Song } from '@/lib/loop/songs';
import { MEDIA_PROXY_PREFIX, isServableKey, resolveAudioSource } from '@/lib/release/audioSource';
import { createStorageService } from '@/lib/storage/StorageService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The owner's switch, in loop_settings. */
const SWITCH_KEY = 'fly_all_songs';
/** Values that close the switch. Anything else, or no row, leaves it open. */
const SWITCH_OFF = new Set(['off', '0', 'false', 'no']);
/** A phone's audio element asks again on every seek; the switch need not. */
const SWITCH_CACHE_MS = 60_000;
/** A failed read closes the gate, but only briefly: a blip is not a decision. */
const SWITCH_ERROR_CACHE_MS = 10_000;
/** Where a song's file lives changes rarely; a minute is plenty fresh. */
const KEY_CACHE_MS = 60_000;
/** The presigned link outlives a level, so a long song never loses its source. */
const PRESIGN_SECONDS = 60 * 60;

let switchCache: { open: boolean; until: number } | null = null;
const keyCache = new Map<string, { key: string; until: number }>();

let warnedNoSecret = false;
function warnNoSecretOnce(): void {
  if (warnedNoSecret) return;
  warnedNoSecret = true;
  console.error('[fly:audio] FLY_AUDIO_SECRET and ANTHEM_VOTE_SECRET are both unset in production; the game plays silent');
}

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

/** True when every song plays. Missing row: open. 'off': gated. Error: gated. */
async function allSongsOpen(nowMs: number): Promise<boolean> {
  if (switchCache && nowMs < switchCache.until) return switchCache.open;
  let open: boolean;
  let ttl = SWITCH_CACHE_MS;
  try {
    const rows = (await queryDatabase('SELECT value FROM loop_settings WHERE key = ? LIMIT 1', [
      SWITCH_KEY,
    ])) as { value: string | null }[];
    const value = rows[0]?.value;
    open = rows.length === 0 || !SWITCH_OFF.has(String(value ?? '').trim().toLowerCase());
  } catch {
    open = false;
    ttl = SWITCH_ERROR_CACHE_MS;
  }
  switchCache = { open, until: nowMs + ttl };
  return open;
}

/** The site's own rule, for when the owner has gated the game. Fails closed. */
async function siteRuleAllows(req: NextRequest, song: Song): Promise<boolean> {
  try {
    return await mayHearTrackId(req, song.trackId);
  } catch {
    return false;
  }
}

/**
 * The R2 key behind a track, found the way the stream and media routes find
 * it: resolveAudioSource turns the stored audio_url into a media proxy URL,
 * and the key is the path after the proxy prefix, decoded per segment as
 * Next decodes [...key]. Anything else (an outside URL, a warehouse pointer)
 * has no key, and the caller refuses it.
 */
function r2KeyOf(audioUrl: string | null | undefined, origin: string): string | null {
  const resolved = resolveAudioSource(audioUrl, origin);
  if (!resolved.url) return null;
  try {
    const url = new URL(resolved.url);
    if (url.origin !== new URL(origin).origin || !url.pathname.startsWith(MEDIA_PROXY_PREFIX)) return null;
    return url.pathname
      .slice(MEDIA_PROXY_PREFIX.length)
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch {
    return null;
  }
}

async function keyForSong(song: Song, origin: string, nowMs: number): Promise<string | null> {
  const cached = keyCache.get(song.trackId);
  if (cached && nowMs < cached.until) return cached.key;
  const rows = (await queryDatabase('SELECT audio_url FROM tracks WHERE id = ? LIMIT 1', [song.trackId])) as {
    audio_url: string | null;
  }[];
  const key = r2KeyOf(rows[0]?.audio_url, origin);
  if (!key || !isServableKey(key)) return null;
  keyCache.set(song.trackId, { key, until: nowMs + KEY_CACHE_MS });
  return key;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const nowMs = Date.now();
  const { slug } = await ctx.params;

  // Exact match: the token is signed over the canonical slug.
  const song = SONGS.find((s) => s.slug === slug);
  const secret = flyAudioSecret();
  if (song && !secret) warnNoSecretOnce();
  const known = !!song;
  const tokenOk = !!song && (await verifyFlyAudioToken(song.slug, req.nextUrl.searchParams.get('k'), nowMs, secret));
  // A stranger's guess never reaches the database.
  if (!song || !tokenOk) return notFound();

  const open = await allSongsOpen(nowMs);
  const gateAllows = open ? false : await siteRuleAllows(req, song);
  if (decideFlyAudio({ known, tokenOk, open, gateAllows }) !== 'serve') return notFound();

  try {
    const key = await keyForSong(song, req.nextUrl.origin, nowMs);
    if (!key) {
      console.warn(`[fly:audio] ${song.slug} has no servable audio file`);
      return notFound();
    }
    const url = await createStorageService().getPresignedUrl({
      key,
      operation: 'get',
      expiresIn: PRESIGN_SECONDS,
    });
    return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error(`[fly:audio] ${song.slug} could not be served:`, err instanceof Error ? err.message : 'unknown');
    return notFound();
  }
}
