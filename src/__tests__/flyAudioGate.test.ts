/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

import {
  FLY_AUDIO_TOKEN_SECONDS,
  decideFlyAudio,
  flyAudioSecret,
  mintFlyAudioToken,
  verifyFlyAudioToken,
  type FlyAudioFacts,
} from '@/lib/fly/audioGate';
import { flyAudioSources } from '@/lib/fly/audioSources';
import { SONGS } from '@/lib/loop/songs';
import { SongAudio, pauseSiteMusic } from '@/components/fly/audio/SongAudio';

/**
 * The game's own door to the album. The owner chose to let all fourteen songs
 * play inside /fly; these lock that it opens ONLY through links the page
 * minted, that the owner's switch can close it again, and that a database
 * that cannot answer closes it rather than opening it.
 */

type Row = Record<string, unknown>;
type PresignOptions = { key: string; operation: string; expiresIn?: number };

const mockQuery = jest.fn<Promise<Row[]>, [string, unknown[] | undefined]>();
const mockMayHear = jest.fn<Promise<boolean>, [unknown, string]>();
const mockPresign = jest.fn<Promise<string>, [PresignOptions]>();

jest.mock('@/lib/db', () => ({
  queryDatabase: (sql: string, params?: unknown[]) => mockQuery(sql, params),
}));
jest.mock('@/lib/loop/audioAccess', () => ({
  mayHearTrackId: (req: unknown, trackId: string) => mockMayHear(req, trackId),
}));
jest.mock('@/lib/storage/StorageService', () => ({
  createStorageService: () => ({ getPresignedUrl: (o: PresignOptions) => mockPresign(o) }),
}));

const SECRET = 'test-fly-secret';
const NOW = Date.UTC(2026, 9, 2, 12, 0, 0);
const env = process.env as Record<string, string | undefined>;
const saved = { fly: env.FLY_AUDIO_SECRET, anthem: env.ANTHEM_VOTE_SECRET, node: env.NODE_ENV };

beforeEach(() => {
  env.FLY_AUDIO_SECRET = SECRET;
  delete env.ANTHEM_VOTE_SECRET;
  env.NODE_ENV = 'test';
  mockQuery.mockReset();
  mockMayHear.mockReset();
  mockPresign.mockReset();
});

afterAll(() => {
  env.FLY_AUDIO_SECRET = saved.fly;
  env.ANTHEM_VOTE_SECRET = saved.anthem;
  env.NODE_ENV = saved.node;
});

// ── the rule ─────────────────────────────────────────────────────────────────

describe('decideFlyAudio', () => {
  const facts = (o: Partial<FlyAudioFacts> = {}): FlyAudioFacts => ({
    known: true,
    tokenOk: true,
    open: true,
    gateAllows: false,
    ...o,
  });

  it('serves a known song with a good link while the switch is open', () => {
    expect(decideFlyAudio(facts())).toBe('serve');
  });

  it('serves a song the site would play anyway while the switch is off', () => {
    expect(decideFlyAudio(facts({ open: false, gateAllows: true }))).toBe('serve');
  });

  it('refuses a gated song while the switch is off', () => {
    expect(decideFlyAudio(facts({ open: false, gateAllows: false }))).toBe('not-found');
  });

  it('refuses an unknown song, even with everything else allowed', () => {
    expect(decideFlyAudio(facts({ known: false, gateAllows: true }))).toBe('not-found');
  });

  it('refuses a bad link, even for a released single', () => {
    expect(decideFlyAudio(facts({ tokenOk: false, gateAllows: true }))).toBe('not-found');
  });

  it('matches the whole truth table', () => {
    for (let bits = 0; bits < 16; bits++) {
      const f: FlyAudioFacts = {
        known: !!(bits & 1),
        tokenOk: !!(bits & 2),
        open: !!(bits & 4),
        gateAllows: !!(bits & 8),
      };
      const serve = f.known && f.tokenOk && (f.open || f.gateAllows);
      expect(decideFlyAudio(f)).toBe(serve ? 'serve' : 'not-found');
    }
  });
});

// ── links ────────────────────────────────────────────────────────────────────

describe('fly audio links', () => {
  it('verifies a link it minted, until six hours have passed', async () => {
    const token = await mintFlyAudioToken('1984', NOW, SECRET);
    expect(token).toMatch(/^\d+\.[A-Za-z0-9_-]{43}$/);
    expect(Number(token.split('.')[0])).toBe(Math.floor(NOW / 1000) + FLY_AUDIO_TOKEN_SECONDS);
    expect(await verifyFlyAudioToken('1984', token, NOW, SECRET)).toBe(true);
    expect(await verifyFlyAudioToken('1984', token, NOW + (FLY_AUDIO_TOKEN_SECONDS - 1) * 1000, SECRET)).toBe(true);
  });

  it('rejects an expired link', async () => {
    const token = await mintFlyAudioToken('1984', NOW, SECRET);
    expect(await verifyFlyAudioToken('1984', token, NOW + FLY_AUDIO_TOKEN_SECONDS * 1000, SECRET)).toBe(false);
    expect(await verifyFlyAudioToken('1984', token, NOW + 7 * 3600 * 1000, SECRET)).toBe(false);
  });

  it('rejects a tampered signature', async () => {
    const token = await mintFlyAudioToken('1984', NOW, SECRET);
    const last = token.slice(-1);
    const forged = token.slice(0, -1) + (last === 'A' ? 'B' : 'A');
    expect(await verifyFlyAudioToken('1984', forged, NOW, SECRET)).toBe(false);
  });

  it('rejects a tampered expiry', async () => {
    const token = await mintFlyAudioToken('1984', NOW, SECRET);
    const [exp, sig] = token.split('.');
    expect(await verifyFlyAudioToken('1984', `${Number(exp) + 3600}.${sig}`, NOW, SECRET)).toBe(false);
    expect(await verifyFlyAudioToken('1984', `${Number(exp) - 1}.${sig}`, NOW, SECRET)).toBe(false);
  });

  it('rejects a link moved to another song', async () => {
    const token = await mintFlyAudioToken('1984', NOW, SECRET);
    expect(await verifyFlyAudioToken('ghost-world', token, NOW, SECRET)).toBe(false);
  });

  it('rejects a link signed with another secret', async () => {
    const token = await mintFlyAudioToken('1984', NOW, 'someone-else');
    expect(await verifyFlyAudioToken('1984', token, NOW, SECRET)).toBe(false);
  });

  it('rejects a link from further ahead than the page ever mints', async () => {
    const token = await mintFlyAudioToken('1984', NOW + 24 * 3600 * 1000, SECRET);
    expect(await verifyFlyAudioToken('1984', token, NOW, SECRET)).toBe(false);
  });

  it('rejects garbage', async () => {
    const good = await mintFlyAudioToken('1984', NOW, SECRET);
    const sig = good.split('.')[1];
    const garbage = [
      '',
      'abc',
      '.',
      `.${sig}`,
      `${good.split('.')[0]}.`,
      `abc.${sig}`,
      `-1.${sig}`,
      `${good}.x`,
      `${good}=`,
      good.replace('.', ':'),
      ' '.repeat(50),
    ];
    for (const token of garbage) {
      expect(await verifyFlyAudioToken('1984', token, NOW, SECRET)).toBe(false);
    }
    expect(await verifyFlyAudioToken('1984', null, NOW, SECRET)).toBe(false);
    expect(await verifyFlyAudioToken('1984', undefined, NOW, SECRET)).toBe(false);
  });

  it('verifies nothing without a secret, and mints nothing either', async () => {
    const token = await mintFlyAudioToken('1984', NOW, SECRET);
    expect(await verifyFlyAudioToken('1984', token, NOW, null)).toBe(false);
    expect(await verifyFlyAudioToken('1984', token, NOW, '')).toBe(false);
    await expect(mintFlyAudioToken('1984', NOW, '')).rejects.toThrow();
  });
});

describe('flyAudioSecret', () => {
  it('prefers FLY_AUDIO_SECRET', () => {
    expect(flyAudioSecret({ FLY_AUDIO_SECRET: 'fly', ANTHEM_VOTE_SECRET: 'anthem', NODE_ENV: 'production' })).toBe('fly');
  });

  it('falls back to ANTHEM_VOTE_SECRET', () => {
    expect(flyAudioSecret({ ANTHEM_VOTE_SECRET: 'anthem', NODE_ENV: 'production' })).toBe('anthem');
    expect(flyAudioSecret({ FLY_AUDIO_SECRET: '   ', ANTHEM_VOTE_SECRET: 'anthem', NODE_ENV: 'production' })).toBe(
      'anthem',
    );
  });

  it('fails closed in production with neither', () => {
    expect(flyAudioSecret({ NODE_ENV: 'production' })).toBeNull();
    expect(flyAudioSecret({ NODE_ENV: 'production', FLY_AUDIO_SECRET: '', ANTHEM_VOTE_SECRET: ' ' })).toBeNull();
  });

  it('uses a fixed dev key off production', () => {
    const dev = flyAudioSecret({ NODE_ENV: 'development' });
    expect(dev).toBeTruthy();
    expect(flyAudioSecret({ NODE_ENV: 'test' })).toBe(dev);
  });

  it('reads the real environment by default', () => {
    expect(flyAudioSecret()).toBe(SECRET);
  });
});

describe('flyAudioSources', () => {
  it('hands the page a working link for every one of the fourteen songs', async () => {
    const sources = await flyAudioSources(NOW);
    expect(Object.keys(sources).sort()).toEqual(SONGS.map((s) => s.slug).sort());
    expect(Object.keys(sources)).toHaveLength(14);
    for (const song of SONGS) {
      const link = new URL(sources[song.slug], 'https://odubo.test');
      expect(link.pathname).toBe(`/api/game/fly/audio/${song.slug}`);
      expect(await verifyFlyAudioToken(song.slug, link.searchParams.get('k'), NOW, SECRET)).toBe(true);
    }
  });

  it('hands out nothing in production without a secret', async () => {
    delete env.FLY_AUDIO_SECRET;
    env.NODE_ENV = 'production';
    expect(await flyAudioSources(NOW)).toEqual({});
  });
});

// ── the route ────────────────────────────────────────────────────────────────

type RouteModule = typeof import('@/app/api/game/fly/audio/[slug]/route');

/** A fresh copy of the route each time, so the switch cache starts empty. */
function freshRoute(): RouteModule {
  let mod: RouteModule | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual<RouteModule>('@/app/api/game/fly/audio/[slug]/route');
  });
  if (!mod) throw new Error('route did not load');
  return mod;
}

const ORIGIN = 'https://odubo.test';
const SINGLE = SONGS.find((s) => s.slug === '1984');
if (!SINGLE) throw new Error('songs.json lost 1984');
const PRESIGNED = 'https://r2.example/music/1984.m4a?X-Amz-Signature=abc';

async function call(route: RouteModule, slug: string, token: string | null): Promise<Response> {
  const query = token === null ? '' : `?k=${encodeURIComponent(token)}`;
  const req = new NextRequest(`${ORIGIN}/api/game/fly/audio/${slug}${query}`);
  return route.GET(req, { params: Promise.resolve({ slug }) });
}

/** A database with the switch row (or none, or broken) and one track. */
function database(opts: { switchValue?: string | null | Error; audioUrl?: string | null; noTrack?: boolean }): void {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('loop_settings')) {
      if (opts.switchValue instanceof Error) throw opts.switchValue;
      return opts.switchValue === undefined ? [] : [{ value: opts.switchValue }];
    }
    if (sql.includes('FROM tracks')) {
      if (opts.noTrack) return [];
      return [{ audio_url: opts.audioUrl === undefined ? '/api/media/audio/music/1984.m4a' : opts.audioUrl }];
    }
    throw new Error(`unexpected query: ${sql}`);
  });
}

const switchReads = (): number => mockQuery.mock.calls.filter(([sql]) => sql.includes('loop_settings')).length;

describe('GET /api/game/fly/audio/[slug]', () => {
  beforeEach(() => {
    mockPresign.mockResolvedValue(PRESIGNED);
  });

  it('declares itself dynamic on the node runtime', () => {
    const route = freshRoute();
    expect(route.runtime).toBe('nodejs');
    expect(route.dynamic).toBe('force-dynamic');
  });

  it('refuses an unknown slug without touching the database', async () => {
    database({});
    const route = freshRoute();
    const token = await mintFlyAudioToken('not-a-song', Date.now(), SECRET);
    const res = await call(route, 'not-a-song', token);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockPresign).not.toHaveBeenCalled();
  });

  it('refuses a slug that only looks like a song', async () => {
    database({});
    const route = freshRoute();
    const token = await mintFlyAudioToken('Welcome', Date.now(), SECRET);
    expect((await call(route, 'Welcome', token)).status).toBe(404);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('refuses a bad, missing or borrowed link without touching the database', async () => {
    database({});
    const route = freshRoute();
    const borrowed = await mintFlyAudioToken('ghost-world', Date.now(), SECRET);
    const expired = await mintFlyAudioToken('1984', Date.now() - 7 * 3600 * 1000, SECRET);
    for (const token of [null, '', 'garbage', borrowed, expired]) {
      const res = await call(route, '1984', token);
      expect(res.status).toBe(404);
    }
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockMayHear).not.toHaveBeenCalled();
  });

  it('fails closed in production without a secret', async () => {
    database({});
    const token = await mintFlyAudioToken('1984', Date.now(), flyAudioSecret({ NODE_ENV: 'development' }) ?? 'x');
    delete env.FLY_AUDIO_SECRET;
    env.NODE_ENV = 'production';
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const route = freshRoute();
    const res = await call(route, '1984', token);
    spy.mockRestore();
    expect(res.status).toBe(404);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('no switch row: every song is open, and it never asks the site gate', async () => {
    database({});
    const route = freshRoute();
    const res = await call(route, '1984', await mintFlyAudioToken('1984', Date.now(), SECRET));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(PRESIGNED);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(mockMayHear).not.toHaveBeenCalled();
    expect(mockPresign).toHaveBeenCalledWith({ key: 'music/1984.m4a', operation: 'get', expiresIn: 3600 });
  });

  it("any value but 'off' leaves it open", async () => {
    database({ switchValue: 'on' });
    const route = freshRoute();
    const res = await call(route, '1984', await mintFlyAudioToken('1984', Date.now(), SECRET));
    expect(res.status).toBe(302);
    expect(mockMayHear).not.toHaveBeenCalled();
  });

  it("'off': only what the site's own rule allows still plays", async () => {
    database({ switchValue: 'off' });
    const route = freshRoute();
    const token = await mintFlyAudioToken('1984', Date.now(), SECRET);

    mockMayHear.mockResolvedValueOnce(false);
    const refused = await call(route, '1984', token);
    expect(refused.status).toBe(404);
    expect(mockPresign).not.toHaveBeenCalled();

    mockMayHear.mockResolvedValueOnce(true);
    const single = await call(route, '1984', token);
    expect(single.status).toBe(302);
    expect(mockMayHear).toHaveBeenLastCalledWith(expect.anything(), SINGLE.trackId);
  });

  it("'off' is read loosely, so a closed switch is never misread as open", async () => {
    database({ switchValue: ' OFF ' });
    mockMayHear.mockResolvedValue(false);
    const route = freshRoute();
    expect((await call(route, '1984', await mintFlyAudioToken('1984', Date.now(), SECRET))).status).toBe(404);
    expect(mockMayHear).toHaveBeenCalled();
  });

  it('a database that cannot answer means gated', async () => {
    database({ switchValue: new Error('D1 is down') });
    const route = freshRoute();
    const token = await mintFlyAudioToken('1984', Date.now(), SECRET);

    mockMayHear.mockResolvedValueOnce(false);
    expect((await call(route, '1984', token)).status).toBe(404);

    mockMayHear.mockResolvedValueOnce(true);
    expect((await call(route, '1984', token)).status).toBe(302);
  });

  it('a site gate that throws refuses', async () => {
    database({ switchValue: 'off' });
    mockMayHear.mockRejectedValue(new Error('D1 is down'));
    const route = freshRoute();
    expect((await call(route, '1984', await mintFlyAudioToken('1984', Date.now(), SECRET))).status).toBe(404);
  });

  it('reads the switch once a minute, not once a request', async () => {
    database({});
    const route = freshRoute();
    const token = await mintFlyAudioToken('1984', Date.now(), SECRET);
    await call(route, '1984', token);
    await call(route, '1984', token);
    await call(route, '1984', token);
    expect(switchReads()).toBe(1);
  });

  it('finds the R2 key the way the media route does', async () => {
    const cases: [string, string][] = [
      ['/api/media/audio/music/1984.m4a', 'music/1984.m4a'],
      ['https://media.odubo.studio/music/loop/1984.web.m4a', 'music/loop/1984.web.m4a'],
      ['/api/media/audio/warehouse/2026/My%20Song.wav', 'warehouse/2026/My Song.wav'],
      [`${ORIGIN}/api/media/audio/music/abs.mp3`, 'music/abs.mp3'],
    ];
    for (const [audioUrl, key] of cases) {
      mockPresign.mockClear();
      database({ audioUrl });
      const route = freshRoute();
      const res = await call(route, '1984', await mintFlyAudioToken('1984', Date.now(), SECRET));
      expect(res.status).toBe(302);
      expect(mockPresign).toHaveBeenCalledWith({ key, operation: 'get', expiresIn: 3600 });
    }
  });

  it('refuses a track with nothing servable behind it', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const bad: (string | null)[] = [
      null,
      '',
      'warehouse:abc123',
      'https://cdn.elsewhere.example/1984.mp3',
      'https://elsewhere.example/api/media/audio/music/1984.mp3',
      '/api/media/audio/secrets/keys.txt',
      '/api/media/audio/music/../secrets/keys.txt',
      '/audio/1984.mp3',
    ];
    for (const audioUrl of bad) {
      mockPresign.mockClear();
      database({ audioUrl });
      const route = freshRoute();
      const res = await call(route, '1984', await mintFlyAudioToken('1984', Date.now(), SECRET));
      expect(res.status).toBe(404);
      expect(mockPresign).not.toHaveBeenCalled();
    }
    database({ noTrack: true });
    const route = freshRoute();
    expect((await call(route, '1984', await mintFlyAudioToken('1984', Date.now(), SECRET))).status).toBe(404);
    warn.mockRestore();
  });

  it('a presign that fails is a plain 404', async () => {
    database({});
    mockPresign.mockRejectedValue(new Error('no R2 credentials'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const route = freshRoute();
    const res = await call(route, '1984', await mintFlyAudioToken('1984', Date.now(), SECRET));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
    spy.mockRestore();
  });

  it('never logs the link', async () => {
    database({});
    mockPresign.mockRejectedValue(new Error('boom'));
    const token = await mintFlyAudioToken('1984', Date.now(), SECRET);
    const logged: unknown[][] = [];
    const spies = (['log', 'warn', 'error', 'info'] as const).map((level) =>
      jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      }),
    );
    const route = freshRoute();
    await call(route, '1984', token);
    await call(route, '1984', 'garbage');
    spies.forEach((spy) => spy.mockRestore());
    expect(JSON.stringify(logged)).not.toContain(token.split('.')[1]);
  });
});

// ── the song clock ───────────────────────────────────────────────────────────

/** Just enough of an audio element for SongAudio, driven by hand. */
class FakeAudio {
  src = '';
  preload = '';
  currentTime = 0;
  paused = true;
  ended = false;
  seeking = false;
  readyState = 0;
  playbackRate = 1;
  volume = 1;
  duration = Number.NaN;
  plays = 0;
  refuse: string | null = null;
  private listeners = new Map<string, Set<() => void>>();

  play(): Promise<void> {
    this.plays++;
    if (this.refuse) return Promise.reject(Object.assign(new Error('refused'), { name: this.refuse }));
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  load(): void {}
  removeAttribute(name: string): void {
    if (name === 'src') this.src = '';
  }
  addEventListener(type: string, fn: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(fn);
  }
  removeEventListener(type: string, fn: () => void): void {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type: string): void {
    this.listeners.get(type)?.forEach((fn) => fn());
  }
  /** Loaded, playing, at t seconds. */
  flowing(t: number): void {
    this.readyState = 4;
    this.currentTime = t;
  }
}

function rig(onEnded?: () => void): { audio: SongAudio; els: FakeAudio[]; clock: { t: number } } {
  const els: FakeAudio[] = [];
  const clock = { t: 1000 };
  const audio = new SongAudio({
    onEnded,
    now: () => clock.t,
    createElement: () => {
      const el = new FakeAudio();
      els.push(el);
      return el as unknown as HTMLAudioElement;
    },
  });
  return { audio, els, clock };
}

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('SongAudio', () => {
  it('extrapolates between reports and re-anchors on drift', () => {
    const { audio, els, clock } = rig();
    audio.play('/song');
    const el = els[0];
    expect(el.plays).toBe(1);
    el.flowing(0);
    expect(audio.clock()).toBe(0);

    clock.t += 100;
    el.currentTime = 0.09;
    expect(audio.clock()).toBeCloseTo(0.1, 6);

    clock.t += 100;
    el.currentTime = 0.3;
    expect(audio.clock()).toBeCloseTo(0.3, 6);
    audio.destroy();
  });

  it('freezes while the song buffers, and the fall waits', () => {
    const { audio, els, clock } = rig();
    audio.play('/song');
    const el = els[0];
    el.flowing(10);
    expect(audio.clock()).toBe(10);
    el.readyState = 2;
    clock.t += 2000;
    expect(audio.clock()).toBe(10);
    el.readyState = 4;
    clock.t += 100;
    el.currentTime = 10.1;
    expect(audio.clock()).toBeCloseTo(10.1, 6);
    audio.destroy();
  });

  it('freezes while paused and runs on after resume', () => {
    const { audio, els, clock } = rig();
    audio.play('/song');
    const el = els[0];
    el.flowing(5);
    audio.clock();
    audio.pause();
    expect(el.paused).toBe(true);
    clock.t += 3000;
    expect(audio.clock()).toBe(5);
    audio.resume();
    expect(el.paused).toBe(false);
    clock.t += 100;
    el.currentTime = 5.1;
    expect(audio.clock()).toBeCloseTo(5.1, 6);
    audio.destroy();
  });

  it('starts where asked, and holds there until the element can say', () => {
    const { audio, els, clock } = rig();
    audio.play('/song', 30);
    clock.t += 5000;
    expect(audio.clock()).toBe(30);
    els[0].emit('loadedmetadata');
    expect(els[0].currentTime).toBe(30);
    audio.destroy();
  });

  it('never steps back for a small correction', () => {
    const { audio, els, clock } = rig();
    audio.play('/song');
    const el = els[0];
    el.flowing(1);
    audio.clock();
    clock.t += 100;
    el.currentTime = 1.06;
    expect(audio.clock()).toBeCloseTo(1.1, 6);
    clock.t += 1;
    el.currentTime = 1.04;
    expect(audio.clock()).toBeCloseTo(1.1, 6);
    audio.destroy();
  });

  it('plays on a silent clock with no link, and ends on time', () => {
    jest.useFakeTimers();
    const ended = jest.fn();
    const { audio, els, clock } = rig(ended);
    audio.play(null, 0, 10);
    expect(audio.audible).toBe(false);
    expect(els[0].plays).toBe(0);
    clock.t += 2500;
    expect(audio.clock()).toBeCloseTo(2.5, 6);
    audio.pause();
    clock.t += 5000;
    expect(audio.clock()).toBeCloseTo(2.5, 6);
    audio.resume();
    clock.t += 20_000;
    expect(audio.clock()).toBe(10);
    jest.advanceTimersByTime(7500);
    expect(ended).toHaveBeenCalledTimes(1);
    audio.destroy();
    jest.useRealTimers();
  });

  it('asks once more after an error, then plays on silently from where it was', () => {
    const { audio, els, clock } = rig();
    audio.play('/api/game/fly/audio/1984?k=t');
    const el = els[0];
    el.flowing(5);
    audio.clock();

    el.readyState = 0;
    el.emit('error');
    expect(el.src).toBe('/api/game/fly/audio/1984?k=t&r=1');
    clock.t += 1000;
    expect(audio.clock()).toBe(5);
    expect(audio.audible).toBe(true);

    el.emit('error');
    expect(audio.audible).toBe(false);
    clock.t += 1000;
    expect(audio.clock()).toBeCloseTo(6, 6);
    audio.destroy();
  });

  it('plays on silently when the browser refuses, and tries again on resume', async () => {
    const { audio, els, clock } = rig();
    els[0].refuse = 'NotAllowedError';
    audio.play('/song');
    await flush();
    expect(audio.audible).toBe(false);
    clock.t += 1000;
    expect(audio.clock()).toBeCloseTo(1, 6);
    audio.pause();
    els[0].refuse = null;
    audio.resume();
    expect(audio.audible).toBe(true);
    expect(els[0].paused).toBe(false);
    audio.destroy();
  });

  it('calls onEnded once when the song ends', () => {
    const ended = jest.fn();
    const { audio, els } = rig(ended);
    audio.play('/song');
    els[0].ended = true;
    els[0].emit('ended');
    els[0].emit('ended');
    expect(ended).toHaveBeenCalledTimes(1);
    audio.destroy();
  });

  it('finishes a file that runs short of the level in silence, then ends', () => {
    jest.useFakeTimers();
    const ended = jest.fn();
    const { audio, els, clock } = rig(ended);
    audio.play('/ghost-world', 286, 287);
    const el = els[0];
    el.flowing(286.5);
    audio.clock();
    el.currentTime = 286.59;
    el.ended = true;
    el.emit('ended');
    expect(ended).not.toHaveBeenCalled();
    expect(audio.audible).toBe(true);
    clock.t += 300;
    expect(audio.clock()).toBeCloseTo(286.89, 6);
    clock.t += 1000;
    expect(audio.clock()).toBe(287);
    jest.advanceTimersByTime(410);
    expect(ended).toHaveBeenCalledTimes(1);
    audio.destroy();
    jest.useRealTimers();
  });

  it('chains the album: preload in B, swap starts it from zero', () => {
    const { audio, els, clock } = rig();
    audio.play('/one');
    els[0].flowing(100);
    audio.clock();
    audio.preload('/two', 200);
    expect(els[1].src).toBe('/two');
    expect(els[1].plays).toBe(0);
    expect(audio.swap()).toBe(true);
    expect(els[0].paused).toBe(true);
    expect(els[1].plays).toBe(1);
    clock.t += 50;
    expect(audio.clock()).toBe(0);
    expect(audio.swap()).toBe(false);
    audio.destroy();
  });

  it('play() of the song already loading next door swaps rather than loads twice', () => {
    const { audio, els } = rig();
    audio.play('/one');
    audio.preload('/two');
    audio.play('/two');
    expect(els[1].plays).toBe(1);
    expect(els[0].src).toBe('/one');
    audio.destroy();
  });

  it('unlock plays silence on both elements without disturbing the song', async () => {
    const { audio, els } = rig();
    audio.unlock();
    expect(els[0].src.startsWith('data:audio/wav')).toBe(true);
    expect(els[1].src.startsWith('data:audio/wav')).toBe(true);
    audio.play('/song');
    await flush();
    expect(els[0].src).toBe('/song');
    expect(els[0].paused).toBe(false);
    expect(els[1].paused).toBe(true);
    audio.destroy();
  });

  it('fades, then pauses and puts the volume back', async () => {
    jest.useFakeTimers();
    const { audio, els, clock } = rig();
    audio.play('/song');
    els[0].flowing(0);
    const done = audio.fadeOut(100);
    clock.t += 50;
    jest.advanceTimersByTime(16);
    expect(els[0].volume).toBeCloseTo(0.5, 6);
    clock.t += 60;
    jest.advanceTimersByTime(16);
    await done;
    expect(els[0].paused).toBe(true);
    expect(els[0].volume).toBe(1);
    audio.destroy();
    jest.useRealTimers();
  });
});

describe('pauseSiteMusic', () => {
  it('stops the site player only while it plays, and only once per state', () => {
    const togglePlayPause = jest.fn();
    const playing = { state: { isPlaying: true }, togglePlayPause };
    expect(pauseSiteMusic(playing)).toBe(true);
    expect(pauseSiteMusic(playing)).toBe(false);
    expect(togglePlayPause).toHaveBeenCalledTimes(1);

    expect(pauseSiteMusic({ state: { isPlaying: false }, togglePlayPause })).toBe(false);
    expect(pauseSiteMusic(null)).toBe(false);
    expect(togglePlayPause).toHaveBeenCalledTimes(1);
  });
});

describe('SongAudio, when the song misbehaves', () => {
  it('goes on silently when the element says it plays but never moves', () => {
    const { audio, els, clock } = rig();
    audio.play('/song', 0, 120);
    const el = els[0];
    el.flowing(5);
    expect(audio.clock()).toBe(5);
    // Stuck at 5 s with data and no pause: after the watch runs out, the clock moves on.
    for (let i = 0; i < 30; i++) {
      clock.t += 100;
      audio.clock();
    }
    expect(audio.audible).toBe(false);
    clock.t += 1000;
    expect(audio.clock()).toBeGreaterThan(5.9);
    audio.destroy();
  });

  it('never calls a paused or buffering song stuck', () => {
    const { audio, els, clock } = rig();
    audio.play('/song', 0, 120);
    const el = els[0];
    el.flowing(5);
    audio.clock();
    audio.pause();
    clock.t += 10_000;
    audio.clock();
    audio.resume();
    el.flowing(5);
    clock.t += 100;
    audio.clock();
    expect(audio.audible).toBe(true);
    el.readyState = 2;
    clock.t += 10_000;
    audio.clock();
    expect(audio.audible).toBe(true);
    audio.destroy();
  });

  it('gives up on a song that buffers for good, and the fall goes on in silence', () => {
    const { audio, els, clock } = rig();
    audio.play('/song', 40, 120);
    const el = els[0];
    el.readyState = 1;
    el.seeking = true;
    expect(audio.clock()).toBe(40);
    clock.t += 6000;
    expect(audio.clock()).toBe(40);
    expect(audio.audible).toBe(true);
    clock.t += 7000;
    audio.clock();
    expect(audio.audible).toBe(false);
    clock.t += 2000;
    expect(audio.clock()).toBeCloseTo(42, 3);
    audio.destroy();
  });

  it('finishes the song in silence when the file ends a few milliseconds short', () => {
    const onEnded = jest.fn();
    const { audio, els, clock } = rig(onEnded);
    audio.play('/song', 0, 30);
    const el = els[0];
    el.flowing(29.97);
    audio.clock();
    el.ended = true;
    el.emit('ended');
    expect(onEnded).not.toHaveBeenCalled();
    clock.t += 1000;
    expect(audio.clock()).toBe(30);
    audio.destroy();
  });

  it('tells the game when the phone pauses the song, but not when the game does', () => {
    const onInterrupted = jest.fn();
    const { audio, els } = rig();
    audio.onInterrupted = onInterrupted;
    audio.play('/song', 0, 120);
    const el = els[0];
    el.flowing(3);
    // The game's own pause: held, so not an interruption.
    audio.pause();
    el.emit('pause');
    expect(onInterrupted).not.toHaveBeenCalled();
    audio.resume();
    // Headphones out: the element pauses itself.
    el.paused = true;
    el.emit('pause');
    expect(onInterrupted).toHaveBeenCalledTimes(1);
    audio.destroy();
  });
});
