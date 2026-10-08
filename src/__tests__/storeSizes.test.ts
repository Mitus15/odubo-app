import { isSizeOption, sortProductOptions, sortSizes } from '@/lib/store/sizes';

describe('sizes in size order', () => {
  it('puts the Infinity Hoodie in order (Shopify gave M L XL 2XL S)', () => {
    expect(sortSizes(['M', 'L', 'XL', '2XL', 'S'])).toEqual(['S', 'M', 'L', 'XL', '2XL']);
  });

  it('knows the spellings', () => {
    expect(sortSizes(['xxl', 'Extra Small', '3XL', 'medium', 'XXS'])).toEqual(['XXS', 'Extra Small', 'medium', 'xxl', '3XL']);
  });

  it('keeps unknown values after the sizes, in their own order', () => {
    expect(sortSizes(['One Size', 'L', '32', 'S', '30'])).toEqual(['S', 'L', 'One Size', '32', '30']);
  });

  it('sorts only the size option', () => {
    const options = [
      { name: 'Color', values: ['Sand', 'Black'] },
      { name: 'Size', values: ['L', 'S', 'M'] },
    ];
    expect(sortProductOptions(options)).toEqual([
      { name: 'Color', values: ['Sand', 'Black'] },
      { name: 'Size', values: ['S', 'M', 'L'] },
    ]);
  });

  it('tells a size option by its values when the name says nothing', () => {
    expect(isSizeOption('Title', ['L', 'M', 'S'])).toBe(true);
    expect(isSizeOption('Title', ['Default Title'])).toBe(false);
    expect(isSizeOption('Colour', ['Sand', 'Black'])).toBe(false);
  });

  it('is fine with no options', () => {
    expect(sortProductOptions(null)).toEqual([]);
    expect(sortProductOptions(undefined)).toEqual([]);
  });
});
