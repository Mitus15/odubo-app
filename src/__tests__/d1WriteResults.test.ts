/**
 * @jest-environment node
 *
 * Routes that read what their own write did: how many rows it changed, or the
 * id of the row it made. executeQuery (lib/db.ts) returns D1's whole response,
 * where both live at result[0].meta, and these routes read them off the top:
 * a like answered 500 after it was saved, the syncs counted 0, and a new
 * track, album or folder came back without its id.
 *
 * Each route's own SQL runs here against a real SQLite (D1 is SQLite), and
 * executeQuery answers in D1's shape with what SQLite reports.
 */
import { NextRequest } from 'next/server';
import { POST as like, DELETE as unlike } from '@/app/api/likes/route';
import { POST as createTrack } from '@/app/api/tracks/route';
import { POST as createAlbum } from '@/app/api/admin/brand-assets/albums/route';
import { POST as createFolder } from '@/app/api/admin/social/folders/route';
import { GET as syncDeployments } from '@/app/api/arsenal/sync/route';
import { POST as syncFromStream } from '@/app/api/arsenal/sync-from-stream/route';

type SqliteRun = { changes: number | bigint; lastInsertRowid: number | bigint };
type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): SqliteRun;
  };
};
// node:sqlite has no typings in this repo's @types/node; these methods are all we use.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };
const mockDb = new DatabaseSync(':memory:');

// Params reach D1 as JSON, so an undefined one arrives as null.
const mockBind = (params: unknown[]) => params.map((p) => (p === undefined ? null : p));

jest.mock('@/lib/db', () => ({
  ...jest.requireActual('@/lib/db'),
  queryDatabase: async (sql: string, params: unknown[] = []) => mockDb.prepare(sql).all(...mockBind(params)),
  executeQuery: async (sql: string, params: unknown[] = []) => {
    const run = mockDb.prepare(sql).run(...mockBind(params));
    return {
      result: [{ results: [], success: true, meta: { changes: Number(run.changes), last_row_id: Number(run.lastInsertRowid) } }],
      errors: [],
      messages: [],
      success: true,
    };
  },
}));

let mockUser: { userId: string; is_admin?: boolean } | null = null;
jest.mock('@/lib/auth', () => ({
  getUserFromRequest: async () => mockUser,
  isAdminUser: (user: { is_admin?: boolean } | null) => Boolean(user?.is_admin),
}));
jest.mock('@/lib/rateLimit', () => ({ rateLimit: async () => ({ allowed: true }) }));

// PostForMe answers getPost; anything else it is asked fails fast, never the network.
let mockPost: unknown = null;
jest.mock('@/lib/postforme', () => ({
  ...jest.requireActual('@/lib/postforme'),
  getPost: async () => mockPost,
  getAccounts: async () => ({ success: false }),
  getAccountFeed: async () => ({ success: false }),
  createPost: async () => ({ success: false }),
}));

let mockStreamVideos: unknown[] = [];
jest.mock('@/lib/cloudflareStream', () => ({
  __esModule: true,
  default: class {
    listAllVideos = async () => mockStreamVideos;
  },
}));

const send = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const idOf = (sql: string) => (mockDb.prepare(sql).get() as { id: number | string }).id;

describe('/api/likes', () => {
  beforeEach(() => {
    mockUser = { userId: 'fan-1' };
    mockDb.exec(`
      DROP TABLE IF EXISTS user_track_likes;
      CREATE TABLE user_track_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, track_id)
      );
      INSERT INTO user_track_likes (user_id, track_id) VALUES ('fan-2', 'makunahea');
    `);
  });

  it('a like is saved and answered 200 with its id', async () => {
    const res = await like(send('POST', '/api/likes', { item_id: 'makunahea', type: 'track' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      like_id: idOf("SELECT id FROM user_track_likes WHERE user_id = 'fan-1'"),
    });
  });

  it("an unlike removes that fan's like, and no one else's, and answers 200", async () => {
    await like(send('POST', '/api/likes', { item_id: 'makunahea', type: 'track' }));
    const res = await unlike(send('DELETE', '/api/likes', { item_id: 'makunahea', type: 'track' }));
    expect(res.status).toBe(200);
    expect(mockDb.prepare('SELECT user_id FROM user_track_likes').all()).toEqual([{ user_id: 'fan-2' }]);
  });

  it('unliking what was never liked is a 404', async () => {
    const res = await unlike(send('DELETE', '/api/likes', { item_id: '1984', type: 'track' }));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/tracks', () => {
  beforeEach(() => {
    mockUser = { userId: 'admin-1', is_admin: true };
    mockDb.exec(`
      DROP TABLE IF EXISTS tracks;
      CREATE TABLE tracks (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, album_id TEXT, track_number INTEGER,
        audio_url TEXT, duration INTEGER, status TEXT, created_at TEXT
      );
    `);
  });

  it('answers with the id the track was saved under', async () => {
    const res = await createTrack(send('POST', '/api/tracks', { title: 'Makunahea', album_id: 'loop-soul', track_number: 1 }));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(id).toBe(idOf("SELECT id FROM tracks WHERE title = 'Makunahea'"));
  });
});

// The upload screens create the album or folder, then file the upload under
// the id that comes back.
describe('a new album or folder to upload into', () => {
  beforeEach(() => {
    mockUser = { userId: 'admin-1', is_admin: true };
    mockDb.exec(`
      DROP TABLE IF EXISTS asset_albums;
      DROP TABLE IF EXISTS social_folders;
      CREATE TABLE asset_albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, name TEXT NOT NULL,
        slug TEXT NOT NULL, description TEXT, status TEXT, sort_order INTEGER
      );
      CREATE TABLE social_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
        is_default BOOLEAN DEFAULT FALSE, sort_order INTEGER
      );
      INSERT INTO asset_albums (category_id, name, slug, sort_order) VALUES (1, 'Press', 'press', 1), (1, 'Merch', 'merch', 2);
      INSERT INTO social_folders (name, slug, sort_order) VALUES ('Reels', 'reels', 1), ('Posters', 'posters', 2);
    `);
  });

  it('a brand-assets album comes back with the id it was saved under', async () => {
    const res = await createAlbum(send('POST', '/api/admin/brand-assets/albums', { category_id: 1, name: 'Loop Soul' }));
    const { album } = (await res.json()) as { album: { id: number } };
    expect(album.id).toBe(idOf("SELECT id FROM asset_albums WHERE slug = 'loop-soul'"));
  });

  it('a social folder comes back with the id it was saved under', async () => {
    const res = await createFolder(send('POST', '/api/admin/social/folders', { name: 'Singles' }));
    const { folder } = (await res.json()) as { folder: { id: number } };
    expect(folder.id).toBe(idOf("SELECT id FROM social_folders WHERE slug = 'singles'"));
  });
});

describe('GET /api/arsenal/sync, going live', () => {
  const cronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-test';
    mockPost = {
      success: true,
      data: { status: 'processed', platforms: [{ platform: 'youtube', url: 'https://youtu.be/sky', external_id: 'sky' }] },
    };
    mockDb.exec(`
      DROP TABLE IF EXISTS videos;
      DROP TABLE IF EXISTS video_deployments;
      CREATE TABLE videos (
        id INTEGER PRIMARY KEY, title TEXT, parent_video_id INTEGER, is_public INTEGER DEFAULT 0,
        publication_status TEXT, poster_url TEXT, youtube_url TEXT, youtube_shorts_url TEXT,
        tiktok_url TEXT, instagram_reels_url TEXT, postforme_post_id TEXT, postforme_status TEXT, updated_at TEXT
      );
      CREATE TABLE video_deployments (
        id INTEGER PRIMARY KEY, video_id INTEGER, platform TEXT, postforme_post_id TEXT, status TEXT,
        external_url TEXT, external_id TEXT, synced_at TEXT, error_message TEXT, deployed_at TEXT, metadata_json TEXT
      );
      INSERT INTO videos (id, title, parent_video_id, is_public, publication_status) VALUES
        (1, 'The Sky', NULL, 0, 'archived'),
        (2, 'The Sky, clip 1', 1, 0, 'archived'),
        (3, 'The Sky, clip 2', 1, 0, 'archived'),
        (4, 'The Sky, clip 3', 1, 1, 'live');
      INSERT INTO video_deployments (id, video_id, platform, postforme_post_id, status)
        VALUES (10, 1, 'youtube', 'pfm-sky', 'scheduled');
    `);
  });

  afterEach(() => {
    if (cronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = cronSecret;
  });

  it('counts the video and the clips it made public, not the clip already live', async () => {
    const res = await syncDeployments(send('GET', '/api/arsenal/sync', undefined, { authorization: 'Bearer cron-test' }));
    const body = (await res.json()) as { message: string };
    expect(body).toMatchObject({ updated: 1, madePublic: 3 });
    expect(body.message).toContain('3 made public');
    expect(mockDb.prepare("SELECT id FROM videos WHERE is_public = 1 AND publication_status = 'live' ORDER BY id").all())
      .toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  });
});

describe('POST /api/arsenal/sync-from-stream', () => {
  beforeEach(() => {
    mockDb.exec(`
      DROP TABLE IF EXISTS videos;
      CREATE TABLE videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT, stream_video_id TEXT, title TEXT, artist_name TEXT,
        description TEXT, category TEXT, type TEXT, mood TEXT, duration TEXT, poster_url TEXT, thumbnail TEXT,
        url TEXT, is_public INTEGER, status TEXT, publication_status TEXT, created_at TEXT, updated_at TEXT
      );
      CREATE UNIQUE INDEX idx_videos_uid_unique ON videos(uid) WHERE uid IS NOT NULL; -- migration 100
    `);
  });

  it('counts a video that arrives twice as synced once and ignored once', async () => {
    const video = (uid: string) => ({ uid, meta: { name: uid }, readyToStream: true, status: { state: 'ready' } });
    // INSERT OR IGNORE is there for the same video arriving twice in one run.
    mockStreamVideos = [video('sky'), video('news-peak'), video('sky')];
    const res = await syncFromStream(
      new Request('http://localhost/api/arsenal/sync-from-stream', { method: 'POST', headers: { authorization: 'Bearer admin' } }),
    );
    expect(await res.json()).toMatchObject({ synced: 2, ignored: 1 });
    expect(mockDb.prepare('SELECT uid FROM videos ORDER BY uid').all()).toEqual([{ uid: 'news-peak' }, { uid: 'sky' }]);
  });
});
