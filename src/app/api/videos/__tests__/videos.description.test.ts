/**
 * @jest-environment node
 *
 * POST /api/videos/description/generate spends paid AI calls and reads any
 * video by id, hidden ones included, with their lyrics, into what it writes
 * back. It had no login check. Only an admin session may reach it now.
 */
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { getJwtSecret } from '@/lib/auth';
import { POST as generate } from '../description/generate/route';

const mockQueryDatabase = jest.fn();
const mockGemini = jest.fn();
const mockDeepSeek = jest.fn();
jest.mock('@/lib/db', () => ({ queryDatabase: (...args: unknown[]) => mockQueryDatabase(...args) }));
jest.mock('@/lib/gemini', () => ({ callGeminiMultimodal: (...args: unknown[]) => mockGemini(...args) }));
jest.mock('@/lib/deepseek', () => ({ callDeepSeekWithRetry: (...args: unknown[]) => mockDeepSeek(...args) }));

/** The response shape the route reads from either model. */
const reply = (text: string) => ({ data: { candidates: [{ content: { parts: [{ text }] } }] } });

const sign = (claims: Record<string, unknown>, secret = getJwtSecret()) =>
  new SignJWT({ userId: 'u1', email: 'someone@example.com', ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/videos/description/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

/** Nothing read, nothing spent. */
function expectUntouched() {
  expect(mockQueryDatabase).not.toHaveBeenCalled();
  expect(mockGemini).not.toHaveBeenCalled();
  expect(mockDeepSeek).not.toHaveBeenCalled();
}

const savedEnv = { ...process.env };
beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret';
});
afterAll(() => {
  process.env = savedEnv;
});
beforeEach(() => {
  mockQueryDatabase.mockReset().mockResolvedValue([]);
  mockGemini.mockReset().mockResolvedValue(reply('From the frames.'));
  mockDeepSeek.mockReset().mockResolvedValue(reply('From the title.'));
});

describe('POST /api/videos/description/generate', () => {
  it('turns away an anonymous caller before reading the video or calling a model', async () => {
    expect((await generate(post({ videoId: 445 }))).status).toBe(401);
    expectUntouched();
  });

  it('turns away a token that claims admin without the signature', async () => {
    const forged = await sign({ is_admin: true }, 'not-the-secret');
    expect((await generate(post({ videoId: 445 }, { cookie: `token=${forged}` }))).status).toBe(401);
    expectUntouched();
  });

  it('turns away a signed-in user who is not an admin', async () => {
    const fan = await sign({ is_admin: false });
    expect((await generate(post({ videoId: 445 }, { cookie: `token=${fan}` }))).status).toBe(403);
    expectUntouched();
  });

  it("writes a description for an admin's Bearer token, the way /process forwards it", async () => {
    const admin = await sign({ is_admin: true });
    const res = await generate(post({ title: 'Makunahea' }, { authorization: `Bearer ${admin}` }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ description: 'From the title.', visualsSkipped: false });
    expect(mockDeepSeek).toHaveBeenCalledTimes(1);
  });
});
