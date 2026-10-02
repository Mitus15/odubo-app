import * as THREE from 'three';
import type { Look } from '@/lib/fly/region';

type ColorKey = Exclude<keyof Look, 'inkHalo' | 'ink'>;

const KEYS: ColorKey[] = ['field', 'zenith', 'nadir', 'stoneLight', 'stoneDark', 'accent', 'rim', 'cloud', 'dust', 'earth'];

/**
 * The colours of the sky he is falling through, as live three.js colours.
 *
 * Every material reads these same objects as uniforms, so moving from one
 * song's sky to the next is a blend of values, never a new shader: no hitch
 * on a phone between levels.
 */
export class LiveLook {
  readonly colors: Record<ColorKey, THREE.Color>;
  private readonly from: Record<ColorKey, THREE.Color>;
  private readonly to: Record<ColorKey, THREE.Color>;
  private progress = 1;
  private seconds = 1;
  /** The look being blended toward, for the HUD's type colour. */
  target: Look;

  constructor(initial: Look) {
    this.target = initial;
    const make = () => Object.fromEntries(KEYS.map((key) => [key, new THREE.Color(initial[key])])) as Record<ColorKey, THREE.Color>;
    this.colors = make();
    this.from = make();
    this.to = make();
  }

  /** Blend to `look` over `seconds` (0 for at once). */
  set(look: Look, seconds: number): void {
    this.target = look;
    for (const key of KEYS) {
      this.from[key].copy(this.colors[key]);
      this.to[key].set(look[key]);
    }
    this.seconds = Math.max(0.0001, seconds);
    this.progress = seconds <= 0 ? 1 : 0;
    if (seconds <= 0) for (const key of KEYS) this.colors[key].copy(this.to[key]);
  }

  /** Advance the blend. */
  update(delta: number): void {
    if (this.progress >= 1) return;
    this.progress = Math.min(1, this.progress + delta / this.seconds);
    const t = this.progress * this.progress * (3 - 2 * this.progress);
    for (const key of KEYS) this.colors[key].copy(this.from[key]).lerp(this.to[key], t);
  }
}
