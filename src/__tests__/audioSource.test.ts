/**
 * resolveAudioSource — the thing standing between thirteen silent tracks and
 * a preview that plays.
 *
 * Two failures live here. The stream proxy runs on the edge, where fetch()
 * refuses a relative URL, so a root-relative audio_url must be absolutised.
 * And every row the transcode CLI has ever written points at
 * media.odubo.studio, which stopped resolving when the domain lapsed — those
 * have to be rewritten to the proxy or the preview stays silent even after a
 * successful transcode.
 */
import {
  deriveHlsUrl,
  extensionOf,
  isBrowserPlayable,
  isServableKey,
  resolveAudioSource,
  unplayableReason,
} from '@/lib/release/audioSource';

const ORIGIN = 'https://example.test';

describe('resolveAudioSource', () => {
  it('absolutises a root-relative proxy path against the request origin', () => {
    const out = resolveAudioSource('/api/media/audio/warehouse/p/master/x.wav', ORIGIN);
    expect(out.url).toBe(`${ORIGIN}/api/media/audio/warehouse/p/master/x.wav`);
    expect(out.rewritten).toBe(false);
  });

  it('rewrites the dead public host, keeping the key', () => {
    const out = resolveAudioSource(
      'https://media.odubo.studio/music/albums/loop-soul/tracks/01-welcome.web.m4a',
      ORIGIN
    );
    expect(out.url).toBe(
      `${ORIGIN}/api/media/audio/music/albums/loop-soul/tracks/01-welcome.web.m4a`
    );
    expect(out.rewritten).toBe(true);
  });

  it('drops a query string when rewriting the dead host', () => {
    const out = resolveAudioSource('https://media.odubo.studio/music/a.m4a?v=2', ORIGIN);
    expect(out.url).toBe(`${ORIGIN}/api/media/audio/music/a.m4a`);
  });

  it('leaves an unrelated absolute URL untouched', () => {
    const url = 'https://cdn.example.com/audio/track.mp3';
    const out = resolveAudioSource(url, ORIGIN);
    expect(out.url).toBe(url);
    expect(out.rewritten).toBe(false);
  });

  it('never returns a relative URL — the edge runtime cannot fetch one', () => {
    for (const input of [
      '/api/media/audio/warehouse/a.wav',
      'https://media.odubo.studio/music/b.m4a',
      'https://cdn.example.com/c.mp3',
    ]) {
      const out = resolveAudioSource(input, ORIGIN);
      expect(out.url).toMatch(/^https?:\/\//);
    }
  });

  it('tolerates a trailing slash on the origin', () => {
    const out = resolveAudioSource('/api/media/audio/warehouse/x.wav', 'https://example.test/');
    expect(out.url).toBe('https://example.test/api/media/audio/warehouse/x.wav');
  });

  it('reports a missing value rather than inventing one', () => {
    for (const empty of [null, undefined, '', '   ']) {
      const out = resolveAudioSource(empty, ORIGIN);
      expect(out.url).toBeNull();
      expect(out.reason).toBe('missing');
    }
  });

  it('refuses to play a warehouse: delivery pointer', () => {
    const out = resolveAudioSource('warehouse:8f2c1a', ORIGIN);
    expect(out.url).toBeNull();
    expect(out.reason).toBe('not-playable');
  });
});

describe('isServableKey', () => {
  it('serves the warehouse and music prefixes', () => {
    expect(isServableKey('warehouse/proj/master/audio-master/1-x.wav')).toBe(true);
    expect(isServableKey('music/albums/loop-soul/tracks/01-welcome.web.m4a')).toBe(true);
  });

  it('refuses anything else, so the proxy is not a bucket browser', () => {
    expect(isServableKey('galleries/secret.jpg')).toBe(false);
    expect(isServableKey('videos/source/2026/08/private.mp4')).toBe(false);
    expect(isServableKey('')).toBe(false);
  });

  it('refuses traversal rather than normalising it', () => {
    expect(isServableKey('warehouse/../galleries/secret.jpg')).toBe(false);
    expect(isServableKey('/warehouse/x.wav')).toBe(false);
  });
});

describe('browser playability', () => {
  it('reads the extension off a path or a URL with a query', () => {
    expect(extensionOf('a/b/c.WAV')).toBe('wav');
    expect(extensionOf('https://x/y.m4a?sig=abc')).toBe('m4a');
    expect(extensionOf('noextension')).toBe('');
  });

  it('accepts what browsers actually play', () => {
    for (const f of ['x.wav', 'x.mp3', 'x.m4a', 'x.flac']) {
      expect(isBrowserPlayable(f)).toBe(true);
    }
  });

  it('rejects AIFF — the trap that would ship a track that cannot play', () => {
    expect(isBrowserPlayable('master.aiff')).toBe(false);
    expect(isBrowserPlayable('master.aif')).toBe(false);
    expect(unplayableReason('master.aiff')).toMatch(/AIFF/);
  });

  it('names the fix for other formats', () => {
    expect(unplayableReason('session.logicx')).toMatch(/Transcode/i);
    expect(unplayableReason('master.wav')).toBeNull();
    expect(unplayableReason('nodots')).toMatch(/no extension/i);
  });
});

describe('deriveHlsUrl', () => {
  it('derives the playlist from an absolute web URL', () => {
    expect(deriveHlsUrl('https://cdn.test/music/albums/x/tracks/01-a.web.m4a')).toBe(
      'https://cdn.test/music/albums/x/tracks/01-a.hls/master.m3u8'
    );
  });

  it('handles a root-relative proxy path — the case new URL() could not', () => {
    expect(deriveHlsUrl('/api/media/audio/music/albums/x/tracks/01-a.web.m4a')).toBe(
      '/api/media/audio/music/albums/x/tracks/01-a.hls/master.m3u8'
    );
  });

  it('works for a raw master with no .web suffix', () => {
    expect(deriveHlsUrl('/api/media/audio/warehouse/p/master/1-song.wav')).toBe(
      '/api/media/audio/warehouse/p/master/1-song.hls/master.m3u8'
    );
  });

  it('returns null when there is nothing to derive', () => {
    expect(deriveHlsUrl(null)).toBeNull();
    expect(deriveHlsUrl('')).toBeNull();
    expect(deriveHlsUrl('not a url at all')).toBeNull();
  });
});
