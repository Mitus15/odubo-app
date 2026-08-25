import { GET as getVideos } from '../route';

jest.mock('@/lib/db', () => ({
  queryDatabase: jest.fn(),
  executeQuery: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  getUserFromRequest: jest.fn(() => null),
  isAdminUser: jest.fn(() => false),
}));

jest.mock('@/lib/audit', () => ({
  writeAuditLog: jest.fn(async () => {}),
}));

/**
 * Contract for GET /api/videos.
 *
 * Note: this route used to retry with a reduced "fallback schema" when the
 * full SELECT failed. That was removed deliberately — see the comment at
 * route.ts:21, "fail loudly if schema is wrong" — because silently serving a
 * degraded row shape hid broken migrations. The old test for the fallback
 * outlived the feature and had been red ever since; it is replaced here by
 * the fail-loudly case.
 */
describe('GET /api/videos', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { queryDatabase } = require('@/lib/db');

  const row = (over: Record<string, unknown> = {}) => ({
    id: 1,
    uid: 'u',
    title: 't',
    description: '',
    url: 'https://example.com/v.m3u8',
    video_url: 'https://example.com/v.m3u8',
    poster_url: 'poster',
    thumbnail_url: 'poster',
    thumbnail: '',
    duration: '0',
    duration_seconds: 12,
    category: '',
    is_public: 1,
    type: '',
    mood: '',
    credits: '[]',
    tags: '[]',
    related_projects: '[]',
    created_at: '2020-01-01',
    ...over,
  });

  const call = (query = 'limit=10&offset=0') =>
    getVideos(new Request(`http://localhost/api/videos?${query}`) as never);

  const lastParams = () => (queryDatabase as jest.Mock).mock.calls.at(-1)![1] as unknown[];
  const lastSql = () => String((queryDatabase as jest.Mock).mock.calls.at(-1)![0]);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns transformed videos on success', async () => {
    (queryDatabase as jest.Mock).mockResolvedValueOnce([row()]);

    const res = await call();
    const json = await res.json();

    expect(res.ok).toBe(true);
    expect(json.success).toBe(true);
    expect(json.videos).toHaveLength(1);
    expect(json.videos[0].title).toBe('t');
  });

  it('fails loudly with a 500 when the schema is wrong', async () => {
    (queryDatabase as jest.Mock).mockRejectedValueOnce(new Error('no such column'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await call();
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to fetch videos');
    expect(json.details).toContain('no such column');
  });

  it('never caches the response', async () => {
    (queryDatabase as jest.Mock).mockResolvedValueOnce([]);

    const res = await call();

    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('coerces duration to a number and defaults bad values to 0', async () => {
    (queryDatabase as jest.Mock).mockResolvedValueOnce([row({ duration: 'not-a-number' })]);

    const json = await (await call()).json();

    expect(json.videos[0].duration).toBe(0);
  });

  it('parses a JSON tags column', async () => {
    (queryDatabase as jest.Mock).mockResolvedValueOnce([row({ tags: '["live","2024"]' })]);

    const json = await (await call()).json();

    expect(json.videos[0].tags).toEqual(['live', '2024']);
  });

  it('falls back to an empty tag list when the column holds bad JSON', async () => {
    (queryDatabase as jest.Mock).mockResolvedValueOnce([row({ tags: '{not json' })]);

    const json = await (await call()).json();

    expect(json.videos[0].tags).toEqual([]);
  });

  it('recovers a Stream uid from the playback URL when the column is empty', async () => {
    const uid = 'a'.repeat(32);
    (queryDatabase as jest.Mock).mockResolvedValueOnce([
      row({ uid: '', stream_video_id: '', url: `https://videodelivery.net/${uid}/manifest/video.m3u8` }),
    ]);

    const json = await (await call()).json();

    expect(json.videos[0].uid).toBe(uid);
  });

  it('clamps limit to 200 to stop an unbounded scan', async () => {
    (queryDatabase as jest.Mock).mockResolvedValueOnce([]);

    await call('limit=100000&offset=0');

    expect(lastParams()).toEqual([200, 0]);
  });

  it('floors a negative offset at zero', async () => {
    (queryDatabase as jest.Mock).mockResolvedValueOnce([]);

    await call('limit=10&offset=-50');

    expect(lastParams()).toEqual([10, 0]);
  });

  it('filters by uid when given', async () => {
    (queryDatabase as jest.Mock).mockResolvedValueOnce([]);

    await call('uid=abc123');

    expect(lastSql()).toContain('uid = ?');
    expect(lastParams()[0]).toBe('abc123');
  });

  it('filters by publication_status when it is a recognised value', async () => {
    (queryDatabase as jest.Mock).mockResolvedValueOnce([]);

    await call('publication_status=live');

    expect(lastSql()).toContain('publication_status');
    expect(lastParams()[0]).toBe('live');
  });

  it('ignores an unrecognised publication_status rather than filtering on it', async () => {
    (queryDatabase as jest.Mock).mockResolvedValueOnce([]);

    await call('publication_status=bogus');

    expect(lastParams()).toEqual([50, 0]);
  });

  it('supports excluding a type so the media hub can drop clips', async () => {
    (queryDatabase as jest.Mock).mockResolvedValueOnce([]);

    await call('exclude_type=clip');

    expect(lastSql()).toContain("COALESCE(type, '') != ?");
    expect(lastParams()[0]).toBe('clip');
  });
});
