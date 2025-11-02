import { POST as createVideo } from '../route';

jest.mock('@/lib/db', () => ({
  executeQuery: jest.fn(async () => ({})),
}));

jest.mock('@/lib/auth', () => ({
  getUserFromRequest: jest.fn(() => ({ userId: '1', email: 'admin@example.com', isAdmin: true })),
  isAdminUser: jest.fn(() => true),
}));

jest.mock('@/lib/audit', () => ({
  writeAuditLog: jest.fn(async () => {}),
}));

describe('POST /api/videos', () => {
  const { executeQuery } = require('@/lib/db');

  it('creates a row with publication_status', async () => {
    const body = {
      title: 'Test',
      url: 'https://example.com/embed',
      publication_status: 'live',
    };
    const req = new Request('http://localhost/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await createVideo(req as any);
    expect(res.status).toBe(201);
    expect(executeQuery).toHaveBeenCalled();
  });
});
