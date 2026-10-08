/**
 * Sizes in size order.
 *
 * Shopify hands back option values in the order the variants were created, so
 * a product made in a hurry lists M, L, XL, 2XL, S. Every surface that shows a
 * product's options (the grid's product view, QuickShop, the product page)
 * runs them through `sortProductOptions` where the product is mapped, so the
 * order is fixed once, not three times.
 *
 * Known sizes go first, smallest to largest. Anything unknown (a one-size,
 * a number, a colour that landed in a size option) keeps its place after them.
 */

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];

const ALIASES: Record<string, string> = {
  '2XL': 'XXL',
  '2XS': 'XXS',
  XXXL: '3XL',
  XXXXL: '4XL',
  XXXXXL: '5XL',
  SMALL: 'S',
  MEDIUM: 'M',
  LARGE: 'L',
  'EXTRA SMALL': 'XS',
  'EXTRA LARGE': 'XL',
  'X-SMALL': 'XS',
  'X-LARGE': 'XL',
  'XX-LARGE': 'XXL',
  'XX-SMALL': 'XXS',
};

/** Where a size sits in the order, or -1 when it is not a size we know. */
export function sizeRank(value: string): number {
  const key = value.trim().toUpperCase();
  return SIZE_ORDER.indexOf(ALIASES[key] ?? key);
}

/** Does this option hold sizes? By its name, or by its values when the name says nothing. */
export function isSizeOption(name: string, values: string[]): boolean {
  if (/\b(size|taille|größe|talla)\b/i.test(name)) return true;
  const known = values.filter((v) => sizeRank(v) >= 0).length;
  return values.length > 0 && known >= Math.ceil(values.length / 2);
}

/** The values in size order; the unknown ones keep their relative order after the known. Stable. */
export function sortSizes(values: string[]): string[] {
  return values
    .map((value, index) => ({ value, index, rank: sizeRank(value) }))
    .sort((a, b) => {
      if (a.rank >= 0 && b.rank >= 0) return a.rank - b.rank;
      if (a.rank >= 0) return -1;
      if (b.rank >= 0) return 1;
      return a.index - b.index;
    })
    .map((x) => x.value);
}

/** A product's options with every size option sorted; other options untouched. */
export function sortProductOptions<T extends { name: string; values: string[] }>(options: T[] | null | undefined): T[] {
  if (!options) return [];
  return options.map((opt) =>
    Array.isArray(opt.values) && isSizeOption(opt.name, opt.values) ? { ...opt, values: sortSizes(opt.values) } : opt,
  );
}
