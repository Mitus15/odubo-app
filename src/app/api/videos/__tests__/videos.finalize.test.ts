import { POST as finalize } from '../finalize/route';

jest.mock('@/lib/db', () => ({
  executeQuery: jest.fn(async () => ({})),
  queryDatabase: jest.fn(async () => ([{ id: 1, uid: 'abc', meta_json: JSON.stringify({ title: 'T' }) }])),
}));

jest.mock('@/lib/auth', () => ({
  getUserFromRequest: jest.fn(() => ({ userId: '1', email: 'admin@example.com', isAdmin: true })),
  isAdminUser: jest.fn(() => true),
}));

jest.mock('@/lib/cloudflareStream', () => ({
  __esModule: true,
  default: class MockStream {
    getVideo = jest.fn(async () => ({ result: { duration: 60, status: { state: 'ready', pctComplete: '100' } } }));
    updateVideo = jest.fn(async () => ({}));
    getEmbedUrl = jest.fn(() => 'https://iframe.videodelivery.net/abc');
    getThumbnailUrl = jest.fn(() => 'https://thumb');
  }
}));

jest.mock('@/lib/audit', () => ({
  writeAuditLog: jest.fn(async () => {}),
}));

describe('POST /api/videos/finalize', () => {
  it('inserts a video row given a fake session', async () => {
    const req = new Request('http://localhost/api/videos/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 1, publication_status: 'live' }),
    });

    const res = await finalize(req as any);
    expect(res.ok).toBe(true);
    const json = await (res as any).json();
    expect(json.success).toBe(true);
    expect(typeof json.uid).toBe('string');
  });
});
