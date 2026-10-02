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
  hlsDirOfKey,
  isBrowserPlayable,
  isServableKey,
  mediaKeyBelongsTo,
  mediaKeyOfAudioUrl,
  resolveAudioSource,
  unplayableReason,
  withoutAudio,
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

  it('refuses to invent a manifest for a file with no .web marker', () => {
    // Only transcode_audio_to_hls writes a .hls/ directory, and only beside a
    // .web.<ext> file. Deriving a URL for anything else advertises a manifest
    // that 404s — and the player treats that as a fatal hls.js error rather
    // than falling through, so the track never starts.
    expect(deriveHlsUrl('/api/media/audio/warehouse/p/master/1-song.wav')).toBeNull();
    expect(deriveHlsUrl('/api/media/audio/warehouse/p/commercial/1788-welcome.m4a')).toBeNull();
  });

  it('returns null when there is nothing to derive', () => {
    expect(deriveHlsUrl(null)).toBeNull();
    expect(deriveHlsUrl('')).toBeNull();
    expect(deriveHlsUrl('not a url at all')).toBeNull();
  });
});

/**
 * Which R2 keys are a track's own recording. The audio gate knew only a key
 * equal to audio_url, so until 2026-10-02 the media proxy served an unreleased
 * track's HLS files, and the key of a track still stored on the dead host, to
 * anyone.
 */
describe('mediaKeyOfAudioUrl', () => {
  const KEY = 'warehouse/p/commercial/1788-news-peak.m4a';

  it('reads the key out of every form audio_url takes', () => {
    for (const stored of [
      `/api/media/audio/${KEY}`,
      `https://odubo.studio/api/media/audio/${KEY}`,
      `https://media.odubo.studio/${KEY}`,
      `http://media.odubo.studio/${KEY}?v=2`,
      KEY,
      `  /api/media/audio/${KEY}?download=1 `,
    ]) {
      expect(mediaKeyOfAudioUrl(stored)).toBe(KEY);
    }
  });

  it('agrees with the door the stream route opens for a dead-host URL', () => {
    const stored = `https://media.odubo.studio/${KEY}?v=2`;
    expect(resolveAudioSource(stored, ORIGIN).url).toBe(`${ORIGIN}/api/media/audio/${mediaKeyOfAudioUrl(stored)}`);
  });

  it('names nothing the proxy would not serve', () => {
    for (const stored of [
      null,
      undefined,
      '',
      'warehouse:8f2c1a',
      'https://cdn.example.com/audio/track.mp3',
      '/api/media/audio/galleries/private.jpg',
      '/api/media/audio/warehouse/../galleries/private.jpg',
    ]) {
      expect(mediaKeyOfAudioUrl(stored)).toBeNull();
    }
  });
});

describe('hlsDirOfKey', () => {
  it('finds the .hls/ directory a playlist or segment sits in', () => {
    expect(hlsDirOfKey('warehouse/p/song.hls/master.m3u8')).toBe('warehouse/p/song.hls/');
    expect(hlsDirOfKey('warehouse/p/song.hls/seg_0_003.aac')).toBe('warehouse/p/song.hls/');
    expect(hlsDirOfKey('warehouse/p/song.hls/v0/seg_0_003.aac')).toBe('warehouse/p/song.hls/');
  });

  it('is null for anything else', () => {
    expect(hlsDirOfKey('warehouse/p/song.web.m4a')).toBeNull();
    expect(hlsDirOfKey('warehouse/p/song.hls')).toBeNull();
    expect(hlsDirOfKey('warehouse/.hls/x.aac')).toBeNull();
  });
});

describe('mediaKeyBelongsTo', () => {
  const WEB = '/api/media/audio/warehouse/p/1788-news-peak.web.m4a';

  it('knows the file itself', () => {
    expect(mediaKeyBelongsTo('warehouse/p/1788-news-peak.web.m4a', WEB)).toBe(true);
  });

  it('knows every playlist and segment of the HLS deriveHlsUrl plays', () => {
    const master = deriveHlsUrl(WEB)!.slice('/api/media/audio/'.length);
    expect(master).toBe('warehouse/p/1788-news-peak.hls/master.m3u8');
    expect(mediaKeyBelongsTo(master, WEB)).toBe(true);
    expect(mediaKeyBelongsTo('warehouse/p/1788-news-peak.hls/v1.m3u8', WEB)).toBe(true);
    expect(mediaKeyBelongsTo('warehouse/p/1788-news-peak.hls/seg_1_012.aac', WEB)).toBe(true);
  });

  it('knows the HLS the transcode script writes beside a master', () => {
    const master = '/api/media/audio/warehouse/p/1788-news-peak.m4a';
    expect(mediaKeyBelongsTo('warehouse/p/1788-news-peak.hls/master.m3u8', master)).toBe(true);
  });

  it('knows a dead-host track, and its HLS, by the key alone', () => {
    const dead = 'https://media.odubo.studio/music/albums/x/tracks/01-a.web.m4a';
    expect(mediaKeyBelongsTo('music/albums/x/tracks/01-a.web.m4a', dead)).toBe(true);
    expect(mediaKeyBelongsTo('music/albums/x/tracks/01-a.hls/master.m3u8', dead)).toBe(true);
  });

  it('is exact: a name that starts the same is another song', () => {
    expect(mediaKeyBelongsTo('warehouse/p/1788-news.hls/master.m3u8', WEB)).toBe(false);
    expect(mediaKeyBelongsTo('warehouse/p/1788-news-peak-remix.hls/master.m3u8', WEB)).toBe(false);
    expect(mediaKeyBelongsTo('warehouse/q/1788-news-peak.hls/master.m3u8', WEB)).toBe(false);
    expect(mediaKeyBelongsTo('warehouse/p/1788-News-Peak.hls/master.m3u8', WEB)).toBe(false);
    expect(mediaKeyBelongsTo('warehouse/p/1788-news-peak.web.m4a.bak', WEB)).toBe(false);
  });

  it('claims nothing for a track with no servable audio', () => {
    expect(mediaKeyBelongsTo('warehouse/p/x.hls/master.m3u8', null)).toBe(false);
    expect(mediaKeyBelongsTo('warehouse/p/x.hls/master.m3u8', 'https://cdn.example.com/p/x.web.m4a')).toBe(false);
  });
});

describe('withoutAudio', () => {
  it('keeps the track and drops every way to play it', () => {
    const track = {
      id: 't1',
      title: 'News Peak',
      duration: 240,
      audio_url: '/api/media/audio/warehouse/p/a.web.m4a',
      preview_url: '/api/media/audio/warehouse/p/a-preview.m4a',
      hls_url: '/api/media/audio/warehouse/p/a.hls/master.m3u8',
      vocal_stem_url: 'https://media.odubo.studio/music/v.m4a',
      drum_stem_url: 'https://media.odubo.studio/music/d.m4a',
      bass_stem_url: null,
      other_stem_url: 'https://media.odubo.studio/music/o.m4a',
    };
    expect(withoutAudio(track)).toEqual({
      id: 't1',
      title: 'News Peak',
      duration: 240,
      audio_url: null,
      preview_url: null,
      hls_url: null,
      vocal_stem_url: null,
      drum_stem_url: null,
      bass_stem_url: null,
      other_stem_url: null,
    });
    expect(track.audio_url).toBe('/api/media/audio/warehouse/p/a.web.m4a');
  });

  it('adds no field the track did not have', () => {
    expect(withoutAudio({ id: 't1', audio_url: 'x' })).toEqual({ id: 't1', audio_url: null });
  });
});
