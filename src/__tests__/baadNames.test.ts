import { STORE_BYLINE, STORE_FULL_NAME, brandLockup, labelCredit, labelLockup } from '@/lib/store/brands';

// B.A.A.D's names (owner, 2026-10-26; the Odubo Brand Kit): the name, what it
// makes, who it comes from, used by the moment.
describe("B.A.A.D's names", () => {
  it('meets a stranger as the full lockup: the full name, the signature on its own line', () => {
    expect(labelLockup('B.A.A.D')).toEqual({ name: 'B.A.A.D Creative Wear', signature: 'by Odubo' });
    expect(STORE_FULL_NAME).toBe('B.A.A.D Creative Wear');
  });

  it('is signed by the house in one line where the house is speaking', () => {
    expect(brandLockup('B.A.A.D')).toBe('B.A.A.D by Odubo');
    expect(STORE_BYLINE).toBe('B.A.A.D by Odubo');
  });

  it('never runs all three parts on one line', () => {
    expect(STORE_FULL_NAME).not.toMatch(/by Odubo/);
    expect(STORE_BYLINE).not.toMatch(/Creative Wear/);
  });

  it("says the house's own products once", () => {
    expect(labelLockup('Odubo Studio')).toEqual({ name: 'Odubo Studio' });
    expect(brandLockup('Odubo Studio')).toBe('Odubo Studio');
    expect(labelLockup('')).toEqual({ name: 'Odubo Studio' });
  });

  it('signs with the house and credits the person: Designed by Mani Odubo, never in the lockup', () => {
    expect(labelCredit('B.A.A.D')).toBe('Designed by Mani Odubo');
    expect(labelLockup('B.A.A.D').signature).toBe('by Odubo');
    expect(STORE_FULL_NAME).not.toMatch(/Mani/);
    expect(labelCredit('Odubo Studio')).toBeNull();
  });
});
