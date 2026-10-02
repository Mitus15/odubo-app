/**
 * @jest-environment node
 *
 * The Stream webhook believes only Cloudflare. POST /api/stream/webhook
 * rewrites a row of videos (status, duration, poster) for whatever uid it is
 * sent. It checked a signature only when an invented cf-webhook-signature
 * header was present, so a request without one went straight through: anyone
 * could un-archive a video or point its poster at any image.
 *
 * Stream signs each notification, keyed with the secret Cloudflare returned
 * when the webhook was registered:
 *   Webhook-Signature: time=<unix seconds>,sig1=<hex HMAC-SHA256 of `${time}.${body}`>
 * A notification signed that way updates its row as before. A missing,
 * forged, tampered or stale one is refused before the database is reached,
 * and production without the secret refuses everything.
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
    return { success: true };
  },
  generateAIThumbnailCandidates: async (...args: unknown[]) => {
    mockThumbnails('ai', ...args);
    return { success: true };
  },
}));

const SECRET = 'stream-webhook-test-secret';
const STREAM_THUMBNAIL = 'https://customer-test.cloudflarestream.com/uploaded-uid/thumbnails/thumbnail.jpg';
const HIDDEN = {
  status: 'archived',
  duration: '200',
  poster_url: 'https://media.example/hidden.jpg',
  thumbnail: 'https://media.example/hidden.jpg',
};

const now = () => Math.floor(Date.now() / 1000);
const sign = (body: string, { secret = SECRET, time = now() } = {}) =>
  `time=${time},sig1=${crypto.createHmac('sha256', secret).update(`${time}.${body}`).digest('hex')}`;

// The shape handlePayload reads: the video under `data`. Cloudflare's own
// notifications carry these fields at the top level, which the handler does
// not read yet (docs/sessions/2026-10-02-stream-webhook-signature.md).
const notification = (uid: string, thumbnail: string) =>
  JSON.stringify({ data: { uid, readyToStream: true, status: { state: 'ready' }, duration: 42.7, thumbnail } });

const send = (body: string, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest('http://localhost/api/stream/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
    })
  );

const row = (uid: string) =>
  mockDb.prepare('SELECT status, duration, poster_url, thumbnail FROM videos WHERE uid = ?').get(uid);

const OLD_ENV = process.env;

beforeEach(() => {
  process.env = { ...OLD_ENV, CLOUDFLARE_STREAM_WEBHOOK_SECRET: SECRET };
  mockReached.mockClear();
  mockThumbnails.mockClear();
  // A fresh upload waiting on Stream, and a video the owner has hidden.
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
      duration TEXT,
      poster_url TEXT,
      thumbnail TEXT,
      parent_video_id INTEGER
    );
    INSERT INTO videos (id, uid, stream_video_id, title, status)
      VALUES (1, 'uploaded-uid', 'uploaded-uid', 'Makunahea', 'draft');
    INSERT INTO videos (id, uid, stream_video_id, title, status, duration, poster_url, thumbnail)
      VALUES (2, 'hidden-uid', 'hidden-uid', 'Not yet', 'archived', '200', '${HIDDEN.poster_url}', '${HIDDEN.thumbnail}');
  `);
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe('POST /api/stream/webhook', () => {
  it("a notification Stream signed updates its video's status, duration and poster", async () => {
    const body = notification('uploaded-uid', STREAM_THUMBNAIL);
    const res = await send(body, { 'webhook-signature': sign(body) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(row('uploaded-uid')).toEqual({
      status: 'published',
      duration: '42',
      poster_url: STREAM_THUMBNAIL,
      thumbnail: STREAM_THUMBNAIL,
    });
    expect(mockThumbnails).toHaveBeenCalledWith('ai', 'uploaded-uid', 1, expect.objectContaining({ title: 'Makunahea' }));
    expect(row('hidden-uid')).toEqual(HIDDEN);
  });

  it('a secret pasted with a trailing newline still verifies', async () => {
    process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = `${SECRET}\n`;
    const body = notification('uploaded-uid', STREAM_THUMBNAIL);
    const res = await send(body, { 'webhook-signature': sign(body) });

    expect(res.status).toBe(200);
    expect(row('uploaded-uid')).toMatchObject({ status: 'published' });
  });

  describe('refuses, before the database, a request with', () => {
    // What a forger wants: the hidden video live, wearing their poster.
    const forged = notification('hidden-uid', 'https://example.com/not-ours.jpg');

    it.each<[string, () => Record<string, string>, string]>([
      ['no Webhook-Signature header', () => ({}), 'Missing signature'],
      [
        'only the old cf-webhook-signature header, signed the old way',
        () => ({ 'cf-webhook-signature': crypto.createHmac('sha256', SECRET).update(forged).digest('hex') }),
        'Missing signature',
      ],
      ['a signature made with another secret', () => ({ 'webhook-signature': sign(forged, { secret: 'not-the-secret' }) }), 'Invalid signature'],
      [
        'a genuine signature for another body',
        () => ({ 'webhook-signature': sign(notification('hidden-uid', STREAM_THUMBNAIL)) }),
        'Invalid signature',
      ],
      ['a header that does not parse', () => ({ 'webhook-signature': 'sig1=abc' }), 'Malformed signature'],
      ['a genuine signature ten minutes old', () => ({ 'webhook-signature': sign(forged, { time: now() - 600 }) }), 'Stale signature'],
      ['a genuine signature ten minutes ahead', () => ({ 'webhook-signature': sign(forged, { time: now() + 600 }) }), 'Stale signature'],
    ])('%s', async (_case, headers, error) => {
      const res = await send(forged, headers());

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error });
      expect(mockReached).not.toHaveBeenCalled();
      expect(row('hidden-uid')).toEqual(HIDDEN);
    });
  });

  describe('without the secret', () => {
    it('production refuses even a signed notification, before the database', async () => {
      process.env = { ...process.env, NODE_ENV: 'production' };
      delete process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
      const body = notification('hidden-uid', 'https://example.com/not-ours.jpg');
      const res = await send(body, { 'webhook-signature': sign(body) });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Webhook verification not configured' });
      expect(mockReached).not.toHaveBeenCalled();
      expect(row('hidden-uid')).toEqual(HIDDEN);
    });

    it('outside production the check is skipped, for local work', async () => {
      delete process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
      const res = await send(notification('uploaded-uid', STREAM_THUMBNAIL));

      expect(res.status).toBe(200);
      expect(row('uploaded-uid')).toMatchObject({ status: 'published' });
    });
  });
});
