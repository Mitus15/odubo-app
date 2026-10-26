/**
 * @jest-environment node
 *
 * POST /api/videos/crop runs ffmpeg on a URL of the caller's choosing and had
 * no login check at all. Only an admin session may reach ffmpeg now.
 */
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { getJwtSecret } from '@/lib/auth';
import { POST as crop } from '../crop/route';

const mockFfmpeg = jest.fn();
jest.mock('fluent-ffmpeg', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockFfmpeg(...args),
}));

/** A stand-in for fluent-ffmpeg's chain that finishes at once. */
function fakeCommand() {
  const command: Record<string, unknown> = {};
  for (const step of ['format', 'videoCodec', 'audioCodec', 'outputOptions', 'on']) {
    command[step] = () => command;
  }
  command.pipe = (out: NodeJS.WritableStream) => out.end();
  return command;
}

const SOURCE = 'https://videodelivery.net/abc/downloads/default.mp4';

const sign = (claims: Record<string, unknown>, secret = getJwtSecret()) =>
  new SignJWT({ userId: 'u1', email: 'someone@example.com', ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));

const post = (cookie?: string) =>
  new NextRequest('http://localhost/api/videos/crop', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ url: SOURCE }),
  });

const savedEnv = { ...process.env };
beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret';
});
afterAll(() => {
  process.env = savedEnv;
});
beforeEach(() => {
  mockFfmpeg.mockReset().mockImplementation(fakeCommand);
});

describe('POST /api/videos/crop', () => {
  it('turns away an anonymous caller before ffmpeg runs', async () => {
    expect((await crop(post())).status).toBe(401);
    expect(mockFfmpeg).not.toHaveBeenCalled();
  });

  it('turns away a token that claims admin without the signature', async () => {
    const forged = await sign({ is_admin: true }, 'not-the-secret');
    expect((await crop(post(`token=${forged}`))).status).toBe(401);
    expect(mockFfmpeg).not.toHaveBeenCalled();
  });

  it('turns away a signed-in user who is not an admin', async () => {
    const fan = await sign({ is_admin: false });
    expect((await crop(post(`token=${fan}`))).status).toBe(403);
    expect(mockFfmpeg).not.toHaveBeenCalled();
  });

  it('crops for an admin', async () => {
    const admin = await sign({ is_admin: true });
    const res = await crop(post(`token=${admin}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(mockFfmpeg).toHaveBeenCalledWith(SOURCE);
  });
});
