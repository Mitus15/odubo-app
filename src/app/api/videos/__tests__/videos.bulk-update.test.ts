/**
 * @jest-environment node
 *
 * PATCH /api/videos/bulk-update sets the status of whatever videos it is
 * handed, and had no login check: anyone could archive the whole library.
 * Only an admin session may write through it now.
 */
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { getJwtSecret } from '@/lib/auth';
import { PATCH as bulkUpdate } from '../bulk-update/route';

const mockExecuteQuery = jest.fn();
jest.mock('@/lib/db', () => ({
  executeQuery: (...args: unknown[]) => mockExecuteQuery(...args),
}));

const sign = (claims: Record<string, unknown>, secret = getJwtSecret()) =>
  new SignJWT({ userId: 'u1', email: 'someone@example.com', ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));

const patch = (cookie?: string) =>
  new NextRequest('http://localhost/api/videos/bulk-update', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ ids: ['1', '445'], status: 'archived' }),
  });

const savedEnv = { ...process.env };
beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret';
});
afterAll(() => {
  process.env = savedEnv;
});
beforeEach(() => {
  mockExecuteQuery.mockReset().mockResolvedValue({});
});

describe('PATCH /api/videos/bulk-update', () => {
  it('turns away an anonymous caller without touching a row', async () => {
    expect((await bulkUpdate(patch())).status).toBe(401);
    expect(mockExecuteQuery).not.toHaveBeenCalled();
  });

  it('turns away a token that claims admin without the signature', async () => {
    const forged = await sign({ is_admin: true }, 'not-the-secret');
    expect((await bulkUpdate(patch(`token=${forged}`))).status).toBe(401);
    expect(mockExecuteQuery).not.toHaveBeenCalled();
  });

  it('turns away a signed-in user who is not an admin', async () => {
    const fan = await sign({ is_admin: false });
    expect((await bulkUpdate(patch(`token=${fan}`))).status).toBe(403);
    expect(mockExecuteQuery).not.toHaveBeenCalled();
  });

  it('updates the rows for an admin', async () => {
    const admin = await sign({ is_admin: true });
    const res = await bulkUpdate(patch(`token=${admin}`));
    expect(res.status).toBe(200);
    expect(mockExecuteQuery).toHaveBeenCalledWith('UPDATE videos SET status = ? WHERE id IN (?,?)', [
      'archived',
      '1',
      '445',
    ]);
  });
});
