/**
 * Tests for the D1-backed distributed rate limiter.
 *
 * This is the throttle in front of login and the Moments upload endpoints, so
 * the cases that matter most are the ones where the database misbehaves: a
 * limiter that fails open under load is the same as no limiter.
 */

const executeQuery = jest.fn();

jest.mock('@/lib/db', () => ({
  executeQuery: (...args: unknown[]) => executeQuery(...args),
}));

type Row = { count: number; reset_at: number };

const found = (row: Row) => ({ result: [{ results: [row] }] });
const notFound = { result: [{ results: [] }] };

/** Route responses by statement so call ordering never makes a test brittle. */
function stubDb(select: unknown) {
  executeQuery.mockImplementation(async (sql: string) => {
    if (/CREATE TABLE|DELETE FROM/.test(sql)) return {};
    if (/^\s*SELECT/.test(sql)) return select;
    return {};
  });
}

/** Fresh module so the in-memory fallback Map never leaks between tests. */
function load() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/rateLimit') as typeof import('@/lib/rateLimit');
}

const sqlCalls = () => executeQuery.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  executeQuery.mockReset();
  // Pin the 10% cleanup dice so no test is order- or luck-dependent.
  jest.spyOn(Math, 'random').mockReturnValue(0.99);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('rateLimit — first request in a window', () => {
  it('allows the request and inserts a new row', async () => {
    stubDb(notFound);
    const { rateLimit } = load();

    const result = await rateLimit({ key: 'ip:1.2.3.4', limit: 5, windowMs: 60_000 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBeGreaterThan(Date.now());
    expect(sqlCalls().some((s) => s.includes('INSERT INTO rate_limits'))).toBe(true);
  });

  it('creates the table before touching it', async () => {
    stubDb(notFound);
    const { rateLimit } = load();

    await rateLimit({ key: 'k', limit: 5, windowMs: 60_000 });

    expect(sqlCalls()[0]).toContain('CREATE TABLE IF NOT EXISTS rate_limits');
  });
});

describe('rateLimit — inside an open window', () => {
  it('increments and reports the remaining budget', async () => {
    const resetAt = Date.now() + 30_000;
    stubDb(found({ count: 2, reset_at: resetAt }));
    const { rateLimit } = load();

    const result = await rateLimit({ key: 'k', limit: 5, windowMs: 60_000 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // 5 - 2 (existing) - 1 (this one)
    expect(result.resetAt).toBe(resetAt);
    expect(sqlCalls().some((s) => s.includes('count = count + 1'))).toBe(true);
  });

  it('allows the request that exactly consumes the budget', async () => {
    const resetAt = Date.now() + 30_000;
    stubDb(found({ count: 4, reset_at: resetAt }));
    const { rateLimit } = load();

    const result = await rateLimit({ key: 'k', limit: 5, windowMs: 60_000 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('denies once the count has reached the limit', async () => {
    const resetAt = Date.now() + 30_000;
    stubDb(found({ count: 5, reset_at: resetAt }));
    const { rateLimit } = load();

    const result = await rateLimit({ key: 'k', limit: 5, windowMs: 60_000 });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBe(resetAt);
  });

  it('does not increment the counter on a denied request', async () => {
    stubDb(found({ count: 9, reset_at: Date.now() + 30_000 }));
    const { rateLimit } = load();

    await rateLimit({ key: 'k', limit: 5, windowMs: 60_000 });

    expect(sqlCalls().some((s) => s.includes('count = count + 1'))).toBe(false);
  });
});

describe('rateLimit — expired window', () => {
  it('resets the counter and allows the request again', async () => {
    stubDb(found({ count: 99, reset_at: Date.now() - 1 }));
    const { rateLimit } = load();

    const result = await rateLimit({ key: 'k', limit: 5, windowMs: 60_000 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(sqlCalls().some((s) => s.includes('SET count = 1'))).toBe(true);
  });
});

describe('rateLimit — database failure', () => {
  it('falls back to the in-memory limiter instead of failing open', async () => {
    executeQuery.mockRejectedValue(new Error('D1 unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { rateLimit } = load();

    const first = await rateLimit({ key: 'ip:9.9.9.9', limit: 2, windowMs: 60_000 });
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
  });

  it('still enforces the limit while the database is down', async () => {
    executeQuery.mockRejectedValue(new Error('D1 unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { rateLimit } = load();
    const req = () => rateLimit({ key: 'ip:9.9.9.9', limit: 2, windowMs: 60_000 });

    expect((await req()).allowed).toBe(true);
    expect((await req()).allowed).toBe(true);
    expect((await req()).allowed).toBe(false); // third request over a limit of 2
  });

  it('keeps separate budgets per key in the fallback', async () => {
    executeQuery.mockRejectedValue(new Error('D1 unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { rateLimit } = load();

    await rateLimit({ key: 'a', limit: 1, windowMs: 60_000 });
    const blockedA = await rateLimit({ key: 'a', limit: 1, windowMs: 60_000 });
    const freshB = await rateLimit({ key: 'b', limit: 1, windowMs: 60_000 });

    expect(blockedA.allowed).toBe(false);
    expect(freshB.allowed).toBe(true);
  });

  it('lets the fallback window expire', async () => {
    executeQuery.mockRejectedValue(new Error('D1 unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { rateLimit } = load();
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now');

    clock.mockReturnValue(now);
    await rateLimit({ key: 'k', limit: 1, windowMs: 1_000 });
    expect((await rateLimit({ key: 'k', limit: 1, windowMs: 1_000 })).allowed).toBe(false);

    clock.mockReturnValue(now + 1_001);
    expect((await rateLimit({ key: 'k', limit: 1, windowMs: 1_000 })).allowed).toBe(true);
  });
});

describe('getRateLimitInfo', () => {
  it('returns the live count for an open window', async () => {
    const resetAt = Date.now() + 30_000;
    stubDb(found({ count: 3, reset_at: resetAt }));
    const { getRateLimitInfo } = load();

    const info = await getRateLimitInfo('k');

    expect(info).toMatchObject({ count: 3, resetAt });
  });

  it('returns null for an unknown key', async () => {
    stubDb(notFound);
    const { getRateLimitInfo } = load();

    expect(await getRateLimitInfo('nope')).toBeNull();
  });

  it('returns null once the window has expired', async () => {
    stubDb(found({ count: 3, reset_at: Date.now() - 1 }));
    const { getRateLimitInfo } = load();

    expect(await getRateLimitInfo('k')).toBeNull();
  });

  it('returns null rather than throwing when the database errors', async () => {
    executeQuery.mockRejectedValue(new Error('D1 unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { getRateLimitInfo } = load();

    expect(await getRateLimitInfo('k')).toBeNull();
  });

  it('BUG: `remaining` is computed against a hardcoded limit of 10', async () => {
    // getRateLimitInfo takes no limit argument and assumes 10, so the number it
    // reports is wrong for every caller whose real limit is not 10 — including
    // the login throttle. Anything surfacing this as an X-RateLimit-Remaining
    // header is lying to the client. Fix: take `limit` as a parameter.
    stubDb(found({ count: 3, reset_at: Date.now() + 30_000 }));
    const { getRateLimitInfo } = load();

    const info = await getRateLimitInfo('k');

    expect(info?.remaining).toBe(7); // 10 - 3, regardless of the caller's limit
  });

  it('does not consume budget — it issues no write', async () => {
    stubDb(found({ count: 3, reset_at: Date.now() + 30_000 }));
    const { getRateLimitInfo } = load();

    await getRateLimitInfo('k');

    expect(sqlCalls().every((s) => /^\s*SELECT/.test(s))).toBe(true);
  });
});
