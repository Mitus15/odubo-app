import { COURSE_VERSION } from '@/lib/fly/rules';

/**
 * What a run leaves behind.
 *
 * The InputLog is the run itself: the quantised aim at every step it changed.
 * Fed back into a fresh engine on the same course it flies the same run, bit
 * for bit, which is how a leaderboard will check a depth (Build C).
 *
 * The Trajectory is how a run looks: where he was, fifteen times a second,
 * small enough to keep a ghost of every best in local storage.
 */

export class InputLog {
  /** Flat [tick, qx, qy, tick, qx, qy, …]. */
  readonly entries: number[] = [];

  record(tick: number, qx: number, qy: number): void {
    const n = this.entries.length;
    if (n >= 3 && this.entries[n - 2] === qx && this.entries[n - 1] === qy) return;
    this.entries.push(tick, qx, qy);
  }

  get length(): number {
    return this.entries.length / 3;
  }

  clear(): void {
    this.entries.length = 0;
  }
}

/** Plays an InputLog back, one step at a time. */
export class InputCursor {
  private index = 0;
  qx = 0;
  qy = 0;

  constructor(private readonly log: InputLog) {}

  /** The aim in force at `tick`. Ticks must be asked for in order. */
  at(tick: number): void {
    const entries = this.log.entries;
    while (this.index < entries.length && entries[this.index] <= tick) {
      this.qx = entries[this.index + 1];
      this.qy = entries[this.index + 2];
      this.index += 3;
    }
  }
}

/** Ticks between trajectory samples: 15 a second. */
export const SAMPLE_EVERY = 8;

export interface TrajectoryPoint {
  x: number;
  y: number;
  s: number;
}

/**
 * Positions in centimetres: x and y as Int16, depth as the growth in whole
 * centimetres since the last sample (Uint16), so depth never drifts.
 */
export class Trajectory {
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  readonly ss: number[] = [];

  /**
   * Add the sample for the next SAMPLE_EVERY ticks. `+ 0` turns −0 into 0, as
   * Int16 does, so a trajectory equals its own decoding bit for bit.
   */
  push(x: number, y: number, s: number): void {
    this.xs.push(Math.round(x * 100) + 0);
    this.ys.push(Math.round(y * 100) + 0);
    this.ss.push(Math.round(s * 100) + 0);
  }

  get count(): number {
    return this.xs.length;
  }

  clear(): void {
    this.xs.length = 0;
    this.ys.length = 0;
    this.ss.length = 0;
  }

  /** Where he was at `tick`, between samples. */
  at(tick: number, out: TrajectoryPoint): TrajectoryPoint | null {
    const n = this.xs.length;
    if (n === 0) return null;
    const position = tick / SAMPLE_EVERY;
    const i = Math.floor(position);
    if (i >= n - 1) {
      out.x = this.xs[n - 1] / 100;
      out.y = this.ys[n - 1] / 100;
      out.s = this.ss[n - 1] / 100;
      return out;
    }
    // Before the first sample (a lagging shadow at the start), hold the first.
    const t = i < 0 ? 0 : position - i;
    const a = i < 0 ? 0 : i;
    out.x = (this.xs[a] + (this.xs[a + 1] - this.xs[a]) * t) / 100;
    out.y = (this.ys[a] + (this.ys[a + 1] - this.ys[a]) * t) / 100;
    out.s = (this.ss[a] + (this.ss[a + 1] - this.ss[a]) * t) / 100;
    return out;
  }

  /** Depth at the last sample (m). */
  get depth(): number {
    return this.ss.length ? this.ss[this.ss.length - 1] / 100 : 0;
  }

  encode(): string {
    const n = this.xs.length;
    const bytes = new Uint8Array(8 + n * 6);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 0x46); // F
    view.setUint8(1, SAMPLE_EVERY);
    view.setUint16(2, COURSE_VERSION, true);
    view.setUint32(4, n, true);
    let previous = 0;
    for (let i = 0; i < n; i++) {
      const at = 8 + i * 6;
      view.setInt16(at, clamp(this.xs[i], -32768, 32767), true);
      view.setInt16(at + 2, clamp(this.ys[i], -32768, 32767), true);
      view.setUint16(at + 4, clamp(this.ss[i] - previous, 0, 65535), true);
      previous += clamp(this.ss[i] - previous, 0, 65535);
    }
    return toBase64(bytes);
  }

  static decode(text: string): Trajectory | null {
    try {
      const bytes = fromBase64(text);
      if (bytes.length < 8) return null;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (view.getUint8(0) !== 0x46 || view.getUint8(1) !== SAMPLE_EVERY) return null;
      if (view.getUint16(2, true) !== COURSE_VERSION) return null;
      const n = view.getUint32(4, true);
      if (bytes.length !== 8 + n * 6) return null;
      const trajectory = new Trajectory();
      let s = 0;
      for (let i = 0; i < n; i++) {
        const at = 8 + i * 6;
        s += view.getUint16(at + 4, true);
        trajectory.xs.push(view.getInt16(at, true));
        trajectory.ys.push(view.getInt16(at + 2, true));
        trajectory.ss.push(s);
      }
      return trajectory;
    } catch {
      return null;
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
