/**
 * @jest-environment node
 *
 * The unreleased record, at every door.
 *
 * audioAccess.ts decides who may hear a track. On 2026-10-02 three doors did
 * not ask it: /api/tracks/[id] and /api/albums/[id] handed anyone an
 * unreleased track's audio_url, hls_url and stems, and the media proxy
 * presigned a track's HLS files, and the key of a track still stored on the
 * dead host, for anyone, because the gate knew only a key equal to audio_url.
 *
 * The routes' own SQL runs against a real SQLite (D1 is SQLite), and the
 * admin's session is a real signed token. Only the Loop facts around them are
 * stubbed: which singles are out, whether the caller is owed the record.
 */
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { getJwtSecret } from '@/lib/auth';
import { earlySetFor, type AlbumAccess } from '@/lib/loop/album';
import { mayHearMediaKey } from '@/lib/loop/audioAccess';
import { GET as getTrack } from '@/app/api/tracks/[id]/route';
import { GET as getAlbum } from '@/app/api/albums/[id]/route';
import { GET as listTracks } from '@/app/api/tracks/route';
import { GET as getMedia } from '@/app/api/media/audio/[...key]/route';

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): unknown[] };
};
// node:sqlite has no typings in this repo's @types/node; these methods are all we use.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };
const mockDb = new DatabaseSync(':memory:');

jest.mock('@/lib/db', () => ({
  ...jest.requireActual('@/lib/db'),
  queryDatabase: async (sql: string, params: unknown[] = []) => mockDb.prepare(sql).all(...params),
}));

// The front door plays 1984 (featured_track unset), and these singles are out.
let mockReleasedSingles: string[] = [];
jest.mock('@/lib/loop/loopSetting', () => ({
  ...jest.requireActual('@/lib/loop/loopSetting'),
  getSetting: async () => null,
}));
jest.mock('@/lib/loop/singlesStore', () => ({
  ...jest.requireActual('@/lib/loop/singlesStore'),
  releasedSingleTitles: async () => new Set(mockReleasedSingles),
}));

// Who the caller is to the Loop: a voter cookie, and what it is owed.
const NOBODY: AlbumAccess = { released: false, early: { enabled: false, extra: 0 }, entitled: false, holder: false, email: null };
let mockAccess: AlbumAccess = NOBODY;
jest.mock('@/lib/loop/hub', () => ({ getCurrentEvent: async () => ({ id: 'loop-soul-night' }) }));
jest.mock('@/lib/loop/identity/voter', () => ({ currentVoterId: async () => 'voter-1' }));
jest.mock('@/lib/loop/album', () => ({
  ...jest.requireActual('@/lib/loop/album'),
  albumAccessFor: async () => mockAccess,
}));

jest.mock('@/lib/storage/StorageService', () => ({
  createStorageService: () => ({
    getPresignedUrl: async ({ key }: { key: string }) => `https://r2.test/${key}?X-Amz-Signature=1`,
  }),
}));

const PROXY = '/api/media/audio/';
const TRACKS = [
  // id, title, number, seconds, audio_url
  ['t-welcome', 'Welcome', 1, 60, `${PROXY}warehouse/ls/welcome.m4a`],
  ['t-1984', '1984', 2, 200, `${PROXY}warehouse/ls/1984.web.m4a`],
  ['t-news', 'News Peak', 3, 240, `${PROXY}warehouse/ls/news-peak.web.m4a`],
  ['t-ghost', 'Ghost World', 4, 230, 'https://media.odubo.studio/music/ls/ghost-world.web.m4a'],
  ['t-other', 'The Other Side', 5, 250, `${PROXY}warehouse/ls/other-side.web.m4a`],
] as const;

beforeEach(() => {
  mockReleasedSingles = [];
  mockAccess = NOBODY;
  mockDb.exec(`
    DROP TABLE IF EXISTS albums;
    DROP TABLE IF EXISTS tracks;
    DROP TABLE IF EXISTS videos;
    CREATE TABLE albums (id TEXT PRIMARY KEY, title TEXT, status TEXT);
    CREATE TABLE tracks (
      id TEXT PRIMARY KEY, album_id TEXT, title TEXT NOT NULL, track_number INTEGER, duration INTEGER,
      audio_url TEXT, preview_url TEXT,
      vocal_stem_url TEXT, drum_stem_url TEXT, bass_stem_url TEXT, other_stem_url TEXT
    );
    CREATE TABLE videos (id INTEGER PRIMARY KEY, track_id TEXT);
    INSERT INTO albums VALUES ('loop-soul', 'Loop Soul', 'draft'), ('old-record', 'Old Record', 'published');
    INSERT INTO tracks (id, album_id, title, track_number, duration, audio_url)
      VALUES ('t-old', 'old-record', 'Old Song', 1, 180, '${PROXY}music/old/old-song.web.m4a');
  `);
  for (const [id, title, n, seconds, audio] of TRACKS) {
    mockDb
      .prepare('INSERT INTO tracks (id, album_id, title, track_number, duration, audio_url) VALUES (?, ?, ?, ?, ?, ?)')
      .all(id, 'loop-soul', title, n, seconds, audio);
  }
  mockDb.exec(`
    UPDATE tracks SET
      preview_url = '${PROXY}warehouse/ls/news-peak-preview.m4a',
      vocal_stem_url = 'https://media.odubo.studio/music/ls/stems/news-peak-vocals.m4a',
      drum_stem_url = 'https://media.odubo.studio/music/ls/stems/news-peak-drums.m4a',
      bass_stem_url = 'https://media.odubo.studio/music/ls/stems/news-peak-bass.m4a',
      other_stem_url = 'https://media.odubo.studio/music/ls/stems/news-peak-other.m4a'
    WHERE id = 't-news';
  `);
});

const sign = (claims: Record<string, unknown>) =>
  new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(getJwtSecret()));

let adminToken = '';
let fanToken = '';
const adminEmails = process.env.ADMIN_EMAILS;
beforeAll(async () => {
  process.env.ADMIN_EMAILS = '';
  adminToken = await sign({ userId: 'admin-1', email: 'owner@example.com', is_admin: true });
  fanToken = await sign({ userId: 'fan-1', email: 'fan@example.com', is_admin: false });
});
afterAll(() => {
  if (adminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = adminEmails;
});

type Caller = { cookie?: string; bearer?: string };
const asAdmin = (): Caller => ({ cookie: adminToken });
const asFan = (): Caller => ({ cookie: fanToken });
const request = (path: string, who: Caller = {}) => {
  const headers: Record<string, string> = {};
  if (who.cookie) headers.cookie = `token=${who.cookie}`;
  if (who.bearer) headers.authorization = `Bearer ${who.bearer}`;
  return new NextRequest(`http://localhost${path}`, { headers });
};

type Track = Record<string, unknown> & { id: string };
const track = async (id: string, who?: Caller) => {
  const res = await getTrack(request(`/api/tracks/${id}`, who), { params: Promise.resolve({ id }) });
  return { res, track: ((await res.json()) as { track: Track }).track };
};
const album = async (id: string, who?: Caller) => {
  const res = await getAlbum(request(`/api/albums/${id}`, who), { params: Promise.resolve({ id }) });
  return { res, tracks: ((await res.json()) as { album: { tracks: Track[] } }).album.tracks };
};
const media = (key: string, who?: Caller) =>
  getMedia(request(`${PROXY}${key}`, who), { params: Promise.resolve({ key: key.split('/') }) });
const playable = (tracks: Track[]) => tracks.filter((t) => t.audio_url).map((t) => t.id);

const WITHHELD = {
  audio_url: null,
  hls_url: null,
  preview_url: null,
  vocal_stem_url: null,
  drum_stem_url: null,
  bass_stem_url: null,
  other_stem_url: null,
};

describe('GET /api/tracks/[id]', () => {
  it("gives a stranger an unreleased track's details, never the way to play it", async () => {
    const { res, track: t } = await track('t-news');
    expect(res.status).toBe(200);
    expect(t).toMatchObject({ id: 't-news', title: 'News Peak', duration: 240, ...WITHHELD });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('gives a signed-in fan who is owed nothing the same', async () => {
    expect((await track('t-news', asFan())).track).toMatchObject(WITHHELD);
  });

  it('gives the admin all of it, on the session cookie', async () => {
    const { res, track: t } = await track('t-news', asAdmin());
    expect(t).toMatchObject({
      audio_url: `${PROXY}warehouse/ls/news-peak.web.m4a`,
      hls_url: `${PROXY}warehouse/ls/news-peak.hls/master.m3u8`,
      preview_url: `${PROXY}warehouse/ls/news-peak-preview.m4a`,
      vocal_stem_url: 'https://media.odubo.studio/music/ls/stems/news-peak-vocals.m4a',
    });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('gives the admin all of it on a bearer token alone', async () => {
    expect((await track('t-news', { bearer: adminToken })).track.audio_url).toBe(`${PROXY}warehouse/ls/news-peak.web.m4a`);
  });

  it('keeps the single public, because the flyer promises it', async () => {
    expect((await track('t-1984')).track).toMatchObject({
      audio_url: `${PROXY}warehouse/ls/1984.web.m4a`,
      hls_url: `${PROXY}warehouse/ls/1984.hls/master.m3u8`,
    });
  });

  it('opens a single to everyone on its release date', async () => {
    mockReleasedSingles = ['news peak'];
    expect((await track('t-news')).track.audio_url).toBe(`${PROXY}warehouse/ls/news-peak.web.m4a`);
  });

  it('leaves a published track public, and cacheable', async () => {
    const { res, track: t } = await track('t-old');
    expect(t).toMatchObject({ audio_url: `${PROXY}music/old/old-song.web.m4a`, hls_url: `${PROXY}music/old/old-song.hls/master.m3u8` });
    expect(t).not.toHaveProperty('album_status');
    expect(res.headers.get('cache-control')).toBe('public, max-age=300, stale-while-revalidate=600');
  });

  it('still says a missing track is missing', async () => {
    expect((await track('t-nope')).res.status).toBe(404);
  });
});

describe('GET /api/albums/[id]', () => {
  it('gives a stranger the whole draft, with only the public single playable', async () => {
    const { res, tracks } = await album('loop-soul');
    expect(res.status).toBe(200);
    expect(tracks.map((t) => t.title)).toEqual(['Welcome', '1984', 'News Peak', 'Ghost World', 'The Other Side']);
    expect(playable(tracks)).toEqual(['t-1984']);
    expect(tracks.find((t) => t.id === 't-news')).toMatchObject({ preview_url: null, vocal_stem_url: null, other_stem_url: null });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('gives the admin previewing the draft every track', async () => {
    const { tracks } = await album('loop-soul', asAdmin());
    expect(playable(tracks)).toEqual(TRACKS.map(([id]) => id));
    expect(tracks.find((t) => t.id === 't-news')?.vocal_stem_url).toBe('https://media.odubo.studio/music/ls/stems/news-peak-vocals.m4a');
  });

  it("gives a pass-holder their own draw before release, and nothing more", async () => {
    const early = { enabled: true, extra: 1 };
    mockAccess = { ...NOBODY, entitled: true, email: 'fan@example.com', early };
    const draw = earlySetFor(
      'fan@example.com',
      TRACKS.map(([, title, track_number, duration]) => ({ title, track_number, duration })),
      null,
      early,
    );
    expect(draw).toHaveLength(2);

    const { tracks } = await album('loop-soul', asFan());
    expect(playable(tracks)).toEqual(TRACKS.filter(([, , n]) => draw.includes(n)).map(([id]) => id));
  });

  it('gives a pass-holder every track once the record is released', async () => {
    mockAccess = { ...NOBODY, holder: true, released: true };
    expect(playable((await album('loop-soul', asFan())).tracks)).toEqual(TRACKS.map(([id]) => id));
  });

  it('leaves a published album public', async () => {
    const { res, tracks } = await album('old-record');
    expect(playable(tracks)).toEqual(['t-old']);
    expect(res.headers.get('cache-control')).not.toBe('private, no-store');
  });
});

describe('GET /api/tracks', () => {
  it("withholds every way to play a draft's tracks, stems included, from everyone", async () => {
    const res = await listTracks(request('/api/tracks?album_id=loop-soul', asAdmin()));
    const { tracks } = (await res.json()) as { tracks: Track[] };
    expect(tracks).toHaveLength(TRACKS.length);
    for (const t of tracks) expect(t).toMatchObject({ audio_url: null, preview_url: null, vocal_stem_url: null });
    expect(tracks[0]).not.toHaveProperty('album_status');
  });
});

describe('GET /api/media/audio/[...key]', () => {
  const NEWS_PEAK_HLS = ['news-peak.hls/master.m3u8', 'news-peak.hls/v0.m3u8', 'news-peak.hls/seg_0_007.aac'];

  it.each(NEWS_PEAK_HLS)("refuses a stranger the unreleased track's HLS: %s", async (file) => {
    expect((await media(`warehouse/ls/${file}`)).status).toBe(404);
  });

  it("serves the admin the unreleased track's HLS", async () => {
    const res = await media('warehouse/ls/news-peak.hls/master.m3u8', asAdmin());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://r2.test/warehouse/ls/news-peak.hls/master.m3u8?X-Amz-Signature=1');
  });

  it('refuses a stranger the HLS the script writes beside a master', async () => {
    expect((await media('warehouse/ls/welcome.hls/master.m3u8')).status).toBe(404);
  });

  it('refuses a stranger a track still stored on the dead host, and its HLS', async () => {
    expect((await media('music/ls/ghost-world.web.m4a')).status).toBe(404);
    expect((await media('music/ls/ghost-world.hls/master.m3u8')).status).toBe(404);
    expect((await media('music/ls/ghost-world.web.m4a', asAdmin())).status).toBe(302);
  });

  it('still refuses a stranger the file audio_url names', async () => {
    expect((await media('warehouse/ls/news-peak.web.m4a')).status).toBe(404);
  });

  it('keeps the public single and the published catalogue public, HLS included', async () => {
    expect((await media('warehouse/ls/1984.hls/master.m3u8')).status).toBe(302);
    expect((await media('music/old/old-song.hls/seg_0_000.aac')).status).toBe(302);
  });

  it('leaves a key that is no track exactly as it was', async () => {
    expect((await media('warehouse/masters/session-take-3.wav')).status).toBe(302);
    expect(await mayHearMediaKey(null, 'warehouse/masters/session-take-3.wav')).toBeNull();
  });

  it('does not stretch a song to a name that starts the same', async () => {
    // The search finds News Peak's row for this; the exact check must not claim it.
    expect(await mayHearMediaKey(null, 'warehouse/ls/news.hls/master.m3u8')).toBeNull();
  });

  it('opens a recording a published release shares, as that release does', async () => {
    expect((await media('warehouse/ls/other-side.hls/master.m3u8')).status).toBe(404);
    mockDb.exec(`
      INSERT INTO tracks (id, album_id, title, track_number, duration, audio_url)
      VALUES ('t-other-single', 'old-record', 'The Other Side', 2, 250,
              'https://odubo.studio/api/media/audio/warehouse/ls/other-side.web.m4a');
    `);
    expect((await media('warehouse/ls/other-side.hls/master.m3u8')).status).toBe(302);
  });
});

// next.config.ts gave every /api/media response a public s-maxage, which
// replaced the route's own private header: a CDN could keep an admin's
// presigned redirect to an unreleased track and hand it to the next stranger.
describe('no shared cache in front of the media proxy', () => {
  // The two source forms next.config.ts uses: `:path*` and `(a|b)` groups.
  const matches = (source: string, path: string) =>
    new RegExp(`^${source.replace(/\./g, '\\.').replace(/:path\*/g, '.*')}$`).test(path);

  it('reads a rule the way Next does', () => {
    expect(matches('/api/media/:path*', '/api/media/audio/warehouse/a.m4a')).toBe(true);
    expect(matches('/:path*.(png|jpg)', '/api/media/audio/warehouse/cover.jpg')).toBe(true);
    expect(matches('/:path*.(png|jpg)', '/api/media/audio/warehouse/a.m4a')).toBe(false);
  });

  it('leaves Cache-Control to the routes, whose answer depends on who asks', async () => {
    const { default: config } = await import('../../next.config');
    const rules = await config.headers!();
    for (const path of [
      `${PROXY}warehouse/ls/news-peak.web.m4a`,
      `${PROXY}warehouse/ls/news-peak.hls/master.m3u8`,
      `${PROXY}warehouse/ls/news-peak.hls/seg_0_007.aac`,
      '/api/media/all',
    ]) {
      const set = rules.filter((r) => matches(r.source, path)).flatMap((r) => r.headers.map((h) => h.key.toLowerCase()));
      expect(set).not.toContain('cache-control');
    }
  });
});
