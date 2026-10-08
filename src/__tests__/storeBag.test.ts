import { BAG_KEY, LEGACY_BAG_KEY, mergeBags, parseBag, parseLegacyBag, readBag } from '@/lib/store/bag';
import type { CartItem } from '@/lib/store/types';

const item = (variantId: string, quantity = 1, extra: Partial<CartItem> = {}): CartItem => ({
  variantId,
  productHandle: 'infinity-hoodie',
  title: 'Infinity Hoodie',
  variantTitle: 'M',
  price: 95,
  currency: 'CAD',
  quantity,
  image: null,
  ...extra,
});

describe('one bag', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads the old key as bag items: "Product — Variant", qty, a URL for the image', () => {
    const legacy = JSON.stringify([
      { variantId: 'gid://v/1', qty: 2, title: 'Infinity Hoodie — M', price: 95, currency: 'CAD', image: 'https://cdn/x.jpg' },
      { variantId: 'gid://v/2', qty: 0, title: 'Gone', price: 1 },
      { nonsense: true },
    ]);
    expect(parseLegacyBag(legacy)).toEqual([
      {
        variantId: 'gid://v/1',
        productHandle: '',
        title: 'Infinity Hoodie',
        variantTitle: 'M',
        price: 95,
        currency: 'CAD',
        quantity: 2,
        image: { url: 'https://cdn/x.jpg' },
      },
    ]);
  });

  it('adds the quantities of the same variant and keeps the first bag\'s order', () => {
    expect(mergeBags([item('a', 1), item('b', 1)], [item('b', 2), item('c', 1)])).toEqual([
      item('a', 1),
      item('b', 3),
      item('c', 1),
    ]);
  });

  it('folds the old key into the bag once, and removes it', () => {
    localStorage.setItem(BAG_KEY, JSON.stringify([item('a', 1)]));
    localStorage.setItem(LEGACY_BAG_KEY, JSON.stringify([{ variantId: 'a', qty: 1, title: 'Infinity Hoodie — M', price: 95 }]));
    expect(readBag().map((i) => [i.variantId, i.quantity])).toEqual([['a', 2]]);
    expect(localStorage.getItem(LEGACY_BAG_KEY)).toBeNull();
    expect(parseBag(localStorage.getItem(BAG_KEY)).map((i) => i.quantity)).toEqual([2]);
    // a second read must not add it again
    expect(readBag().map((i) => i.quantity)).toEqual([2]);
  });

  it('is an empty bag when storage holds rubbish', () => {
    expect(parseBag('not json')).toEqual([]);
    expect(parseBag(JSON.stringify({ a: 1 }))).toEqual([]);
    expect(parseLegacyBag('[1,2')).toEqual([]);
  });
});
