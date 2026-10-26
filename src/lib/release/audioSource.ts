/**
 * Where a track's audio actually lives, and how to reach it.
 *
 * Three kinds of value end up in `tracks.audio_url`, and only one of them is
 * fetchable as written:
 *
 *   1. `/api/media/audio/<r2 key>` — what shipping a master writes. Root
 *      relative, so it survives the domain changing under us, but the stream
 *      proxy runs on the edge and `fetch()` there needs an absolute URL.
 *
 *   2. `https://media.odubo.studio/<r2 key>` — what the transcode CLI has
 *      always written, from CLOUDFLARE_R2_PUBLIC_URL. That host is NXDOMAIN
 *      while the domain is lapsed, so every one of these is dead on arrival.
 *      Rewriting them to (1) is what makes existing rows play again without
 *      a migration.
 *
 *   3. Any other absolute URL — left exactly alone.
 *
 * `warehouse:<fileId>` also exists, but only in
 * distribution_release_tracks.audio_url, which is a delivery record and is
 * never played. If one reaches here it is treated as unplayable rather than
 * fetched.
 *
 * Pure and side-effect free so it can be unit tested; the routes supply the
 * origin.
 */

/** The R2 public host that no longer resolves. */
const DEAD_PUBLIC_HOSTS = ['media.odubo.studio'];

/** Where the proxy serves R2 objects from. */
export const MEDIA_PROXY_PREFIX = '/api/media/audio/';

/** R2 key prefixes the media proxy is willing to serve. */
export const SERVABLE_PREFIXES = ['warehouse/', 'music/'] as const;

export interface ResolvedAudio {
  /** Absolute URL to fetch, or null when there is nothing playable. */
  url: string | null;
  /** Why, when url is null. */
  reason?: 'missing' | 'not-playable';
  /** True when a dead public host was rewritten to the proxy. */
  rewritten: boolean;
}

/**
 * Turn a stored audio_url into something the stream proxy can fetch.
 *
 * @param audioUrl the raw column value
 * @param origin   the request's origin, e.g. https://example.com — never a
 *                 hardcoded domain; the caller reads it off the request
 */
export function resolveAudioSource(
  audioUrl: string | null | undefined,
  origin: string
): ResolvedAudio {
  if (!audioUrl || !audioUrl.trim()) {
    return { url: null, reason: 'missing', rewritten: false };
  }

  const value = audioUrl.trim();
  const base = origin.replace(/\/+$/, '');

  // A delivery pointer, not a playable location.
  if (value.startsWith('warehouse:')) {
    return { url: null, reason: 'not-playable', rewritten: false };
  }

  // Already root-relative — just make it absolute for the edge runtime.
  if (value.startsWith('/')) {
    return { url: `${base}${value}`, rewritten: false };
  }

  // A dead public host: keep the key, change the door.
  const deadHostKey = keyOnDeadHost(value);
  if (deadHostKey) {
    return { url: `${base}${MEDIA_PROXY_PREFIX}${deadHostKey}`, rewritten: true };
  }

  return { url: value, rewritten: false };
}

/** The R2 key in a URL on a dead public host, or null for any other URL. */
function keyOnDeadHost(value: string): string | null {
  for (const host of DEAD_PUBLIC_HOSTS) {
    const marker = `//${host}/`;
    const at = value.indexOf(marker);
    if (at !== -1) {
      const key = value.slice(at + marker.length).split('?')[0];
      if (key) return key;
    }
  }
  return null;
}

/**
 * Is this R2 key one the media proxy will serve?
 *
 * Deliberately narrow: the proxy hands out presigned reads with no auth, so
 * it must never become a way to enumerate the whole bucket. Path traversal is
 * refused outright rather than normalised.
 */
export function isServableKey(key: string): boolean {
  if (!key || key.includes('..') || key.startsWith('/')) return false;
  return SERVABLE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Extensions a browser will actually play.
 *
 * Mirrors canPlayAudioFormat() in src/lib/audioStreaming.ts, which gates
 * playback client-side on the extension of audio_url. AIFF is absent from
 * both — and that is the point: shipping an .aif master produces a track the
 * UI would render as enabled and that would then fail to play. Better to say
 * "transcode required" while the file is still in front of the owner.
 */
const PLAYABLE_EXTENSIONS = new Set([
  'mp3',
  'm4a',
  'mp4',
  'aac',
  'wav',
  'flac',
  'ogg',
  'oga',
  'webm',
  'mpga',
]);

export function extensionOf(pathOrUrl: string): string {
  const clean = pathOrUrl.split('?')[0].split('#')[0];
  const last = clean.split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  return dot > 0 ? last.slice(dot + 1).toLowerCase() : '';
}

export function isBrowserPlayable(pathOrUrl: string): boolean {
  return PLAYABLE_EXTENSIONS.has(extensionOf(pathOrUrl));
}

/**
 * Why a given master cannot be played straight from storage, or null when it
 * can. The message is shown to the owner, so it names the fix.
 */
export function unplayableReason(filename: string): string | null {
  const ext = extensionOf(filename);
  if (!ext) return 'This file has no extension, so the browser cannot tell what it is.';
  if (isBrowserPlayable(filename)) return null;
  if (ext === 'aif' || ext === 'aiff') {
    return 'Browsers do not play AIFF. Transcode it first, or ship a WAV or FLAC instead.';
  }
  return `Browsers do not play .${ext}. Transcode it first, or ship a WAV, FLAC or M4A.`;
}

/**
 * Where the HLS master playlist for a given audio URL would live.
 *
 * HLS is never stored — it is derived from audio_url on read, so the ladder
 * can gain a rung without a migration. `dir/song.web.m4a` becomes
 * `dir/song.hls/master.m3u8`.
 *
 * Handles root-relative paths as well as absolute URLs. The original
 * implementation used `new URL()` and so returned null for anything
 * relative, which would have silently disabled HLS for every track shipped
 * from the warehouse.
 *
 * Returns null when there is nothing sensible to derive — the caller treats
 * that as "no HLS", and playback falls back to the progressive stream.
 */
export function deriveHlsUrl(audioUrl: string | null | undefined): string | null {
  if (!audioUrl || typeof audioUrl !== 'string') return null;

  const toHls = (pathname: string): string | null => {
    const lastSlash = pathname.lastIndexOf('/');
    const dir = lastSlash >= 0 ? pathname.slice(0, lastSlash) : '';
    const file = lastSlash >= 0 ? pathname.slice(lastSlash + 1) : pathname;
    if (!file) return null;
    const dot = file.lastIndexOf('.');
    const nameNoExt = dot > 0 ? file.slice(0, dot) : file;

    // A `.hls/` directory is only ever written by transcode_audio_to_hls.ts,
    // and only beside a `.web.<ext>` file produced by transcode_audio_to_web.
    // Without that marker there is no manifest, and guessing one costs every
    // track a failed request before it falls back to the progressive stream —
    // which is exactly what made the whole album fail to start: the player
    // treats a 404 manifest as a fatal hls.js error.
    if (!nameNoExt.endsWith('.web')) return null;

    const baseName = nameNoExt.slice(0, -4);
    if (!baseName) return null;
    return `${dir}/${baseName}.hls/master.m3u8`;
  };

  if (audioUrl.startsWith('/')) {
    return toHls(audioUrl.split('?')[0]);
  }

  try {
    const url = new URL(audioUrl);
    const hlsPath = toHls(url.pathname);
    if (!hlsPath) return null;
    url.pathname = hlsPath;
    return url.toString();
  } catch {
    return null;
  }
}

/** The proxy's path, on this origin or written out with any other. */
const PROXY_PATH = /^(?:https?:\/\/[^/]+)?\/api\/media\/audio\/([^?#]+)/;

/** The path of an absolute URL on any host. */
const URL_PATH = /^https?:\/\/[^/]+\/([^?#]+)/;

/**
 * The R2 key a stored audio_url names, or null when it names nothing the
 * media proxy serves (a path outside its prefixes, a delivery pointer,
 * nothing at all).
 *
 * The audio gate (src/lib/loop/audioAccess.ts) needs this to know a key
 * however its track stores it. `/api/media/audio/<key>`, the same path with
 * an origin in front, `https://media.odubo.studio/<key>` and the bare key all
 * reach the same object: the stream route rewrites the dead host to the proxy
 * (resolveAudioSource, above), so a gate that knew only the first form served
 * the others to anyone. A URL on any other host gives its path, because that
 * is where the transcode scripts write its renditions in our bucket.
 */
export function mediaKeyOfAudioUrl(audioUrl: string | null | undefined): string | null {
  if (!audioUrl || typeof audioUrl !== 'string') return null;
  const value = audioUrl.trim();
  const key = PROXY_PATH.exec(value)?.[1] ?? keyOnDeadHost(value) ?? URL_PATH.exec(value)?.[1] ?? value;
  return isServableKey(key) ? key : null;
}

/** The `.hls/` directory a key sits in, or null. The nearest one, ending in `/`. */
export function hlsDirOfKey(key: string): string | null {
  const parts = key.split('/');
  // Directories only: a file that happens to end in .hls is not one.
  for (let i = parts.length - 2; i >= 0; i--) {
    if (parts[i].length > '.hls'.length && parts[i].endsWith('.hls')) {
      return `${parts.slice(0, i + 1).join('/')}/`;
    }
  }
  return null;
}

/**
 * The `.hls/` directory beside an audio key, where
 * scripts/transcode_audio_to_hls.ts writes that recording's playlists and
 * segments: named for the file without its extension or `.web`. Both
 * `dir/song.web.m4a` (what deriveHlsUrl plays) and a master `dir/song.wav`
 * (which the script also accepts) own `dir/song.hls/`.
 */
function hlsDirBeside(audioKey: string): string {
  const slash = audioKey.lastIndexOf('/');
  const file = audioKey.slice(slash + 1);
  const dot = file.lastIndexOf('.');
  const name = dot > 0 ? file.slice(0, dot) : file;
  const base = name.endsWith('.web') ? name.slice(0, -'.web'.length) : name;
  return `${audioKey.slice(0, slash + 1)}${base}.hls/`;
}

/**
 * Whether a media key is a track's own recording: the file its audio_url
 * names, in any form, or a playlist or segment of its HLS renditions.
 * Exact, and case-sensitive like R2: `song.hls/` is not `song-remix`'s.
 */
export function mediaKeyBelongsTo(key: string, audioUrl: string | null | undefined): boolean {
  const own = mediaKeyOfAudioUrl(audioUrl);
  if (!own) return false;
  if (own === key) return true;
  const dir = hlsDirOfKey(key);
  return dir !== null && dir === (hlsDirOfKey(own) ?? hlsDirBeside(own));
}

/** The columns that say where a track's recording is. */
const AUDIO_LOCATION_FIELDS = new Set(['audio_url', 'preview_url', 'hls_url']);

/**
 * A track as served to someone who may not hear it: everything but where the
 * recording is. audio_url, preview_url, hls_url and every `*_stem_url` come
 * back null, which is how the players already read "not playable".
 */
export function withoutAudio<T extends Record<string, unknown>>(track: T): T {
  const out: Record<string, unknown> = { ...track };
  for (const field of Object.keys(out)) {
    if (AUDIO_LOCATION_FIELDS.has(field) || field.endsWith('_stem_url')) out[field] = null;
  }
  return out as T;
}
