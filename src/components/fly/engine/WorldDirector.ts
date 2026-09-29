import { between, chance, createRng, sign, type Rng } from './rng';
import { distanceFromFlight, reachAlongFlight } from './geometry';
import type { Form, FormKind } from './types';
import { WORLD } from './world';

/** 0 is an open sky, 1 is the tightest the world gets. */
export type IntensityAt = (s: number) => number;

type Pattern = 'open' | 'field' | 'arch' | 'slot' | 'portal';

interface SafePoint {
  s: number;
  x: number;
}

/** Keep solid forms at least this far off the plane before calling them harmless. */
const PLANE_MARGIN = WORLD.playerRadius + 0.2;
/** The safe line never runs closer than this to the edge of the play area. */
const SAFE_EDGE = WORLD.playHalfWidth - 5;
/** How far the safe line may move across one segment. Keeps every line flyable at top speed. */
const MAX_SHIFT = 7;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Composes the world a segment at a time, ahead of the flight.
 *
 * Every segment is built around a safe line: a smooth path that is always
 * flyable, with a clear corridor around it whose width tightens as the
 * intensity rises. Obstacles may crowd the corridor but never close it, so
 * every crash is a choice, never a trap.
 */
export class WorldDirector {
  /** Every form currently in the world. */
  readonly forms: Form[] = [];

  private rng: Rng;
  private intensityAt: IntensityAt;
  private safe: SafePoint[] = [{ s: 0, x: 0 }];
  private composedTo = 0;
  private calmUntil: number = WORLD.calm;
  private nextId = 1;
  private added: Form[] = [];
  private removed: Form[] = [];
  private retiredTo = -Infinity;
  private segmentsSinceSlot = 0;
  private segmentsSincePortal = 0;

  constructor(seed: number, intensityAt: IntensityAt = () => 0.4) {
    this.rng = createRng(seed);
    this.intensityAt = intensityAt;
  }

  setIntensity(intensityAt: IntensityAt): void {
    this.intensityAt = intensityAt;
  }

  /** Compose ahead of s and retire what is well behind it. */
  update(s: number): void {
    while (this.composedTo < s + WORLD.ahead) this.composeSegment(this.composedTo);
    if (s - this.retiredTo > 5) this.retire(s - WORLD.behind);
  }

  /**
   * Clear the world from just behind s onwards and start a calm stretch there.
   * Used when a run begins mid-flight, so it never begins inside a wall.
   */
  clearAhead(s: number, x: number): void {
    const cut = s - 8;
    for (let i = this.forms.length - 1; i >= 0; i--) {
      const form = this.forms[i];
      if (form.s + form.reach > cut) {
        this.forms.splice(i, 1);
        this.removed.push(form);
      }
    }
    this.safe = this.safe.filter((point) => point.s < cut);
    const here = clamp(x, -SAFE_EDGE, SAFE_EDGE);
    this.safe.push({ s: cut, x: here });
    this.composedTo = cut;
    this.calmUntil = s + WORLD.calm;
    this.segmentsSincePortal = 0;
    this.segmentsSinceSlot = 0;
  }

  /** The always-flyable line at s. */
  safeXAt(s: number): number {
    const points = this.safe;
    if (s <= points[0].s) return points[0].x;
    for (let i = points.length - 1; i >= 1; i--) {
      const a = points[i - 1];
      if (s < a.s) continue;
      const b = points[i];
      if (s >= b.s) return b.x;
      return lerp(a.x, b.x, smoothstep((s - a.s) / (b.s - a.s)));
    }
    return points[points.length - 1].x;
  }

  /** Forms whose extent along the flight comes within `reach` of s. */
  formsNear(s: number, reach: number): Form[] {
    const near: Form[] = [];
    for (const form of this.forms) {
      if (Math.abs(form.s - s) <= reach + form.reach) near.push(form);
    }
    return near;
  }

  /** Forms added and removed since the last call, for the renderer. */
  drainChanges(): { added: Form[]; removed: Form[] } {
    const changes = { added: this.added, removed: this.removed };
    this.added = [];
    this.removed = [];
    return changes;
  }

  // ── Composition ──────────────────────────────────────────────────────────

  private composeSegment(s0: number): void {
    const rng = this.rng;
    const s1 = s0 + WORLD.segment;
    const intensity = clamp(this.intensityAt(s0 + WORLD.segment / 2), 0, 1);
    const calm = s1 <= this.calmUntil;
    const pattern: Pattern = calm ? 'open' : this.choosePattern(intensity);

    // Extend the safe line. Patterns built around it hold it straight.
    const x0 = this.safe[this.safe.length - 1].x;
    const straight = pattern === 'slot' || pattern === 'arch' || pattern === 'portal';
    const x1 = straight ? x0 : clamp(x0 + between(rng, -MAX_SHIFT, MAX_SHIFT), -SAFE_EDGE, SAFE_EDGE);
    this.safe.push({ s: s1, x: x1 });

    const corridor = lerp(7.5, 2.8, intensity);
    const mid = s0 + WORLD.segment / 2;

    switch (pattern) {
      case 'field':
        this.composeField(s0, s1, intensity, corridor);
        break;
      case 'arch':
        this.composeArch(mid, x0, intensity);
        break;
      case 'slot':
        this.composeSlot(mid, x0, intensity);
        break;
      case 'portal':
        this.composePortal(mid, x0);
        break;
      case 'open':
        break;
    }

    // Something to skim in the quiet stretches: a surface just under the line.
    if ((pattern === 'open' || pattern === 'portal') && chance(rng, calm ? 0.35 : 0.5)) {
      this.composeSkim(s0, s1);
    }

    this.composeScenery(s0, s1);

    this.segmentsSinceSlot = pattern === 'slot' ? 0 : this.segmentsSinceSlot + 1;
    this.segmentsSincePortal = pattern === 'portal' ? 0 : this.segmentsSincePortal + 1;
    this.composedTo = s1;
  }

  private choosePattern(intensity: number): Pattern {
    const rng = this.rng;
    if (this.segmentsSincePortal >= 9 && chance(rng, 0.35)) return 'portal';
    if (intensity > 0.45 && this.segmentsSinceSlot >= 4 && chance(rng, 0.15 + 0.3 * intensity)) return 'slot';
    if (chance(rng, 0.16)) return 'arch';
    if (intensity < 0.2 && chance(rng, 0.5)) return 'open';
    return 'field';
  }

  /** Monoliths and prisms scattered across the play area, clear of the corridor. */
  private composeField(s0: number, s1: number, intensity: number, corridor: number): void {
    const rng = this.rng;
    const wanted = Math.round(lerp(2, 9, intensity));
    let placed = 0;
    for (let attempt = 0; attempt < wanted * 5 && placed < wanted; attempt++) {
      const kind: FormKind = chance(rng, 0.62) ? 'block' : 'prism';
      const stump = chance(rng, 0.14);
      const top = stump ? -between(rng, 0.7, 1.6) : between(rng, 5, 60);
      const bottom = -between(rng, 70, 150);
      const width = kind === 'block' ? between(rng, 1.8, 6.5) : between(rng, 1.1, 3.2);
      const depth = kind === 'block' ? between(rng, 1.8, 6.5) : width;
      const form = this.make(kind, {
        x: between(rng, -(WORLD.playHalfWidth + 6), WORLD.playHalfWidth + 6),
        y: (top + bottom) / 2,
        hy: (top - bottom) / 2,
        s: 0,
        hx: width,
        hs: depth,
        yaw: kind === 'block' ? between(rng, -0.6, 0.6) : 0,
      });
      form.s = between(rng, s0 + form.reach + 0.5, s1 - form.reach - 0.5);
      if (form.s < s0 || form.s > s1) continue;
      if (!this.clearsCorridor(form, corridor)) continue;
      this.add(form);
      placed++;
    }
  }

  /** Two pillars and a lintel: a doorway on the line. */
  private composeArch(mid: number, x: number, intensity: number): void {
    const rng = this.rng;
    const half = lerp(5.5, 3.2, intensity);
    const radius = between(rng, 1.3, 2.2);
    const lintelHeight = between(rng, 4.5, 8);
    for (const side of [-1, 1] as const) {
      this.add(
        this.make('prism', {
          x: x + side * (half + radius),
          y: -60 + lintelHeight / 2,
          hy: 60 + lintelHeight / 2,
          s: mid,
          hx: radius,
          hs: radius,
        }),
      );
    }
    this.add(
      this.make('block', {
        x,
        y: lintelHeight + 1.2,
        hy: 1.2,
        s: mid,
        hx: half + radius * 2 + 1.5,
        hs: radius * 1.2,
      }),
    );
  }

  /**
   * The crevice: two walls reaching past the edges of the play area, one gap
   * on the line. The only way through is to thread it, which is the point.
   */
  private composeSlot(mid: number, x: number, intensity: number): void {
    const rng = this.rng;
    const gap = lerp(3.4, 2.3, intensity);
    const length = between(rng, 11, 17);
    const outer = WORLD.playHalfWidth + 14;
    for (const side of [-1, 1] as const) {
      const inner = x + side * gap;
      const far = side * outer;
      const top = between(rng, 10, 48);
      const bottom = -140;
      this.add(
        this.make('block', {
          x: (inner + far) / 2,
          y: (top + bottom) / 2,
          hy: (top - bottom) / 2,
          s: mid,
          hx: Math.abs(far - inner) / 2,
          hs: length,
        }),
      );
    }
    if (chance(rng, 0.45)) {
      const height = between(rng, 3.5, 7);
      this.add(
        this.make('block', {
          x,
          y: height + 2,
          hy: 2,
          s: mid,
          hx: gap + 6,
          hs: length * 0.85,
        }),
      );
    }
  }

  /** A ring on the line, framed wide. */
  private composePortal(mid: number, x: number): void {
    const rng = this.rng;
    this.add(this.make('ring', { x, y: 0, hy: 0.3, s: mid, hx: 4.6, hs: 0.3 }));
    for (const side of [-1, 1] as const) {
      const top = between(rng, 25, 70);
      const bottom = -140;
      this.add(
        this.make('block', {
          x: x + side * between(rng, 11, 16),
          y: (top + bottom) / 2,
          hy: (top - bottom) / 2,
          s: mid + between(rng, -6, 6),
          hx: between(rng, 2, 4),
          hs: between(rng, 2, 4),
          yaw: between(rng, -0.3, 0.3),
        }),
      );
    }
  }

  /** A long flat surface just under the line, to skim for a chain. */
  private composeSkim(s0: number, s1: number): void {
    const rng = this.rng;
    const s = (s0 + s1) / 2;
    const depth = between(rng, 0.8, 1.7);
    this.add(
      this.make('block', {
        x: this.safeXAt(s) + between(rng, -2, 2),
        y: -depth - 1.5,
        hy: 1.5,
        s,
        hx: between(rng, 3, 7),
        hs: between(rng, 8, 15),
        yaw: between(rng, -0.15, 0.15),
      }),
    );
  }

  /** The world beyond the play area: the monoliths and slabs that make it a place. */
  private composeScenery(s0: number, s1: number): void {
    const rng = this.rng;
    const monoliths = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < monoliths; i++) {
      const side = sign(rng);
      const width = between(rng, 4, 13);
      const top = between(rng, 15, 95);
      const bottom = -between(rng, 120, 200);
      this.add(
        this.make('block', {
          x: side * between(rng, WORLD.playHalfWidth + 8 + width, WORLD.fieldHalfWidth),
          y: (top + bottom) / 2,
          hy: (top - bottom) / 2,
          s: between(rng, s0, s1),
          hx: width,
          hs: between(rng, 4, 13),
          yaw: between(rng, -0.8, 0.8),
        }),
      );
    }

    // A floating slab, high or low, tilted: scenery only, kept off the plane.
    if (chance(rng, 0.55)) {
      const above = chance(rng, 0.5);
      const hx = between(rng, 5, 16);
      const hy = between(rng, 0.8, 2.2);
      const hs = between(rng, 4, 11);
      const bound = Math.hypot(hx, hy, hs) + 2;
      this.add(
        this.make('block', {
          x: between(rng, -WORLD.fieldHalfWidth * 0.7, WORLD.fieldHalfWidth * 0.7),
          y: above ? bound + between(rng, 2, 18) : -(bound + between(rng, 6, 30)),
          hy,
          s: between(rng, s0, s1),
          hx,
          hs,
          yaw: between(rng, -0.9, 0.9),
          roll: between(rng, -0.35, 0.35),
        }),
      );
    }
  }

  // ── Bookkeeping ──────────────────────────────────────────────────────────

  private make(
    kind: FormKind,
    spec: { x: number; y: number; s: number; hx: number; hy: number; hs: number; yaw?: number; roll?: number },
  ): Form {
    const rng = this.rng;
    const form: Form = {
      id: this.nextId++,
      kind,
      x: spec.x,
      y: spec.y,
      s: spec.s,
      hx: spec.hx,
      hy: spec.hy,
      hs: spec.hs,
      yaw: spec.yaw ?? 0,
      roll: spec.roll ?? 0,
      shade: rng(),
      accent: false,
      solid: kind !== 'ring' && !spec.roll,
      reach: 0,
    };
    form.reach = reachAlongFlight(form);
    return form;
  }

  private add(form: Form): void {
    form.accent = form.kind !== 'ring' && this.rng() < 0.12;
    this.forms.push(form);
    this.added.push(form);
  }

  /** True when a form stays clear of the safe line by at least `corridor` metres. */
  private clearsCorridor(form: Form, corridor: number): boolean {
    if (this.staysOffPlane(form)) return true;
    const from = form.s - form.reach - 1;
    const to = form.s + form.reach + 1;
    for (let s = from; s <= to; s += 1.5) {
      if (distanceFromFlight(form, this.safeXAt(s), s) < corridor) return false;
    }
    return true;
  }

  /** A form that never reaches the flight plane cannot be hit, only skimmed. */
  private staysOffPlane(form: Form): boolean {
    return form.y - form.hy > PLANE_MARGIN || form.y + form.hy < -PLANE_MARGIN;
  }

  private retire(behindS: number): void {
    for (let i = this.forms.length - 1; i >= 0; i--) {
      const form = this.forms[i];
      if (form.s + form.reach < behindS) {
        this.forms.splice(i, 1);
        this.removed.push(form);
      }
    }
    while (this.safe.length > 2 && this.safe[1].s < behindS) this.safe.shift();
    this.retiredTo = behindS + WORLD.behind;
  }
}
