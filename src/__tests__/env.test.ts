import { getSiteUrl, getEmailEnv, validateEmailEnv } from '@/lib/env';

describe('env helpers', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('getSiteUrl prefers NEXT_PUBLIC_SITE_URL and normalizes protocol', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/';
    expect(getSiteUrl()).toBe('https://example.com');

    process.env.NEXT_PUBLIC_SITE_URL = 'example.com';
    expect(getSiteUrl()).toBe('https://example.com');
  });

  it('validateEmailEnv returns warnings when missing resend key and site', () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const res = validateEmailEnv();
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.values.siteUrl).toMatch(/^https?:\/\//);
    expect(res.values.fromEmail).toBeDefined();
  });

  it('getEmailEnv returns defaults when missing', () => {
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.EMAIL_FROM;
    const env = getEmailEnv();
    expect(env.fromEmail).toMatch(/@/);
  });
});
