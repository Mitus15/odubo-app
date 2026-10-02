/**
 * @jest-environment node
 *
 * Adding a song from the album screens ("View & Add Tracks", "Edit Tracks").
 *
 * AlbumModal posted one multipart form to /api/tracks, which reads JSON, so
 * every upload answered 500 "Failed to create track". It read `trackId` from a
 * route that answers `id`, and its credits rode in a field nothing read.
 *
 * The upload flow runs here against the real routes it calls: /api/upload
 * (only the R2 write is stubbed), POST /api/tracks and PUT
 * /api/tracks/[id]/credits, over a real SQLite (D1 is SQLite). If either side
 * of the contract moves without the other, this fails.
 */
import { NextRequest } from 'next/server';
import { uploadAlbumTrack, type NewAlbumTrack } from '@/lib/uploads/albumTrackUpload';
import { POST as upload } from '@/app/api/upload/route';
import { POST as createTrack } from '@/app/api/tracks/route';
import { PUT as saveCredits } from '@/app/api/tracks/[id]/credits/route';

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

const mockAdmin = { userId: 'admin-1', is_admin: true };
jest.mock('@/lib/auth', () => ({
  getUserFromRequest: async () => mockAdmin,
  verifyUserFromRequest: async () => mockAdmin,
  isAdminUser: (user: { is_admin?: boolean } | null) => Boolean(user?.is_admin),
}));

// R2 is the one thing not run. What the upload route asked it to store, and
// what R2 answers next.
const mockStored: Array<{ key: string; bytes: number; type: string }> = [];
let mockR2Refusal: string | null = null;
jest.mock('@/worker/upload', () => ({
  uploadWithKey: async (data: Uint8Array, _name: string, type: string, key: string) => {
    if (mockR2Refusal) return { success: false, error: mockR2Refusal };
    mockStored.push({ key, bytes: data.byteLength, type });
    // The bucket's public URL, which is what the album wizard stores.
    return { success: true, url: `https://media.odubo.studio/${key}`, key };
  },
  uploadFile: async () => ({ success: false, error: 'not this path' }),
  uploadFileOrganized: async () => ({ success: false, error: 'not this path' }),
}));

// The browser's fetch, answered by the routes themselves.
const routes = async (input: string, init: RequestInit = {}): Promise<Response> => {
  const req = new NextRequest(new URL(input, 'http://localhost'), {
    method: init.method,
    headers: init.headers,
    body: init.body,
  });
  const { pathname } = req.nextUrl;
  if (pathname === '/api/upload') return upload(req);
  if (pathname === '/api/tracks') return createTrack(req);
  const credits = pathname.match(/^\/api\/tracks\/([^/]+)\/credits$/);
  if (credits) return saveCredits(req, { params: Promise.resolve({ id: credits[1] }) });
  throw new Error(`No route for ${pathname}`);
};
const mockFetch = jest.fn(routes);

const loopSoul = { id: 'loop-soul', title: 'Loop Soul' };
const makunahea: NewAlbumTrack = {
  file: new File(['ID3 Makunahea'], 'Makunahea.mp3', { type: 'audio/mpeg' }),
  title: 'Makunahea',
  track_number: 1,
  duration: 214,
  explicit_content: false,
  credits: [
    { track_id: '', role: 'Producer', name: 'Mani Odubo', is_featured: false },
    { track_id: '', role: 'Featured Artist', name: 'Guest Vocalist', is_featured: true },
  ],
};

const count = (table: string) => (mockDb.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

beforeEach(() => {
  mockStored.length = 0;
  mockR2Refusal = null;
  mockFetch.mockReset();
  mockFetch.mockImplementation(routes);
  global.fetch = mockFetch as unknown as typeof fetch;
  mockDb.exec(`
    DROP TABLE IF EXISTS track_credits;
    DROP TABLE IF EXISTS tracks;
    CREATE TABLE tracks (
      id TEXT PRIMARY KEY, album_id TEXT, title TEXT NOT NULL, track_number INTEGER NOT NULL,
      duration INTEGER NOT NULL, audio_url TEXT, audio_status TEXT DEFAULT 'pending',
      explicit_content BOOLEAN DEFAULT FALSE, created_at DATETIME, updated_at DATETIME,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')) -- migration 005
    );
    CREATE TABLE track_credits (
      id INTEGER PRIMARY KEY AUTOINCREMENT, track_id TEXT NOT NULL, role TEXT NOT NULL,
      name TEXT NOT NULL, is_featured BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE CASCADE
    );
  `);
});

describe('adding a song to an album', () => {
  it('stores the audio, then makes the track pointing at it, then files its credits under its id', async () => {
    const { id, creditsSaved } = await uploadAlbumTrack(loopSoul, makunahea);

    const key = 'music/albums/loop-soul/tracks/01-makunahea.mp3';
    expect(mockStored).toEqual([{ key, bytes: makunahea.file.size, type: 'audio/mpeg' }]);
    // The media proxy's address for that key, not the bucket's URL: the proxy
    // only holds back an unreleased album's audio when it knows the key is a
    // track's, and it knows a track by this form of audio_url.
    expect(mockDb.prepare('SELECT id, album_id, title, track_number, duration, audio_url, status FROM tracks').all()).toEqual([
      { id, album_id: 'loop-soul', title: 'Makunahea', track_number: 1, duration: 214, audio_url: `/api/media/audio/${key}`, status: 'draft' },
    ]);
    expect(creditsSaved).toBe(true);
    expect(mockDb.prepare('SELECT track_id, role, name, is_featured FROM track_credits ORDER BY id').all()).toEqual([
      { track_id: id, role: 'Producer', name: 'Mani Odubo', is_featured: 0 },
      { track_id: id, role: 'Featured Artist', name: 'Guest Vocalist', is_featured: 1 },
    ]);
  });

  it('asks nothing of the credits route for a song with no credits', async () => {
    await uploadAlbumTrack(loopSoul, { ...makunahea, title: 'News Peak', track_number: 5, credits: [] });
    expect(mockFetch.mock.calls.map(([url]) => url)).toEqual(['/api/upload', '/api/tracks']);
    expect(mockDb.prepare('SELECT title, audio_url FROM tracks').all()).toEqual([
      { title: 'News Peak', audio_url: '/api/media/audio/music/albums/loop-soul/tracks/05-news-peak.mp3' },
    ]);
  });

  it('keeps the explicit mark the owner set, which the album player shows', async () => {
    await uploadAlbumTrack(loopSoul, { ...makunahea, explicit_content: true });
    await uploadAlbumTrack(loopSoul, { ...makunahea, title: 'News Peak', track_number: 5 });
    expect(mockDb.prepare('SELECT title, explicit_content FROM tracks ORDER BY track_number').all()).toEqual([
      { title: 'Makunahea', explicit_content: 1 },
      { title: 'News Peak', explicit_content: 0 },
    ]);
  });

  it('makes no track when storage refuses the audio, and says why', async () => {
    mockR2Refusal = 'Access Denied';
    await expect(uploadAlbumTrack(loopSoul, makunahea)).rejects.toThrow('Access Denied');
    expect(count('tracks')).toBe(0);
  });

  it("names a file too big for the upload route rather than failing to read Vercel's 413", async () => {
    mockFetch.mockImplementationOnce(async () => new Response('Request Entity Too Large', { status: 413 }));
    await expect(uploadAlbumTrack(loopSoul, makunahea)).rejects.toThrow('The file is too large to upload here');
    expect(count('tracks')).toBe(0);
  });

  it('refuses a song with no title or track number before its audio is sent anywhere', async () => {
    await expect(uploadAlbumTrack(loopSoul, { ...makunahea, title: '  ' })).rejects.toThrow('Needs a title and a track number');
    await expect(uploadAlbumTrack(loopSoul, { ...makunahea, track_number: NaN })).rejects.toThrow('Needs a title and a track number');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('reports credits that did not save without making the track a failure to retry', async () => {
    mockFetch.mockImplementation(async (input: string, init?: RequestInit) =>
      input.endsWith('/credits') ? Response.json({ error: 'Failed to update credits' }, { status: 500 }) : routes(input, init),
    );
    const { id, creditsSaved } = await uploadAlbumTrack(loopSoul, makunahea);
    expect(creditsSaved).toBe(false);
    expect(mockDb.prepare('SELECT id FROM tracks').all()).toEqual([{ id }]);
  });
});
