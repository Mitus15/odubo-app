import { GET as getVideos } from '../route';

jest.mock('@/lib/db', () => ({
  queryDatabase: jest.fn(),
}));

jest.mock('@/lib/audit', () => ({
  writeAuditLog: jest.fn(async () => {}),
}));

describe('GET /api/videos', () => {
  const { queryDatabase } = require('@/lib/db');

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns data using fallback schema when full query fails', async () => {
    (queryDatabase as jest.Mock)
      .mockRejectedValueOnce(new Error('no such column'))
      .mockResolvedValueOnce([
        { id: 1, uid: 'u', title: 't', description: '', video_url: 'url', thumbnail_url: 'thumb', thumbnail: '', duration: '0', category: '', is_public: 1, type: '', mood: '', credits: '[]', related_projects: '[]', created_at: '2020-01-01' },
      ]);

    const req = new Request('http://localhost/api/videos?limit=10&offset=0');
    const res = await getVideos(req as any);
    expect(res.ok).toBe(true);
    const json = await (res as any).json();
    expect(Array.isArray(json.videos)).toBe(true);
    expect(json.videos.length).toBe(1);
    expect(json.videos[0].title).toBe('t');
  });
});
