/**
 * @jest-environment node
 *
 * Who may write. On 2026-10-02 a sweep of every POST/PUT/PATCH/DELETE under
 * src/app/api found 58 admin-only handlers that checked nothing, or only that
 * some Authorization header was present: anyone could publish to the owner's
 * social accounts, upload into R2, spend the DeepSeek key, rewrite the BI
 * books, or read a customer's record and orders. Each now opens with the house
 * gate, requireAdmin (requireCronOrAdmin for the two jobs).
 *
 * Every one is called here as a stranger and as a signed-in fan. The gate must
 * answer first: no database, no network, no Stream listing, no tables made.
 */
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { getJwtSecret } from '@/lib/auth';
import { requireCronOrAdmin } from '@/lib/api/requireAdmin';

const mockReached = jest.fn();
jest.mock('@/lib/db', () => ({
  ...jest.requireActual('@/lib/db'),
  queryDatabase: async (sql: string) => {
    mockReached('database', sql);
    throw new Error('reached the database');
  },
  executeQuery: async (sql: string) => {
    mockReached('database', sql);
    throw new Error('reached the database');
  },
}));
jest.mock('@/lib/cloudflareStream', () => ({
  __esModule: true,
  default: class {
    listAllVideos = async () => {
      mockReached('stream');
      return [];
    };
  },
}));
jest.mock('@/lib/setupLikes', () => ({
  setupLikesSystem: async () => {
    mockReached('setup-likes');
    return { success: true, message: 'Likes system tables created successfully' };
  },
}));

// [method, route] for every handler the sweep gated, plus the two jobs' GETs,
// which run the same job.
const GATED: Array<[string, string]> = [
  ['POST', '/api/analytics/insights'],
  ['POST', '/api/analytics/report'],
  ['POST', '/api/announcements'],
  ['DELETE', '/api/announcements'],
  ['POST', '/api/arsenal/link-parent'],
  ['POST', '/api/arsenal/reorder'],
  ['POST', '/api/arsenal/sync-from-stream'],
  ['POST', '/api/arsenal/update'],
  ['POST', '/api/arsenal/woda'],
  ['POST', '/api/bi/ad-campaigns'],
  ['PUT', '/api/bi/ad-campaigns/[id]'],
  ['DELETE', '/api/bi/ad-campaigns/[id]'],
  ['POST', '/api/bi/ad-campaigns/[id]/metrics'],
  ['POST', '/api/bi/expenses'],
  ['PUT', '/api/bi/expenses/[id]'],
  ['DELETE', '/api/bi/expenses/[id]'],
  ['POST', '/api/bi/product-costs'],
  ['PUT', '/api/bi/product-costs'],
  ['DELETE', '/api/bi/product-costs'],
  ['POST', '/api/bi/reports/generate'],
  ['POST', '/api/bi/social-growth'],
  ['POST', '/api/clip-debug'],
  ['POST', '/api/connections/connect'],
  ['POST', '/api/connections/disconnect'],
  ['POST', '/api/connections/sync'],
  ['POST', '/api/cron/compute-cohorts'],
  ['GET', '/api/cron/compute-cohorts'],
  ['POST', '/api/cron/compute-funnels'],
  ['GET', '/api/cron/compute-funnels'],
  ['GET', '/api/customers/[id]'],
  ['PUT', '/api/customers/[id]'],
  ['GET', '/api/customers/[id]/orders'],
  ['POST', '/api/deepseek'],
  ['POST', '/api/entities'],
  ['POST', '/api/fix-audio-mime-types'],
  ['POST', '/api/linktree'],
  ['PATCH', '/api/linktree/[id]'],
  ['DELETE', '/api/linktree/[id]'],
  ['POST', '/api/setup-likes'],
  ['DELETE', '/api/social/accounts'],
  ['POST', '/api/social/accounts/sync'],
  ['POST', '/api/social/library/upload'],
  ['POST', '/api/social/posts'],
  ['PATCH', '/api/social/posts/[id]'],
  ['DELETE', '/api/social/posts/[id]'],
  ['POST', '/api/social/posts/[id]/sync'],
  ['POST', '/api/social/posts/publish'],
  ['POST', '/api/social/posts/sync'],
  ['POST', '/api/social/studio/campaigns'],
  ['PATCH', '/api/social/studio/campaigns/[id]'],
  ['DELETE', '/api/social/studio/campaigns/[id]'],
  ['POST', '/api/social/studio/slots'],
  ['PATCH', '/api/social/studio/slots/[id]'],
  ['DELETE', '/api/social/studio/slots/[id]'],
  ['POST', '/api/social/sync'],
  ['POST', '/api/upload'],
  ['PATCH', '/api/videos/bulk-update'],
  ['POST', '/api/videos/crop'],
  ['POST', '/api/videos/description/generate'],
  ['POST', '/api/videos/upload-enhanced'],
];

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

const sign = (claims: Record<string, unknown>) =>
  new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(getJwtSecret()));

const call = async (method: string, route: string, init: { token?: string; headers?: Record<string, string> } = {}) => {
  const mod = (await import(`@/app${route}/route`)) as Record<string, Handler>;
  const headers: Record<string, string> = { 'content-type': 'application/json', ...init.headers };
  if (init.token) headers.cookie = `token=${init.token}`;
  const req = new NextRequest(`http://localhost${route.replace(/\[\w+\]/g, '1')}`, {
    method,
    headers,
    ...(method === 'GET' ? {} : { body: '{}' }),
  });
  return mod[method](req, { params: Promise.resolve({ id: '1' }) });
};

const realFetch = global.fetch;
const adminEmails = process.env.ADMIN_EMAILS;
let fanToken = '';
let adminToken = '';

beforeAll(async () => {
  process.env.ADMIN_EMAILS = '';
  global.fetch = (async (input: unknown) => {
    mockReached('network', String(input));
    throw new Error('reached the network');
  }) as typeof fetch;
  fanToken = await sign({ userId: 'fan-1', email: 'fan@example.com', is_admin: false });
  adminToken = await sign({ userId: 'admin-1', email: 'owner@example.com', is_admin: true });
});

afterAll(() => {
  global.fetch = realFetch;
  if (adminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = adminEmails;
});

afterEach(() => mockReached.mockClear());

describe.each(GATED)('%s %s', (method, route) => {
  it('turns a stranger away before touching anything', async () => {
    const res = await call(method, route);
    expect(res.status).toBe(401);
    expect(mockReached).not.toHaveBeenCalled();
  });

  it('turns a signed-in fan away before touching anything', async () => {
    const res = await call(method, route, { token: fanToken });
    expect(res.status).toBe(403);
    expect(mockReached).not.toHaveBeenCalled();
  });
});

describe('the admin still gets through', () => {
  // Arsenal's "Sync from Stream" button sends no Authorization header, only
  // the session cookie: that call 401'd under the old Bearer-presence check.
  it('POST /api/arsenal/sync-from-stream on the session cookie alone', async () => {
    const res = await call('POST', '/api/arsenal/sync-from-stream', { token: adminToken });
    expect(res.status).toBe(200);
    expect(mockReached).toHaveBeenCalledWith('stream');
  });

  it('POST /api/setup-likes', async () => {
    const res = await call('POST', '/api/setup-likes', { token: adminToken });
    expect(res.status).toBe(200);
    expect(mockReached).toHaveBeenCalledWith('setup-likes');
  });
});

describe('requireCronOrAdmin', () => {
  const cronSecret = process.env.CRON_SECRET;
  afterEach(() => {
    if (cronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = cronSecret;
  });
  const gate = (headers: Record<string, string>) => requireCronOrAdmin(new NextRequest('http://localhost/api/cron/compute-funnels', { headers }));

  it('lets the scheduler in with the cron secret', async () => {
    process.env.CRON_SECRET = 'cron-test';
    expect((await gate({ authorization: 'Bearer cron-test' })).error).toBeNull();
  });

  it('lets an admin in on their session', async () => {
    process.env.CRON_SECRET = 'cron-test';
    expect((await gate({ cookie: `token=${adminToken}` })).error).toBeNull();
  });

  it('refuses a wrong secret, and any bearer at all when no secret is set', async () => {
    process.env.CRON_SECRET = 'cron-test';
    expect((await gate({ authorization: 'Bearer guess' })).error?.status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await gate({ authorization: 'Bearer undefined' })).error?.status).toBe(401);
  });
});
