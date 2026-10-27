import { MOVED_PRODUCTS, movedFrom, movedTo } from '@/lib/store/movedProducts';

describe('a renamed product keeps its old link', () => {
  it('forwards the Faceless Hoodie to the Portrait Hoodie', () => {
    expect(movedTo('faceless-hoodie')).toBe('portrait-hoodie');
    expect(movedFrom('portrait-hoodie')).toBe('faceless-hoodie');
  });

  it('leaves every other address alone', () => {
    expect(movedTo('infinity-hoodie')).toBeNull();
    expect(movedFrom('infinity-hoodie')).toBeNull();
  });

  it('never forwards in a loop', () => {
    for (const [from, to] of Object.entries(MOVED_PRODUCTS)) {
      expect(movedTo(to)).toBeNull();
      expect(from).not.toBe(to);
    }
  });
});
