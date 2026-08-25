/**
 * Tests for the R2 key-generation layer.
 *
 * These paths become permanent object keys in the bucket: a change in the
 * shape here orphans every file already stored under the old scheme, so the
 * assertions are deliberately literal.
 *
 * Replaces the ad-hoc `test-file-organization.mjs` at the repo root, which
 * printed to stdout, asserted nothing, and had drifted to an older API
 * (`fileType: 'track' | 'album-cover' | 'video'`) that no longer exists.
 */
import {
  generateFilePath,
  getMimeType,
  sanitizeFileName,
  toSlug,
  validateFileType,
  parseFilePath,
} from '@/lib/fileOrganization';

describe('sanitizeFileName', () => {
  it('replaces whitespace runs with a single underscore', () => {
    expect(sanitizeFileName('my   song.mp3')).toBe('my_song.mp3');
  });

  it('strips characters that are unsafe in an object key', () => {
    expect(sanitizeFileName('My Song (feat. Artist) [2024].mp3')).toBe(
      'My_Song_feat._Artist_2024_.mp3'
    );
  });

  it('preserves case, dots, and hyphens', () => {
    expect(sanitizeFileName('Album-Cover.v2.JPG')).toBe('Album-Cover.v2.JPG');
  });

  it('collapses repeated underscores introduced by stripping', () => {
    expect(sanitizeFileName('a///b???c.png')).toBe('a_b_c.png');
  });

  it('trims leading and trailing separators', () => {
    expect(sanitizeFileName('  __weird-name__  ')).toBe('weird-name');
  });

  it('neutralises path traversal segments', () => {
    // A key must never be able to climb out of its prefix.
    const result = sanitizeFileName('../../etc/passwd');
    expect(result).not.toContain('..');
    expect(result).not.toContain('/');
  });
});

describe('toSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(toSlug('Summer Block Party')).toBe('summer-block-party');
  });

  it('collapses runs and trims stray hyphens', () => {
    expect(toSlug('  --Loop  Soul!!  --')).toBe('loop-soul');
  });

  it('returns an empty string for empty input', () => {
    expect(toSlug('')).toBe('');
  });
});

describe('generateFilePath', () => {
  it('routes gallery photos under the gallery folder', () => {
    expect(
      generateFilePath({
        fileType: 'gallery-photo',
        galleryName: 'Summer Block Party',
        fileName: 'shot1.jpg',
      })
    ).toBe('galleries/summer-block-party/photos/shot1.jpg');
  });

  it('routes gallery videos under a sibling folder', () => {
    expect(
      generateFilePath({
        fileType: 'gallery-video',
        galleryName: 'Summer Block Party',
        fileName: 'clip1.mp4',
      })
    ).toBe('galleries/summer-block-party/videos/clip1.mp4');
  });

  it('prefers the friendly gallery name over code, slug, and id', () => {
    expect(
      generateFilePath({
        fileType: 'gallery-photo',
        galleryName: 'Launch Night',
        galleryCode: 'CODE123',
        gallerySlug: 'the-slug',
        galleryId: 'gal_abc',
        fileName: 'a.jpg',
      })
    ).toBe('galleries/launch-night/photos/a.jpg');
  });

  it('falls back through code, then slug, then id', () => {
    const base = { fileType: 'gallery-photo', fileName: 'a.jpg' } as const;

    expect(generateFilePath({ ...base, galleryCode: 'CODE123' })).toBe(
      'galleries/code123/photos/a.jpg'
    );
    expect(generateFilePath({ ...base, gallerySlug: 'the-slug' })).toBe(
      'galleries/the-slug/photos/a.jpg'
    );
    expect(generateFilePath({ ...base, galleryId: 'gal_abc' })).toBe(
      'galleries/gal-abc/photos/a.jpg'
    );
  });

  it('uses an "unknown" folder when no gallery identity is supplied', () => {
    expect(generateFilePath({ fileType: 'gallery-photo', fileName: 'a.jpg' })).toBe(
      'galleries/unknown/photos/a.jpg'
    );
  });

  it('sends every non-gallery type to the flat uploads prefix', () => {
    // Note: video/audio/poster all collapse here. The per-type folder scheme
    // the old root script assumed is gone.
    for (const fileType of ['video', 'audio', 'poster', 'poster-thumb', 'misc'] as const) {
      expect(generateFilePath({ fileType, fileName: 'thing.bin' })).toBe('uploads/thing.bin');
    }
  });

  it('generates a timestamp filename when none is given', () => {
    const path = generateFilePath({ fileType: 'misc' });
    expect(path).toMatch(/^uploads\/\d+$/);
  });

  it('sanitises a hostile filename before it reaches the key', () => {
    const path = generateFilePath({
      fileType: 'gallery-photo',
      galleryName: 'Gallery',
      fileName: '../../secret.jpg',
    });
    // The leading `.._.._` is entirely stripped by the trailing-separator
    // rule, so the traversal collapses to a bare filename.
    expect(path).toBe('galleries/gallery/photos/secret.jpg');
    expect(path.startsWith('galleries/gallery/photos/')).toBe(true);
  });
});

describe('getMimeType', () => {
  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['photo.JPEG', 'image/jpeg'],
    ['art.png', 'image/png'],
    ['art.webp', 'image/webp'],
    ['clip.mp4', 'video/mp4'],
    ['clip.mov', 'video/quicktime'],
    ['track.mp3', 'audio/mpeg'],
    ['track.m4a', 'audio/mp4'],
    ['track.wav', 'audio/wav'],
    ['track.flac', 'audio/flac'],
    ['doc.pdf', 'application/pdf'],
  ])('maps %s to %s', (fileName, expected) => {
    expect(getMimeType(fileName)).toBe(expected);
  });

  it('returns undefined when there is no filename', () => {
    expect(getMimeType(undefined)).toBeUndefined();
    expect(getMimeType('')).toBeUndefined();
  });

  it('falls back to octet-stream for an unknown extension', () => {
    expect(getMimeType('archive.xyz')).toBe('application/octet-stream');
  });

  it('falls back to octet-stream when the name has no extension at all', () => {
    expect(getMimeType('README')).toBe('application/octet-stream');
  });

  it('resolves webm as video, which is the ambiguous case', () => {
    // .webm is a valid container for audio-only too; the map commits to video.
    expect(getMimeType('file.webm')).toBe('video/webm');
  });

  it('KNOWN GAP: .aac validates as audio but has no MIME mapping', () => {
    // validateFileType accepts aac as audio, yet getMimeType has no entry, so
    // the object is stored as application/octet-stream and browsers refuse to
    // stream it. Either add `aac: 'audio/aac'` to the map or drop aac from
    // audioExts. Locked in as a test so the mismatch cannot be forgotten.
    expect(validateFileType('track.aac', 'audio')).toBe(true);
    expect(getMimeType('track.aac')).toBe('application/octet-stream');
  });
});

describe('validateFileType', () => {
  it('accepts audio extensions for audio-ish categories', () => {
    for (const type of ['track', 'audio', 'song']) {
      expect(validateFileType('a.mp3', type)).toBe(true);
      expect(validateFileType('a.flac', type)).toBe(true);
    }
  });

  it('rejects an image submitted as a track', () => {
    expect(validateFileType('cover.jpg', 'track')).toBe(false);
  });

  it('accepts video extensions for video-ish categories', () => {
    for (const type of ['video', 'music-video', 'movie', 'short-film', 'feature']) {
      expect(validateFileType('a.mp4', type)).toBe(true);
    }
    expect(validateFileType('a.mp3', 'video')).toBe(false);
  });

  it('accepts image extensions for cover and poster categories', () => {
    for (const type of ['album-cover', 'cover', 'poster', 'image', 'photo', 'thumbnail']) {
      expect(validateFileType('a.png', type)).toBe(true);
    }
    expect(validateFileType('a.mp4', 'poster')).toBe(false);
  });

  it('lets gallery uploads be either an image or a video', () => {
    expect(validateFileType('a.jpg', 'gallery-photo')).toBe(true);
    expect(validateFileType('a.mp4', 'gallery-video')).toBe(true);
    expect(validateFileType('a.mp3', 'gallery')).toBe(false);
  });

  it('is case insensitive on the extension', () => {
    expect(validateFileType('SONG.MP3', 'track')).toBe(true);
  });

  it('returns false without a filename', () => {
    expect(validateFileType(undefined, 'track')).toBe(false);
  });

  it('falls back to allowing any known media type for an unrecognised category', () => {
    expect(validateFileType('a.mp3', 'something-else')).toBe(true);
    expect(validateFileType('a.exe', 'something-else')).toBe(false);
  });
});

describe('parseFilePath', () => {
  it('parses an album track path', () => {
    expect(parseFilePath('music/albums/album_123/tracks/song.mp3')).toEqual({
      type: 'album-track',
      albumId: 'album_123',
      filename: 'song.mp3',
    });
  });

  it('parses a video path', () => {
    expect(parseFilePath('videos/music-video/clip.mp4')).toEqual({
      type: 'video',
      videoType: 'music-video',
      filename: 'clip.mp4',
    });
  });

  it('parses a gallery path', () => {
    expect(parseFilePath('galleries/summer-block-party/photos/a.jpg')).toEqual({
      type: 'gallery-photos',
      galleryId: 'summer-block-party',
      filename: 'a.jpg',
    });
  });

  it('tolerates a leading slash', () => {
    const parsed = parseFilePath('/videos/clip/a.mp4');
    expect(parsed).toMatchObject({ type: 'video', videoType: 'clip' });
  });

  it('returns null for an empty path', () => {
    expect(parseFilePath('')).toBeNull();
  });

  it('reports an unknown shape rather than throwing', () => {
    expect(parseFilePath('uploads/loose-file.bin')).toEqual({
      type: 'unknown',
      path: 'uploads/loose-file.bin',
    });
  });

  it('does not round-trip a generated gallery key back to its gallery id', () => {
    // generateFilePath writes the *slugged name*; parseFilePath calls that
    // segment `galleryId`. The id is not recoverable from the key — callers
    // must not rely on this field to look a gallery up.
    const key = generateFilePath({
      fileType: 'gallery-photo',
      galleryId: 'gal_abc123',
      galleryName: 'Launch Night',
      fileName: 'a.jpg',
    });
    const parsed = parseFilePath(key) as { galleryId: string };

    expect(parsed.galleryId).toBe('launch-night');
    expect(parsed.galleryId).not.toBe('gal_abc123');
  });
});
