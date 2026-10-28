/**
 * @jest-environment node
 *
 * The Studio knows each post's song from the posts list.
 *
 * Every post belongs to a song (its campaign, "1-3 · Santé"), and the Studio
 * names a full song on YouTube after it. Until 2026-10-28 the list left
 * campaign_id out, so the YouTube sheet titled Level 1-2 "Level 1-2." (its
 * caption) and the title was typed by hand.
 *
 * The route's own SQL runs against a real SQLite (D1 is SQLite).
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/social/posts/route';
import { youtubeDetails } from '@/lib/social/appLink';
import type { QueuePost } from '@/lib/social/postQueue';

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number | bigint };
  };
};
// node:sqlite has no typings in this repo's @types/node; these methods are all we use.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };
const mockDb = new DatabaseSync(':memory:');

jest.mock('@/lib/db', () => ({
  ...jest.requireActual('@/lib/db'),
  queryDatabase: async (sql: string, params: unknown[] = []) => mockDb.prepare(sql).all(...params),
}));
jest.mock('@/lib/api/requireAdmin', () => ({ requireAdmin: async () => ({}) }));

const COLUMNS = [
  'id', 'status', 'created_by', 'approved_by', 'entity_id', 'account_ids', 'media_type', 'media_url', 'media_key',
  'thumbnail_url', 'source_type', 'source_id', 'caption', 'caption_by_platform', 'hashtags', 'mentions', 'first_comment',
  'scheduled_at', 'published_at', 'timezone', 'platforms', 'platform_status', 'platform_post_ids', 'platform_errors',
  'title', 'requires_approval', 'is_important', 'notes', 'tags', 'campaign_id', 'error_message', 'retry_count',
  'last_retry_at', 'created_at', 'updated_at',
];

beforeAll(() => {
  mockDb.exec(`CREATE TABLE social_posts (${COLUMNS.map((c) => `${c} TEXT`).join(', ')})`);
  mockDb
    .prepare(
      `INSERT INTO social_posts (id, status, media_type, media_url, caption, scheduled_at, platforms, notes, tags, campaign_id, created_at)
       VALUES (?, 'draft', 'video', ?, 'Level 1-3.', '2026-10-31T17:00:00.000Z', '["youtube"]', ?, '["training","full"]', 'camp_sante', '2026-10-25')`,
    )
    .run('l13', 'https://videodelivery.net/l13/downloads/default.mp4', 'Santé · Stromae\nSong laid in: 0:00 to 3:42');
});

it('lists each post with its song, so a full song goes to YouTube under its own title', async () => {
  const res = await GET(new NextRequest('https://admin.odubostudio.com/api/social/posts?limit=1000'));
  const { posts } = (await res.json()) as { posts: QueuePost[] };

  expect(posts[0].campaign_id).toBe('camp_sante');
  expect(youtubeDetails(posts[0], [{ id: 'camp_sante', name: '1-3 · Santé' }])).toEqual({
    title: '1-3 · Santé',
    description: 'Level 1-3.\n\nSanté · Stromae',
  });
});
