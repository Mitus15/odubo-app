/**
 * @jest-environment node
 *
 * Who may see a hidden video through the API.
 *
 * Written after GET /api/videos and GET /api/videos/[id] were found handing
 * any anonymous caller every row, hidden ones included, with their playback
 * URLs. The Loop Soul film and its clips are uploaded hidden before release
 * (scripts/loop/film/publish.ts), so the film was one request away.
 *
 * The routes' own SQL runs here against a real SQLite (D1 is SQLite), so the
 * rule is checked by what comes back, not by what the query string says.
 */
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { getJwtSecret } from '@/lib/auth';
import { ADMIN_COOKIE, signAdminSession } from '@/lib/loop/admin-auth';
import { GET as listVideos } from '../route';
import { GET as getVideo } from '../[id]/route';

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
};
// node:sqlite has no typings in this repo's @types/node; these two methods are all we use.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };
const mockDb = new DatabaseSync(':memory:');

jest.mock('@/lib/db', () => ({
  queryDatabase: async (sql: string, params: unknown[] = []) => mockDb.prepare(sql).all(...params),
}));
jest.mock('@/lib/audit', () => ({ writeAuditLog: async () => {} }));

// In a route handler next/headers reads the request being handled: here, the
// one the test just built.
let mockCookieHeader = '';
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const pair = mockCookieHeader.split('; ').find((c) => c.startsWith(`${name}=`));
      return pair ? { name, value: pair.slice(name.length + 1) } : undefined;
    },
  }),
}));

// [id, uid, type, is_public, status, publication_status], as each kind of row is written.
const ROWS: Array<[number, string, string, number | null, string | null, string | null]> = [
  [1, 'released', 'music_video', 1, 'published', 'live'],
  [2, 'legacy', 'music_video', null, null, null], // before the flags existed: public
  [445, 'film', 'feature', 0, 'published', 'archived'], // the film, as publish.ts uploads it
  [446, 'film-clip', 'clip', 0, 'published', 'archived'], // one of its clips
  [4, 'shelved', 'music_video', 1, 'archived', 'live'],
  [5, 'off-air', 'music_video', 1, 'published', 'archived'],
  [6, 'fresh', 'music_video', 0, 'published', 'live'], // a new upload, not made public yet
];
const PUBLIC = [1, 2];
const HIDDEN = [4, 5, 6, 445, 446];
const ALL = [...PUBLIC, ...HIDDEN].sort((a, b) => a - b);

const playbackUrl = (uid: string) => `https://iframe.videodelivery.net/${uid}`;

type Caller = { cookie?: string; bearer?: string };

const sign = (claims: Record<string, unknown>, secret = getJwtSecret()) =>
  new SignJWT({ userId: 'u1', email: 'someone@example.com', ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));

const callers: Record<string, () => Promise<Caller>> = {
  anonymous: async () => ({}),
  fan: async () => ({ cookie: `token=${await sign({ is_admin: false })}` }),
  forger: async () => ({ cookie: `token=${await sign({ is_admin: true }, 'not-the-secret')}` }),
  // Signed with the open-mode key that ships in the source, not the password.
  'Loop forger': async () => {
    const password = process.env.LOOP_ADMIN_PASSWORD;
    delete process.env.LOOP_ADMIN_PASSWORD;
    try {
      return { cookie: `${ADMIN_COOKIE}=${await signAdminSession()}` };
    } finally {
      process.env.LOOP_ADMIN_PASSWORD = password;
    }
  },
  'admin cookie': async () => ({ cookie: `token=${await sign({ is_admin: true })}` }),
  'admin bearer': async () => ({ bearer: await sign({ is_admin: true }) }),
  'Loop team': async () => ({ cookie: `${ADMIN_COOKIE}=${await signAdminSession()}` }),
};
const OUTSIDERS = ['anonymous', 'fan', 'forger', 'Loop forger'];
const ADMINS = ['admin cookie', 'admin bearer', 'Loop team'];

function request(path: string, as: Caller): NextRequest {
  mockCookieHeader = as.cookie ?? '';
  const headers = new Headers();
  if (as.cookie) headers.set('cookie', as.cookie);
  if (as.bearer) headers.set('authorization', `Bearer ${as.bearer}`);
  return new NextRequest(`http://localhost${path}`, { headers });
}

async function listIds(path: string, who: string): Promise<number[]> {
  const res = await listVideos(request(path, await callers[who]()));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { videos: Array<{ id: number }> };
  return body.videos.map((v) => v.id).sort((a, b) => a - b);
}

async function fetchOne(id: number, who: string) {
  const res = await getVideo(request(`/api/videos/${id}`, await callers[who]()), {
    params: Promise.resolve({ id: String(id) }),
  });
  return { status: res.status, text: await res.text() };
}

const savedEnv = { ...process.env };

beforeAll(() => {
  // Production signs both sessions with real secrets; so does this test.
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.LOOP_ADMIN_PASSWORD = 'test-loop-password';

  mockDb.exec(`CREATE TABLE videos (
    id INTEGER PRIMARY KEY, uid TEXT, title TEXT, artist_name TEXT, description TEXT,
    short_description TEXT, long_description TEXT, tags TEXT, url TEXT, mp4_url TEXT,
    poster_url TEXT, thumbnail TEXT, duration TEXT, duration_seconds REAL, category TEXT,
    is_public INTEGER, type TEXT, mood TEXT, credits TEXT, related_projects TEXT, status TEXT,
    stream_video_id TEXT, publication_status TEXT, ai_description TEXT,
    thumbnail_timestamp_pct REAL, shopify_product_id TEXT, shopify_product_handle TEXT,
    created_at TEXT, updated_at TEXT
  )`);
  const insert = mockDb.prepare(
    `INSERT INTO videos (id, uid, stream_video_id, title, url, type, is_public, status, publication_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const [id, uid, type, isPublic, status, publication] of ROWS) {
    insert.run(id, uid, uid, `Video ${id}`, playbackUrl(uid), type, isPublic, status, publication, '2026-09-29');
  }
});

afterAll(() => {
  process.env = savedEnv;
});

describe('GET /api/videos', () => {
  it.each(OUTSIDERS)('lists only public videos for the %s', async (who) => {
    expect(await listIds('/api/videos', who)).toEqual(PUBLIC);
  });

  it.each(ADMINS)('lists every video, hidden ones too, for the %s', async (who) => {
    expect(await listIds('/api/videos', who)).toEqual(ALL);
  });

  it('cannot be made to give a hidden video up by uid or by status filter', async () => {
    expect(await listIds('/api/videos?uid=film', 'anonymous')).toEqual([]);
    for (const status of ['archived', 'live']) {
      const ids = await listIds(`/api/videos?publication_status=${status}`, 'anonymous');
      expect(ids.filter((id) => HIDDEN.includes(id))).toEqual([]);
    }
  });

  it('still finds a fresh hidden upload by uid for the admin who made it', async () => {
    // The Video Library looks its new row up this way right after creating it.
    expect(await listIds('/api/videos?uid=fresh', 'admin bearer')).toEqual([6]);
  });

  it("still gives the admin library its hidden parents, clips left out", async () => {
    expect(await listIds('/api/videos?limit=200&exclude_type=clip', 'admin cookie')).toEqual(
      ALL.filter((id) => id !== 446),
    );
  });
});

describe('GET /api/videos/[id]', () => {
  it.each(HIDDEN)('answers 404 for hidden video %i to anyone but an admin', async (id) => {
    for (const who of OUTSIDERS) {
      const { status, text } = await fetchOne(id, who);
      expect(status).toBe(404);
      expect(text).not.toContain('videodelivery.net');
    }
  });

  it.each(PUBLIC)('serves public video %i to anyone', async (id) => {
    const { status, text } = await fetchOne(id, 'anonymous');
    expect(status).toBe(200);
    expect(JSON.parse(text).video.id).toBe(id);
  });

  it.each(ADMINS)('serves the hidden film to the %s, playback URL and all', async (who) => {
    const { status, text } = await fetchOne(445, who);
    expect(status).toBe(200);
    expect(JSON.parse(text).video.url).toBe(playbackUrl('film'));
  });
});
