/**
 * @jest-environment node
 *
 * The admin home's read (lib/admin/home), over a real SQLite (D1 is SQLite).
 *
 * The page puts one post first, the same one the Studio's Today opens on, so
 * the read must bring every open post due by the end of his day (yesterday's
 * unfinished one too), the day's own posts whatever their state (for the
 * rail), what went out today, and the next few after it, and nothing else.
 * The facts beside it must each stand alone: one that cannot be read is
 * null, never the whole page.
 */
import { readHome } from '@/lib/admin/home';
import { queueOf } from '@/lib/social/postQueue';

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: unknown[]): unknown[]; run(...params: unknown[]): unknown };
};
// node:sqlite has no typings in this repo's @types/node; these methods are all we use.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };
const mockDb = new DatabaseSync(':memory:');

jest.mock('@/lib/db', () => ({
  queryDatabase: async (sql: string, params: unknown[] = []) => mockDb.prepare(sql).all(...params),
}));
jest.mock('@/lib/inbox/threads', () => ({ unreadThreadCount: async () => 2 }));
let mockLevelsFail = false;
jest.mock('@/lib/levelsServer', () => ({
  getLevelsOrThrow: async () => {
    if (mockLevelsFail) throw new Error('the database did not answer');
    return [{ song: 'Billie Jean' }, { song: 'Billie Jean' }, { song: 'Fils de joie' }];
  },
}));
jest.mock('@/lib/shopify', () => ({
  getShopifyProduct: async (handle: string) =>
    handle === 'infinity-hoodie' ? { success: true, product: { title: 'Infinity Hoodie' } } : { success: false },
}));
jest.mock('next/cache', () => ({ revalidateTag: () => {} }));

// Days are the device's own (lib/social/postQueue), so every time here is on the local clock: Oct 28, 11:20
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();
const now = new Date(2026, 9, 28, 11, 20);
// His day, as the page sends it
const since = new Date(2026, 9, 28, 0, 0, 0, 0).toISOString();
const until = new Date(2026, 9, 28, 23, 59, 59, 999).toISOString();

function post(id: string, scheduled: string, status = 'draft', extra: Record<string, unknown> = {}) {
  const row = {
    id,
    status,
    scheduled_at: scheduled,
    media_url: `https://video/${id}.mp4`,
    media_type: 'video',
    platforms: '["instagram","tiktok"]',
    platform_status: '{}',
    tags: '["reels"]',
    campaign_id: 'camp_fdj',
    ...extra,
  };
  const keys = Object.keys(row);
  mockDb.prepare(`INSERT INTO social_posts (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(row));
}

beforeAll(() => {
  mockDb.exec(`
    CREATE TABLE social_posts (id TEXT PRIMARY KEY, status TEXT, title TEXT, tags TEXT, campaign_id TEXT, caption TEXT,
      hashtags TEXT, caption_by_platform TEXT, media_type TEXT, media_url TEXT, thumbnail_url TEXT, platforms TEXT,
      platform_status TEXT, scheduled_at TEXT, published_at TEXT, notes TEXT);
    CREATE TABLE campaigns (id TEXT PRIMARY KEY, name TEXT, color TEXT);
    CREATE TABLE commerce_orders (shopify_created_at TEXT, cancelled_at TEXT);
    CREATE TABLE warehouse_projects (title TEXT, status TEXT, created_at TEXT);
    CREATE TABLE site_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
  `);
  mockDb.prepare(`INSERT INTO campaigns VALUES ('camp_fdj', '1-2 · Fils de joie', '#e0644c'), ('camp_other', 'Training · Monkey', '#123456')`).run();

  post('yesterday-unfinished', at(27, 12));
  post('today-10', at(28, 10), 'published', { published_at: at(28, 10, 58), platforms: '["youtube"]' });
  post('today-12', at(28, 12), 'draft', { platform_status: '{"tiktok":{"posted":true}}' });
  post('today-18', at(28, 18), 'draft', { platforms: '["youtube"]' });
  post('tomorrow-12', at(29, 12));
  post('oct29-18', at(29, 18));
  post('oct30-12', at(30, 12));
  post('oct30-18', at(30, 18));
  post('last-week', at(21, 12), 'published', { published_at: at(21, 12, 30) });
  post('no-video', at(28, 13), 'draft', { media_url: null });

  // Shopify's times carry the shop's offset: compared as text, "2026-10-25T…-07:00" is not a week old or new
  mockDb.prepare(`INSERT INTO commerce_orders VALUES (?, NULL), (?, NULL), (?, ?)`).run(
    '2026-10-25T15:00:00-07:00',
    '2026-10-10T15:00:00-07:00',
    '2026-10-26T09:00:00-07:00',
    '2026-10-26T10:00:00-07:00',
  );
  mockDb.prepare(`INSERT INTO warehouse_projects VALUES ('Signs of Life', 'active', '2026-09-01'), ('Old single', 'archived', '2026-10-01')`).run();
  mockDb.prepare(`INSERT INTO site_settings VALUES ('featured_product', 'infinity-hoodie', '2026-10-01')`).run();
});

afterEach(() => {
  mockLevelsFail = false;
});

describe('the admin home', () => {
  it("brings today's posts and the next few, and nothing else", async () => {
    const home = await readHome({ since, until, now });
    expect(home.posts.map((p) => p.id).sort()).toEqual(
      ['yesterday-unfinished', 'today-10', 'today-12', 'today-18', 'tomorrow-12', 'oct29-18', 'oct30-12'].sort(),
    );
    expect(home.posts.find((p) => p.id === 'today-12')?.platforms).toEqual(['instagram', 'tiktok']);
    expect(home.campaigns).toEqual([{ id: 'camp_fdj', name: '1-2 · Fils de joie', color: '#e0644c' }]);

    const queue = queueOf(home.posts, now);
    expect(queue.due.map((p) => p.id)).toEqual(['yesterday-unfinished', 'today-12', 'today-18']);
    expect(queue.postedToday.map((p) => p.id)).toEqual(['today-10']);
  });

  it('gives one fact per job', async () => {
    const home = await readHome({ since, until, now });
    expect(home).toMatchObject({
      inbox: 2,
      orders: 1,
      levels: 2,
      featured: { title: 'Infinity Hoodie', missing: false },
      release: { title: 'Signs of Life', more: 0 },
    });
  });

  it('says when the piece first on /links is no longer in the store', async () => {
    mockDb.prepare(`UPDATE site_settings SET value = 'infinity-zip-hoodie' WHERE key = 'featured_product'`).run();
    try {
      expect((await readHome({ since, until, now })).featured).toEqual({ title: null, missing: true });
    } finally {
      mockDb.prepare(`UPDATE site_settings SET value = 'infinity-hoodie' WHERE key = 'featured_product'`).run();
    }
  });

  it('leaves a fact it cannot read empty, and the rest standing', async () => {
    mockLevelsFail = true;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const home = await readHome({ since, until, now });
    spy.mockRestore();
    expect(home.levels).toBeNull();
    expect(home.inbox).toBe(2);
    expect(home.posts.length).toBeGreaterThan(0);
  });
});
