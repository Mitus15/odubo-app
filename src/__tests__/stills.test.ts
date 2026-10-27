/**
 * A copy's still in the video's colour (lib/stills): Stream's thumbnails use
 * the SD formula on an HD copy, and the correction turns them back.
 */
import { isStreamUid, STILL_CORRECTION, stillUrl } from '@/lib/stills';
import { altOf } from '@/components/room/PieceOnFloor';

const apply = (rgb: [number, number, number]) =>
  STILL_CORRECTION.map((row) => Math.round(row.reduce((sum, v, k) => sum + v * rgb[k], 0)));

describe('STILL_CORRECTION', () => {
  it("brings Billie Jean's still field to the playing video's (#f291a2)", () => {
    const [r, g, b] = apply([0xea, 0x85, 0xa3]);
    expect(Math.abs(r - 0xf2)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - 0x91)).toBeLessThanOrEqual(1);
    expect(Math.abs(b - 0xa2)).toBeLessThanOrEqual(2);
  });

  it('leaves greys grey: black, white and the ink keep their place', () => {
    expect(apply([0, 0, 0])).toEqual([0, 0, 0]);
    expect(apply([255, 255, 255])).toEqual([255, 255, 255]);
    expect(apply([128, 128, 128])).toEqual([128, 128, 128]);
  });
});

describe('stillUrl', () => {
  it("is the site's own address, at the height asked", () => {
    expect(stillUrl('4f42f869145d335630767372e943f8c3')).toBe('/stills/4f42f869145d335630767372e943f8c3.jpg?h=1920');
    expect(stillUrl('4f42f869145d335630767372e943f8c3', 640)).toBe('/stills/4f42f869145d335630767372e943f8c3.jpg?h=640');
  });

  it('takes only a uid', () => {
    expect(isStreamUid('4f42f869145d335630767372e943f8c3')).toBe(true);
    for (const bad of ['../etc/passwd', '4F42F869145D335630767372E943F8C3', 'abc', '', null]) expect(isStreamUid(bad)).toBe(false);
  });
});

describe('altOf', () => {
  it("says a photo in the house's voice, with no dashes", () => {
    expect(altOf('Infinity Hoodie in Apricot \u2014 front view', 'Infinity Hoodie')).toBe('Infinity Hoodie in Apricot, front view');
    expect(altOf(null, 'Infinity Hoodie')).toBe('Infinity Hoodie');
  });
});
