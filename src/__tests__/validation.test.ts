import { normalizeEmail, isValidEmail } from '@/lib/validation';

describe('validation helpers', () => {
  it('normalizeEmail trims and lowercases', () => {
    expect(normalizeEmail('  Foo@Bar.Com  ')).toBe('foo@bar.com');
  });

  it('isValidEmail detects basic validity', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('bad email')).toBe(false);
    expect(isValidEmail('foo@bar')).toBe(false);
  });
});
