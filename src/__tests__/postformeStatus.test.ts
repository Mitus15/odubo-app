import { isPostDelivered } from '@/lib/postforme';

describe('isPostDelivered', () => {
  it("counts PostForMe's real end state, processed, as published", () => {
    expect(isPostDelivered('processed')).toBe(true);
  });

  it('still accepts published, should PostForMe ever report it', () => {
    expect(isPostDelivered('published')).toBe(true);
  });

  it('keeps everything short of sent hidden', () => {
    for (const status of ['draft', 'scheduled', 'failed', 'Processed', '', null, undefined]) {
      expect(isPostDelivered(status)).toBe(false);
    }
  });
});
