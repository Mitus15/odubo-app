/**
 * @jest-environment node
 *
 * Who may read. On 2026-10-02 a sweep of every GET under src/app/api found the
 * owner's books open to anyone: every order with its email and shipping and
 * billing addresses, the BI ledgers, the analytics, social drafts and
 * schedules, every hidden video in the Arsenal with its Stream uid, a listing
 * of the R2 bucket. Each now opens with the house gate, requireAdmin.
 *
 * Every one is called here as a stranger and as a signed-in fan. The gate must
 * answer first: no database, no network, no Stream, no R2.
 */
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { getJwtSecret } from '@/lib/auth';

const mockReached = jest.fn();
// null: the database throws, so anything that reaches it is caught out.
let mockRows: unknown[] | null = null;
jest.mock('@/lib/db', () => ({
  ...jest.requireActual('@/lib/db'),
  queryDatabase: async (sql: string) => {
    mockReached('database', sql);
    if (mockRows) return mockRows;
    throw new Error('reached the database');
  },
  executeQuery: async (sql: string) => {
    mockReached('database', sql);
    throw new Error('reached the database');
  },
}));

const STREAM_KEY = 'secret-stream-key';
let mockLiveInputs: Array<Record<string, unknown>> = [];
const mockLiveInput = (uid: string) => ({
  uid,
  meta: { name: process.env.LIVE_INPUT_NAME || 'odubo-live' },
  rtmps: { url: 'rtmps://live.cloudflare.com:443/live/', streamKey: STREAM_KEY },
  whip: { url: `https://customer.cloudflarestream.com/${STREAM_KEY}/webRTC/publish` },
});
jest.mock('@/lib/cloudflareStream', () => ({
  __esModule: true,
  default: class {
    getVideo = async (uid: string) => {
      mockReached('stream', `getVideo ${uid}`);
      throw new Error('reached Stream');
    };
    listLiveInputs = async () => {
      mockReached('stream', 'listLiveInputs');
      return { result: mockLiveInputs };
    };
    createLiveInput = async () => {
      mockReached('stream', 'createLiveInput');
      return { result: mockLiveInput('new-live') };
    };
    getHlsUrl = (uid: string) => `https://videodelivery.net/${uid}/manifest/video.m3u8`;
    getEmbedUrl = (uid: string) => `https://iframe.videodelivery.net/${uid}`;
  },
}));
jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual('@aws-sdk/client-s3'),
  S3Client: class {
    send = async () => {
      mockReached('r2');
      throw new Error('reached R2');
    };
  },
}));

// Every GET the sweep gated.
const GATED: string[] = [
  '/api/analytics/attribution',
  '/api/analytics/cohorts',
  '/api/analytics/cohorts/ltv',
  '/api/analytics/dashboard',
  '/api/analytics/export',
  '/api/analytics/funnel',
  '/api/analytics/funnel/detailed',
  '/api/analytics/report',
  '/api/analytics/watch-through',
  '/api/arsenal/release-order',
  '/api/arsenal/videos',
  '/api/bi/ad-campaigns',
  '/api/bi/ad-campaigns/[id]',
  '/api/bi/ad-campaigns/[id]/metrics',
  '/api/bi/expenses',
  '/api/bi/expenses/[id]',
  '/api/bi/expenses/summary',
  '/api/bi/product-costs',
  '/api/bi/reports',
  '/api/bi/social-growth',
  '/api/clip-debug',
  '/api/clips/engagement',
  '/api/connections',
  '/api/db/migration-status',
  '/api/entities',
  '/api/fix-audio-mime-types',
  '/api/health/db',
  '/api/intel/commerce',
  '/api/intel/overview',
  '/api/orders',
  '/api/shopify/test-config',
  '/api/social/accounts',
  '/api/social/posts',
  '/api/social/posts/[id]',
  '/api/social/posts/[id]/analytics',
  '/api/social/posts/sync',
  '/api/social/studio/campaigns',
  '/api/social/studio/campaigns/[id]',
  '/api/social/studio/slots',
  '/api/social/studio/slots/[id]',
  '/api/social/sync',
  '/api/stream/status/[uid]',
  '/api/users',
  '/api/videos/cleanup',
  '/api/videos/status',
];

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

const sign = (claims: Record<string, unknown>) =>
  new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(getJwtSecret()));

const get = async (route: string, init: { token?: string; headers?: Record<string, string> } = {}) => {
  const mod = (await import(`@/app${route}/route`)) as Record<string, Handler>;
  const headers: Record<string, string> = { ...init.headers };
  if (init.token) headers.cookie = `token=${init.token}`;
  const req = new NextRequest(`http://localhost${route.replace(/\[\w+\]/g, '1')}`, { method: 'GET', headers });
  return mod.GET(req, { params: Promise.resolve({ id: '1', uid: '1' }) });
};

const realFetch = global.fetch;
const realSetInterval = global.setInterval;
const adminEmails = process.env.ADMIN_EMAILS;
let fanToken = '';
let adminToken = '';

beforeAll(async () => {
  // analytics/funnel and clips/engagement start a rate-limit sweep with
  // setInterval when imported. Unreffed, it no longer holds the run open.
  global.setInterval = ((...args: unknown[]) => {
    const timer = (realSetInterval as unknown as (...a: unknown[]) => NodeJS.Timeout)(...args);
    timer.unref();
    return timer;
  }) as unknown as typeof setInterval;
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
  global.setInterval = realSetInterval;
  if (adminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = adminEmails;
});

afterEach(() => {
  mockReached.mockClear();
  mockRows = null;
  mockLiveInputs = [];
});

describe.each(GATED)('GET %s', (route) => {
  it('turns a stranger away before touching anything', async () => {
    const res = await get(route);
    expect(res.status).toBe(401);
    expect(mockReached).not.toHaveBeenCalled();
  });

  it('turns a signed-in fan away before touching anything', async () => {
    const res = await get(route, { token: fanToken });
    expect(res.status).toBe(403);
    expect(mockReached).not.toHaveBeenCalled();
  });
});

describe('the admin still gets through', () => {
  // The Orders tab fetches with the session cookie and no header.
  it('GET /api/orders on the session cookie alone', async () => {
    mockRows = [];
    const res = await get('/api/orders', { token: adminToken });
    expect(res.status).toBe(200);
    expect(mockReached).toHaveBeenCalledWith('database', expect.stringContaining('FROM orders'));
  });

  it('GET /api/arsenal/videos on a bearer token alone', async () => {
    mockRows = [];
    const res = await get('/api/arsenal/videos', { headers: { authorization: `Bearer ${adminToken}` } });
    expect(res.status).toBe(200);
    expect(mockReached).toHaveBeenCalledWith('database', expect.stringContaining('FROM videos'));
  });
});

// The public /live player reads this route too, for the uid alone. The stream
// key and the WHIP URL let whoever holds them broadcast as the site.
describe('GET /api/stream/live-input', () => {
  type LiveInput = { uid: string; rtmps?: { streamKey?: string }; whip?: { url?: string } } | null;
  const liveInputAs = async (token?: string) => {
    const res = await get('/api/stream/live-input', { token });
    const text = await res.text();
    return { status: res.status, text, liveInput: (JSON.parse(text) as { liveInput: LiveInput }).liveInput };
  };
  const visitors: Array<[string, () => string | undefined]> = [
    ['a stranger', () => undefined],
    ['a signed-in fan', () => fanToken],
  ];

  it.each(visitors)('gives %s the player, never the keys', async (_who, token) => {
    mockLiveInputs = [mockLiveInput('live-1')];
    const { status, text, liveInput } = await liveInputAs(token());
    expect(status).toBe(200);
    expect(liveInput).toEqual({
      uid: 'live-1',
      playback: {
        hls: 'https://videodelivery.net/live-1/manifest/video.m3u8',
        embed: 'https://iframe.videodelivery.net/live-1',
      },
    });
    expect(text).not.toContain(STREAM_KEY);
  });

  it('creates nothing for a stranger when there is no input', async () => {
    expect((await liveInputAs()).liveInput).toBeNull();
    expect(mockReached).not.toHaveBeenCalledWith('stream', 'createLiveInput');
  });

  it('gives the admin the keys, as the admin Live page shows them', async () => {
    mockLiveInputs = [mockLiveInput('live-1')];
    const { liveInput } = await liveInputAs(adminToken);
    expect(liveInput?.rtmps?.streamKey).toBe(STREAM_KEY);
    expect(liveInput?.whip?.url).toContain(STREAM_KEY);
  });

  it("creates the input on the admin's visit when there is none", async () => {
    expect((await liveInputAs(adminToken)).liveInput?.uid).toBe('new-live');
    expect(mockReached).toHaveBeenCalledWith('stream', 'createLiveInput');
  });
});
