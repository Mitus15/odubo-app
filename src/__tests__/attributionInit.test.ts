import { initAttribution } from '@/lib/attribution';

const setUrl = (path: string) => window.history.replaceState({}, '', path);

describe('a visit takes its own source', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(document, 'referrer', { value: '', configurable: true });
  });

  it('a returning visitor from a TikTok bio link counts as TikTok, not their first-ever source', () => {
    setUrl('/');
    initAttribution(); // first ever visit: direct, stored for later
    sessionStorage.clear(); // a new visit
    setUrl('/links?utm_source=tiktok&utm_medium=social&utm_campaign=bio');
    const attr = initAttribution();
    expect(attr.source).toBe('tiktok');
    expect(attr.campaign).toBe('bio');
  });

  it('a visit with no source of its own keeps the stored one', () => {
    setUrl('/links?utm_source=instagram&utm_medium=social');
    initAttribution();
    sessionStorage.clear();
    setUrl('/');
    expect(initAttribution().source).toBe('instagram');
  });

  it('within a visit the first page decides', () => {
    setUrl('/links?utm_source=youtube&utm_medium=social');
    initAttribution();
    setUrl('/store?utm_source=tiktok');
    expect(initAttribution().source).toBe('youtube');
  });
});
