import { contrast, defaultField, hex, INK, palette, parseHex, SAND_BRIGHT, type RGB } from '@/lib/loop/film/palette';

/**
 * A layer of sky: the colours one song's stretch of the fall is drawn in.
 *
 * Each chapter of the album has one flat field colour (the film's poster
 * look, walking the hue wheel from sand back to sand). The fall takes it as
 * its air: the fog and the sky around him are the field, the stone is the
 * field's own highlight and mid tones, and the light from above is heaven's.
 */
export interface Look {
  /** The air: fog and the sky's horizon. */
  field: string;
  /** Heaven, straight up. */
  zenith: string;
  /** The deep below him, before the Earth. */
  nadir: string;
  stoneLight: string;
  stoneDark: string;
  accent: string;
  /** The glow on stone he is close to, and the gates. */
  rim: string;
  cloud: string;
  dust: string;
  /** The Earth far below. */
  earth: string;
  /** Type over this sky. */
  ink: string;
  /** For the HUD's halo behind the type. */
  inkHalo: string;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const HEAVEN: RGB = [255, 248, 236];
const EARTH: RGB = [92, 74, 58];

export function lookFor(fieldHex: string | null | undefined, index = 0): Look {
  const field = parseHex(fieldHex ?? '') ?? defaultField(index);
  const tones = palette(field);
  const inkReads = contrast(INK, field) >= contrast(SAND_BRIGHT, field);
  return {
    field: hex(field),
    zenith: hex(mix(field, HEAVEN, 0.82)),
    // The deep below: the air he falls into. Darker than the stone, so a hole reads as a drop.
    nadir: hex(mix(tones.shadow, INK, 0.32)),
    // Stone is the field's highlight, well clear of the air, so a hole reads at a glance.
    stoneLight: hex(mix(tones.highlight, HEAVEN, 0.2)),
    stoneDark: hex(mix(tones.highlight, tones.mid, 0.55)),
    accent: hex(mix(INK, tones.mid, 0.25)),
    rim: hex(inkReads ? HEAVEN : SAND_BRIGHT),
    cloud: hex(mix(field, HEAVEN, 0.7)),
    dust: hex(mix(field, HEAVEN, 0.9)),
    earth: hex(mix(EARTH, tones.shadow, 0.35)),
    ink: hex(inkReads ? INK : SAND_BRIGHT),
    inkHalo: hex(inkReads ? mix(field, HEAVEN, 0.6) : mix(INK, field, 0.4)),
  };
}

/** The look of the title screen: Welcome's sand, the dust he is formed from. */
export const TITLE_LOOK: Look = lookFor(null, 0);
