import { getMeasurementId } from '@/components/analytics/GoogleAnalytics';

describe('getMeasurementId', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('trims the trailing newline production carried', () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-LVK9T2DDGZ\n';
    expect(getMeasurementId()).toBe('G-LVK9T2DDGZ');
  });

  it('returns null when the ID is missing', () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    expect(getMeasurementId()).toBeNull();
  });

  it('returns null for anything that is not a GA4 ID, so nothing unsafe reaches the inline script', () => {
    for (const bad of ['', 'UA-12345-1', "G-ABC'); alert(1); ('", 'G-ABC\nDEF']) {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = bad;
      expect(getMeasurementId()).toBeNull();
    }
  });
});
