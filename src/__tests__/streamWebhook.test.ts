/**
 * @jest-environment node
 *
 * The Stream webhook believes only Cloudflare, and completes without
 * overruling.
 *
 * The signature. Stream signs each notification, keyed with the secret
 * Cloudflare returned when the webhook was registered:
 *   Webhook-Signature: time=<unix seconds>,sig1=<hex HMAC-SHA256 of `${time}.${body}`>
 * A missing, forged, tampered or stale one is refused before the database,
 * and production without the secret refuses everything. Until 2026-10-02 the
 * route checked only when an invented header was present.
 *
 * What a genuine one does. Cloudflare sends the video object with uid,
 * readyToStream and duration at the top level, a shape the route did not
 * read until 2026-10-02, so none of its writes had ever run. For a row still
 * waiting on Stream it fills the duration, and starts an automatic poster (a
 * clip's random frame, a parent video's Gemini pick) only over Stream's
 * default frame on a video no poster was made for. Status and visibility are
 * never touched. A row written after Stream finished (the Loop film
 * pipeline) or already complete is left alone.
 *
 * The route's own SQL runs against a real SQLite (D1 is SQLite).
 */
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/stream/webhook/route';

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number | bigint };
  };
};
// node:sqlite has no typings in this repo's @types/node; these methods are all we use.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };
const mockDb = new DatabaseSync(':memory:');

// Params reach D1 as JSON, so an undefined one arrives as null.
const mockBind = (params: unknown[]) => params.map((p) => (p === undefined ? null : p));

const mockReached = jest.fn();
jest.mock('@/lib/db', () => ({
  ...jest.requireActual('@/lib/db'),
  queryDatabase: async (sql: string, params: unknown[] = []) => {
    mockReached(sql);
    return mockDb.prepare(sql).all(...mockBind(params));
  },
  executeQuery: async (sql: string, params: unknown[] = []) => {
    mockReached(sql);
    const run = mockDb.prepare(sql).run(...mockBind(params));
    return { result: [{ results: [], success: true, meta: { changes: Number(run.changes) } }], errors: [], messages: [], success: true };
  },
}));

const mockThumbnails = jest.fn();
jest.mock('@/lib/thumbnailService', () => ({
  generateClipThumbnail: async (...args: unknown[]) => {
    mockThumbnails('clip', ...args);
    return { success: true, posterUrl: 'https://r2.example/clip.jpg' };
  },
  generateAIThumbnailCandidates: async (...args: unknown[]) => {
    mockThumbnails('ai', ...args);
    return { success: true, posterUrl: 'https://r2.example/parent.jpg' };
  },
}));

// after() runs its task once the response is sent; here the test runs it.
const mockAfter: Array<() => unknown> = [];
jest.mock('next/server', () => ({
  ...jest.requireActual('next/server'),
  after: (task: () => unknown) => {
    mockAfter.push(task);
  },
}));
const runAfter = async () => {
  for (const task of mockAfter.splice(0)) await task();
};

const SECRET = 'stream-webhook-test-secret';
/** When Stream finished processing, as each notification reports it. */
const PROCESSED_AT = '2026-10-02T18:05:00.000000Z';
const defaultPoster = (uid: string) => `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`;

const now = () => Math.floor(Date.now() / 1000);
const sign = (body: string, { secret = SECRET, time = now() } = {}) =>
  `time=${time},sig1=${crypto.createHmac('sha256', secret).update(`${time}.${body}`).digest('hex')}`;

/** A notification in the shape Cloudflare's docs show: the video object itself. */
const notification = (uid: string, overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    uid,
    creator: null,
    thumbnail: `https://customer-test.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`,
    readyToStream: true,
    status: { state: 'ready', pctComplete: '100.000000', errorReasonCode: '', errorReasonText: '' },
    meta: { name: `${uid}.mp4` },
    created: '2026-10-02T18:00:30.000000Z',
    modified: PROCESSED_AT,
    duration: 225.4,
    ...overrides,
  });

const send = (body: string, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest('http://localhost/api/stream/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
    })
  );
const sendSigned = (body: string) => send(body, { 'webhook-signature': sign(body) });

const row = (uid: string) =>
  mockDb
    .prepare(
      `SELECT status, is_public, publication_status, duration, duration_seconds, poster_url, thumbnail_status
       FROM videos WHERE uid = ?`
    )
    .get(uid);
const writes = () => mockReached.mock.calls.map(([sql]) => String(sql)).filter((sql) => !/^\s*SELECT/i.test(sql));

const OLD_ENV = process.env;

beforeEach(() => {
  process.env = { ...OLD_ENV, CLOUDFLARE_STREAM_WEBHOOK_SECRET: SECRET };
  mockReached.mockClear();
  mockThumbnails.mockClear();
  mockAfter.length = 0;
  // Rows as each writer leaves them. Arsenal writes its row while Stream is
  // still processing, with no duration and Stream's default frame. The film
  // pipeline writes after Stream is done (here past its readiness wait, so
  // without a duration).
  mockDb.exec(`
    DROP TABLE IF EXISTS videos;
    CREATE TABLE videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT,
      stream_video_id TEXT,
      title TEXT,
      category TEXT,
      mood TEXT,
      type TEXT,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
      is_public INTEGER,
      publication_status TEXT NOT NULL DEFAULT 'archived' CHECK (publication_status IN ('live','archived')),
      duration TEXT,
      duration_seconds REAL,
      poster_url TEXT,
      thumbnail TEXT,
      thumbnail_status TEXT DEFAULT 'pending',
      parent_video_id INTEGER,
      created_at TEXT,
      updated_at TEXT
    );
    INSERT INTO videos (id, uid, stream_video_id, title, category, mood, type, status, is_public, publication_status, duration, poster_url, thumbnail, created_at)
      VALUES (1, 'parent-uid', 'parent-uid', 'Makunahea', 'music-video', 'joy', 'music-video', 'published', 0, 'live', '',
              '${defaultPoster('parent-uid')}', '${defaultPoster('parent-uid')}', '2026-10-02 18:00:00');
    INSERT INTO videos (id, uid, stream_video_id, title, type, status, is_public, publication_status, duration, poster_url, thumbnail, parent_video_id, created_at)
      VALUES (2, 'clip-uid', 'clip-uid', 'Makunahea, clip 1', 'clip', 'published', 0, 'archived', '0',
              '${defaultPoster('clip-uid')}', '${defaultPoster('clip-uid')}', 1, '2026-10-02 18:01:00');
    INSERT INTO videos (id, uid, stream_video_id, title, type, status, is_public, publication_status, duration, poster_url, thumbnail, created_at)
      VALUES (3, 'kept-uid', 'kept-uid', 'Archived, poster chosen', 'music-video', 'archived', 0, 'archived', '',
              'https://media.example/chosen.jpg', 'https://media.example/chosen.jpg', '2026-10-02 18:00:00');
    INSERT INTO videos (id, uid, stream_video_id, title, type, status, is_public, publication_status, poster_url, thumbnail, created_at)
      VALUES (4, 'film-uid', 'film-uid', 'Loop Soul, the film', 'feature', 'published', 0, 'archived',
              '${defaultPoster('film-uid')}', '${defaultPoster('film-uid')}', '2026-10-02T18:20:00.000Z');
  `);
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe('POST /api/stream/webhook', () => {
  describe('refuses, before the database, a request with', () => {
    // What a forger could want: a wrong duration, a poster run on our Gemini key.
    const forged = notification('parent-uid', { duration: 9999 });

    it.each<[string, () => Record<string, string>, string]>([
      ['no Webhook-Signature header', () => ({}), 'Missing signature'],
      [
        'only the old cf-webhook-signature header, signed the old way',
        () => ({ 'cf-webhook-signature': crypto.createHmac('sha256', SECRET).update(forged).digest('hex') }),
        'Missing signature',
      ],
      ['a signature made with another secret', () => ({ 'webhook-signature': sign(forged, { secret: 'not-the-secret' }) }), 'Invalid signature'],
      ['a genuine signature for another body', () => ({ 'webhook-signature': sign(notification('parent-uid')) }), 'Invalid signature'],
      ['a header that does not parse', () => ({ 'webhook-signature': 'sig1=abc' }), 'Malformed signature'],
      ['a genuine signature ten minutes old', () => ({ 'webhook-signature': sign(forged, { time: now() - 600 }) }), 'Stale signature'],
      ['a genuine signature ten minutes ahead', () => ({ 'webhook-signature': sign(forged, { time: now() + 600 }) }), 'Stale signature'],
    ])('%s', async (_case, headers, error) => {
      const before = row('parent-uid');
      const res = await send(forged, headers());

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error });
      expect(mockReached).not.toHaveBeenCalled();
      expect(mockAfter).toHaveLength(0);
      expect(row('parent-uid')).toEqual(before);
    });

    it('nothing at all in production without the secret, even a signed notification', async () => {
      process.env = { ...process.env, NODE_ENV: 'production' };
      delete process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
      const before = row('parent-uid');
      const res = await sendSigned(notification('parent-uid'));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Webhook verification not configured' });
      expect(mockReached).not.toHaveBeenCalled();
      expect(row('parent-uid')).toEqual(before);
    });
  });

  it('outside production, without the secret, skips the check for local work', async () => {
    delete process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
    const res = await send(notification('parent-uid'));

    expect(res.status).toBe(200);
    expect(row('parent-uid')).toMatchObject({ duration: '225' });
  });

  it('a secret pasted with a trailing newline still verifies', async () => {
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = `${SECRET}\n`;
    const res = await sendSigned(notification('parent-uid'));

    expect(res.status).toBe(200);
    expect(row('parent-uid')).toMatchObject({ duration: '225' });
  });

  describe('a genuine notification', () => {
    it("fills a waiting parent video's duration and starts its Gemini poster after the response, nothing else", async () => {
      const res = await sendSigned(notification('parent-uid'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, poster: 'generating' });
      expect(row('parent-uid')).toEqual({
        status: 'published',
        is_public: 0,
        publication_status: 'live',
        duration: '225',
        duration_seconds: 225.4,
        poster_url: defaultPoster('parent-uid'),
        thumbnail_status: 'generating',
      });
      expect(mockThumbnails).not.toHaveBeenCalled();

      await runAfter();
      expect(mockThumbnails).toHaveBeenCalledTimes(1);
      expect(mockThumbnails).toHaveBeenCalledWith('ai', 'parent-uid', 1, { title: 'Makunahea', category: 'music-video', mood: 'joy' });
    });

    it('gives a waiting clip a random frame', async () => {
      const res = await sendSigned(notification('clip-uid'));

      expect(await res.json()).toEqual({ success: true, poster: 'generating' });
      await runAfter();
      expect(mockThumbnails).toHaveBeenCalledWith('clip', 'clip-uid', 225, 2);
    });

    it("never touches status, visibility or a poster someone chose, and still fills the duration", async () => {
      const res = await sendSigned(notification('kept-uid'));

      expect(await res.json()).toEqual({ success: true, poster: 'kept' });
      expect(row('kept-uid')).toEqual({
        status: 'archived',
        is_public: 0,
        publication_status: 'archived',
        duration: '225',
        duration_seconds: 225.4,
        poster_url: 'https://media.example/chosen.jpg',
        thumbnail_status: 'pending',
      });
      expect(mockAfter).toHaveLength(0);
    });

    it('does not start a poster another run is already making', async () => {
      mockDb.exec(`UPDATE videos SET thumbnail_status = 'generating' WHERE uid = 'parent-uid'`);
      const res = await sendSigned(notification('parent-uid'));

      expect(await res.json()).toEqual({ success: true, poster: 'kept' });
      expect(row('parent-uid')).toMatchObject({ duration: '225', thumbnail_status: 'generating' });
      expect(mockAfter).toHaveLength(0);
    });

    it('leaves alone a row written after Stream finished, like the Loop film', async () => {
      const before = row('film-uid');
      const res = await sendSigned(notification('film-uid'));

      expect(await res.json()).toEqual({ success: true, skipped: 'written after processing' });
      expect(row('film-uid')).toEqual(before);
      expect(writes()).toEqual([]);
      expect(mockAfter).toHaveLength(0);
    });

    it('does nothing the second time it hears of the same video', async () => {
      await sendSigned(notification('parent-uid'));
      const res = await sendSigned(notification('parent-uid', { duration: 300 }));

      expect(await res.json()).toEqual({ success: true, skipped: 'already complete' });
      expect(row('parent-uid')).toMatchObject({ duration: '225', duration_seconds: 225.4 });
      expect(mockAfter).toHaveLength(1);
    });

    it.each<[string, string, string]>([
      ['an upload Stream could not process', notification('parent-uid', { readyToStream: false, status: { state: 'error', errorReasonCode: 'ERR_MALFORMED_VIDEO' } }), 'processing failed'],
      ['a video no row waits for', notification('someone-elses-uid'), 'no row'],
    ])('about %s writes nothing', async (_case, body, skipped) => {
      const before = row('parent-uid');
      const res = await sendSigned(body);

      expect(await res.json()).toEqual({ success: true, skipped });
      expect(writes()).toEqual([]);
      expect(row('parent-uid')).toEqual(before);
    });

    it('also reads the Stream API shape, the video under result', async () => {
      const res = await sendSigned(JSON.stringify({ result: JSON.parse(notification('parent-uid')) }));

      expect(await res.json()).toEqual({ success: true, poster: 'generating' });
      expect(row('parent-uid')).toMatchObject({ duration: '225' });
    });
  });
});
