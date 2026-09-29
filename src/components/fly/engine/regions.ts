/**
 * A region is a mood of the world: its sky, its stone and its light.
 * Phase 2 gives every track its own; for now the flight lives in the first.
 */
export interface Region {
  name: string;
  sky: { zenith: string; horizon: string; nadir: string; sun: string };
  /** FogExp2 density. Visibility is roughly 1.7 / density metres. */
  fogDensity: number;
  form: { light: string; dark: string; accent: string; accentShare: number };
  light: { hemiSky: string; hemiGround: string; hemi: number; sun: string; sunIntensity: number };
  cloud: string;
  dust: string;
  /** Portal ring colour. */
  portal: string;
  /** HUD type colour, chosen against this sky. */
  ink: string;
}

/** Day one. Light, sand and one colour of blood. */
export const LIGHT: Region = {
  name: 'Light',
  sky: { zenith: '#b9b8b2', horizon: '#ece5d6', nadir: '#d6ccb9', sun: '#fff4dc' },
  fogDensity: 0.0056,
  form: { light: '#e2d9c6', dark: '#a79980', accent: '#843c2d', accentShare: 0.12 },
  light: { hemiSky: '#fff8ec', hemiGround: '#7d705d', hemi: 1.15, sun: '#fff0d8', sunIntensity: 1.7 },
  cloud: '#fbf8f1',
  dust: '#ffffff',
  portal: '#843c2d',
  ink: '#1a1716',
};
