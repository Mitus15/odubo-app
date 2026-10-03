/**
 * The game's own door to the album's audio.
 *
 * The owner chose to let every one of the fourteen songs play inside /fly for
 * everyone. That is a decision about the GAME, not about the record: the album
 * page and /api/tracks stay exactly as gated as they are. So the game gets its
 * own route, and that route only answers a link the /fly page itself handed
 * out. A token is the page's signature on "this song, until then": it proves
 * the request came through the game, it cannot be moved to another song, and
 * it runs out, so a copied link stops working within hours.
 *
 * Pure apart from Web Crypto, so it runs the same in a route, in a server
 * component and in a test.
 */

/** How long a link the page hands out keeps working. */
export const FLY_AUDIO_TOKEN_SECONDS = 6 * 60 * 60;

/** A link minted a little ahead by a server whose clock runs fast still works. */
const CLOCK_SKEW_SECONDS = 5 * 60;

/** Local work only. Production never falls back to this (see flyAudioSecret). */
const DEV_SECRET = 'fly-audio-dev-secret-local-only';

/** Every token signs this, so a fly signature means nothing anywhere else. */
const MESSAGE_PREFIX = 'fly-audio:';

/** Base64url of 32 bytes, unpadded. */
const TOKEN_PATTERN = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/;

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The key the game's links are signed with, or null when there is none.
 *
 * FLY_AUDIO_SECRET first; ANTHEM_VOTE_SECRET is already set wherever the site
 * runs, so the game works on day one without a new variable. In production
 * with neither, it fails CLOSED: no links are minted and every request is a
 * 404. A committed dev key in production would let anyone who reads the repo
 * mint links. Locally a fixed key keeps work frictionless.
 */
export function flyAudioSecret(env: Env = process.env): string | null {
  const own = env.FLY_AUDIO_SECRET?.trim();
  if (own) return own;
  const shared = env.ANTHEM_VOTE_SECRET?.trim();
  if (shared) return shared;
  if (env.NODE_ENV === 'production') return null;
  return DEV_SECRET;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant time, so a forger cannot learn the signature a byte at a time. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const encoder = new TextEncoder();

async function hmac(key: Uint8Array<ArrayBuffer> | string, message: string): Promise<Uint8Array<ArrayBuffer>> {
  const raw = typeof key === 'string' ? encoder.encode(key) : key;
  const imported = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, encoder.encode(message)));
}

/**
 * The secret may be shared with the anthem's vote cookies, which are also
 * HMACs. Signing with a key derived for this one purpose means a fly link can
 * never be replayed as a vote cookie, or the other way round.
 */
const derivedKeys = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
function flyKey(secret: string): Promise<Uint8Array<ArrayBuffer>> {
  let key = derivedKeys.get(secret);
  if (!key) {
    key = hmac(secret, 'odubo fly audio key v1');
    derivedKeys.set(secret, key);
    // A failure is not remembered: the next request tries again.
    key.catch(() => derivedKeys.delete(secret));
  }
  return key;
}

async function sign(slug: string, exp: number, secret: string): Promise<string> {
  return toBase64Url(await hmac(await flyKey(secret), `${MESSAGE_PREFIX}${slug}:${exp}`));
}

/** `<exp unix seconds>.<signature>`, good for six hours from nowMs. */
export async function mintFlyAudioToken(slug: string, nowMs: number, secret: string): Promise<string> {
  if (!secret) throw new Error('mintFlyAudioToken needs a secret');
  const exp = Math.floor(nowMs / 1000) + FLY_AUDIO_TOKEN_SECONDS;
  return `${exp}.${await sign(slug, exp, secret)}`;
}

/** True only for an unexpired token minted for exactly this slug. */
export async function verifyFlyAudioToken(
  slug: string,
  token: string | null | undefined,
  nowMs: number,
  secret: string | null | undefined,
): Promise<boolean> {
  if (!secret || !token) return false;
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return false;
  const exp = Number(match[1]);
  const now = Math.floor(nowMs / 1000);
  if (exp <= now) return false;
  // Nothing this side mints further ahead than this.
  if (exp - now > FLY_AUDIO_TOKEN_SECONDS + CLOCK_SKEW_SECONDS) return false;
  try {
    return safeEqual(match[2], await sign(slug, exp, secret));
  } catch {
    return false;
  }
}

export interface FlyAudioFacts {
  /** The slug is one of the album's fourteen songs. */
  known: boolean;
  /** The link was minted by the /fly page, for this song, and is unexpired. */
  tokenOk: boolean;
  /** The owner's switch (loop_settings.fly_all_songs) leaves every song open. */
  open: boolean;
  /** The site's own listening rule would let this person hear it anyway. */
  gateAllows: boolean;
}

export type FlyAudioVerdict = 'serve' | 'not-found';

/** The whole rule, pure, so the route cannot drift from the test. */
export function decideFlyAudio(f: FlyAudioFacts): FlyAudioVerdict {
  return f.known && f.tokenOk && (f.open || f.gateAllows) ? 'serve' : 'not-found';
}
