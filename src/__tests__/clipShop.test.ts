import { shopClickPayload, postShopClick, FUNNEL_ENDPOINT } from '@/lib/clipShop';
import type { Attribution } from '@/lib/attribution';

const attribution: Attribution = {
  source: 'instagram',
  medium: 'social',
  campaign: 'loop-soul',
  content: 'reel-3',
  term: '',
  referrer: 'https://instagram.com/',
  entryClipId: 12,
  landingPage: '/',
  sessionId: 'sess-1',
  timestamp: 1,
};

describe('shop_click payload', () => {
  it('is the shape /api/analytics/funnel accepts: a session, one event, the attribution', () => {
    expect(shopClickPayload(42, 'script-tee', 'sess-1', attribution, 1000)).toEqual({
      sessionId: 'sess-1',
      events: [{ event: 'shop_click', clipId: 42, productHandle: 'script-tee', timestamp: 1000 }],
      attribution: {
        source: 'instagram',
        medium: 'social',
        campaign: 'loop-soul',
        content: 'reel-3',
        referrer: 'https://instagram.com/',
      },
    });
  });

  it('sends a null attribution when none was captured', () => {
    expect(shopClickPayload(42, 'script-tee', 'sess-1', null, 1000).attribution).toBeNull();
  });
});

describe('postShopClick', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('posts the event once, with keepalive, and returns without waiting', () => {
    const fetchMock = jest.fn(() => new Promise<Response>(() => {})); // never settles
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = postShopClick(42, 'script-tee');

    expect(result).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(FUNNEL_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    const body = JSON.parse(String(init.body));
    expect(body.events).toEqual([
      expect.objectContaining({ event: 'shop_click', clipId: 42, productHandle: 'script-tee' }),
    ]);
    expect(typeof body.sessionId).toBe('string');
    expect(body.sessionId.length).toBeGreaterThan(0);
  });

  it('never throws, whether the request rejects or fetch itself blows up', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    expect(() => postShopClick(1, 'tee')).not.toThrow();
    await Promise.resolve(); // let the swallowed rejection settle

    global.fetch = jest.fn(() => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    expect(() => postShopClick(1, 'tee')).not.toThrow();
  });
});
