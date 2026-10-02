import { FALL, holeSizeFor } from '@/lib/fly/rules';
import type { PatternName } from '@/lib/fly/album';
import { CORRIDOR, snap, type Course, type PathPoint } from './course';
import { dcos, dsin, DPI } from './detmath';
import { cutFloor, holesOverlap } from './floor';
import { between, chance, pick, rngFor, type Rng } from './rng';
import type { Floor, Form, FormKind, FormRole, Hole } from './types';

/** The thickest a floor gets, half along the fall (m). Sections leave room for it. */
export const MAX_FLOOR_HALF = 1.25;
/** Holes keep at least this much stone between them (m). */
const HOLE_GAP = 1.4;
/** Ids within a section: id = section · ID_STRIDE + n. The floor's group is n = 0. */
export const ID_STRIDE = 1024;
/** Scenery may hang this far below its own section (m). */
export const SCENERY_SPILL = 60;

export interface Section {
  k: number;
  floor: Floor | null;
  forms: Form[];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The width of the safe hole at this intensity: generous to tight (m). */
export function safeWidth(intensity: number): number {
  return lerp(7, 4.4, intensity);
}

/**
 * Build section k of a course: the floor at its top (if any) and everything in
 * the air down to the next floor. Pure: the same course and k always give the
 * same section, whatever order sections are built in.
 */
export function composeSection(course: Course, k: number): Section {
  const rng = rngFor(course.seed, k);
  const builder = new SectionBuilder(course, k, rng);
  return builder.build();
}

class SectionBuilder {
  private readonly forms: Form[] = [];
  private next = 1;
  private readonly intensity: number;
  private readonly top: number;
  private readonly bottom: number;
  private readonly from: PathPoint;
  private readonly to: PathPoint;

  constructor(
    private readonly course: Course,
    private readonly k: number,
    private readonly rng: Rng,
  ) {
    this.intensity = course.intensityAt(k);
    this.top = k === 0 ? 0 : course.floorS(k);
    this.bottom = course.floorS(k + 1);
    this.from = course.pathAt(k);
    this.to = course.pathAt(k + 1);
  }

  build(): Section {
    const { course, k, rng } = this;
    let floor: Floor | null = null;
    if (k > 0) {
      const pattern = this.choosePattern();
      if (pattern !== 'open') floor = this.composeFloor(pattern);
    }
    if (k > 0 && chance(rng, course.spec.pillars)) this.composePillars();
    if (k > 0 && chance(rng, course.spec.shards)) this.composeShards();
    if (chance(rng, k === 0 ? course.spec.gates * 0.8 : course.spec.gates * (0.6 + 0.4 * this.intensity))) {
      this.composeGate();
    }
    this.composeScenery();
    return { k, floor, forms: this.forms };
  }

  private choosePattern(): PatternName {
    const { course, k, rng } = this;
    // A breather is open air, or an easy plate where the course has plates at all
    // (a cutscene's sky has none, and must stay open).
    if (course.isBreather(k)) return chance(rng, 0.6) || !(course.spec.mix.plates > 0) ? 'open' : 'plates';
    if (k === 1) return course.spec.mix.plates > 0 || course.spec.mix.grid > 0 ? 'plates' : pick(rng, course.spec.mix);
    return pick(rng, course.spec.mix);
  }

  // ── Floors ───────────────────────────────────────────────────────────────

  private composeFloor(pattern: Exclude<PatternName, 'open'>): Floor {
    const { rng, intensity } = this;
    const holes: Hole[] = [];
    const width = safeWidth(intensity) * (pattern === 'oneway' ? 0.9 : 1);
    const minHalf = (safeWidth(1) / 2) * (pattern === 'oneway' ? 0.92 : 1);
    const hw = Math.max(minHalf, (width / 2) * between(rng, 0.85, 1.25));
    const hh = Math.max(minHalf, (width / 2) * between(rng, 0.85, 1.25));
    holes.push(this.hole(this.from.x, this.from.y, hw, hh, true));

    let thickness = between(rng, 1.0, 2.4);
    switch (pattern) {
      case 'plates':
        this.placeHoles(holes, Math.round(lerp(2.5, 1, intensity) * between(rng, 0.6, 1.4)), 'open');
        this.placeHoles(holes, Math.round(lerp(0.6, 2.4, intensity) * between(rng, 0.6, 1.4)), 'narrow');
        break;
      case 'crack':
        this.placeHoles(holes, 2 + Math.floor(rng() * 3), 'crack');
        break;
      case 'grid':
        holes.length = 0;
        this.composeGrid(holes);
        thickness = between(rng, 0.8, 1.2);
        break;
      case 'oneway':
        break;
    }

    const reach = between(rng, 38, 46);
    const s = this.top;
    const hs = Math.min(MAX_FLOOR_HALF, Math.max(FALL.minThickness / 2, thickness / 2));
    const group = this.k * ID_STRIDE;
    // One floor is one stone: its pieces share a shade, so the cuts never show.
    const shade = rng();
    const accent = rng() < 0.1;
    for (const piece of cutFloor(reach, holes)) {
      const form = this.make('block', 'floor', {
        x: (piece.x0 + piece.x1) / 2,
        y: (piece.y0 + piece.y1) / 2,
        s,
        hx: (piece.x1 - piece.x0) / 2,
        hy: (piece.y1 - piece.y0) / 2,
        hs,
      });
      form.group = group;
      form.shade = shade;
      form.accent = accent;
      this.forms.push(form);
    }
    return { id: this.k, s, hs, holes };
  }

  /**
   * A hole on the grid: centres on 10 cm, half sizes on 5 cm, so any two hole
   * edges either line up or stand at least 5 cm apart and a floor never cuts
   * into slivers. The safe hole's half sizes round up, never below its minimum.
   */
  private hole(x: number, y: number, hw: number, hh: number, safe: boolean): Hole {
    const half = (v: number) => (safe ? Math.ceil(v * 20 - 1e-9) : Math.round(v * 20)) / 20;
    const w = half(hw);
    const h = half(hh);
    return { x: snap(x), y: snap(y), hw: w, hh: h, size: holeSizeFor(w * 2, h * 2), safe };
  }

  /** Scatter extra holes off the path: the choices. Never on top of another hole. */
  private placeHoles(holes: Hole[], count: number, kind: 'open' | 'narrow' | 'crack'): void {
    const { rng } = this;
    const arena = FALL.arena;
    for (let placed = 0, attempt = 0; placed < count && attempt < count * 30; attempt++) {
      let hw: number;
      let hh: number;
      if (kind === 'narrow') {
        hw = between(rng, 1.0, 1.4);
        hh = between(rng, 1.0, 1.4);
      } else if (kind === 'crack') {
        const across = between(rng, 1.0, 1.3);
        const along = between(rng, 5, 13);
        const vertical = chance(rng, 0.5);
        hw = vertical ? across : along;
        hh = vertical ? along : across;
      } else {
        const wide = chance(rng, 0.5);
        hw = wide ? between(rng, 2.4, 3.8) : between(rng, 1.5, 2.3);
        hh = wide ? between(rng, 2.4, 3.8) : between(rng, 1.5, 2.3);
      }
      const x = between(rng, -arena + hw, arena - hw);
      const y = between(rng, -arena + hh, arena - hh);
      const candidate = this.hole(x, y, hw, hh, false);
      if (holes.some((other) => holesOverlap(candidate, other, HOLE_GAP))) continue;
      holes.push(candidate);
      placed++;
    }
  }

  /**
   * A lattice: square cells on a pitch, one of them centred on the safe path.
   * An open cell is a way down, not a risk, so it pays as a wide hole; but some
   * cells are pinched down to narrow ones, and those pay as narrow holes do.
   * The bars are there for whoever kisses them.
   */
  private composeGrid(holes: Hole[]): void {
    const { rng, intensity, from } = this;
    const minCell = safeWidth(1);
    // Cells and bars on the 10 cm grid, like every other hole.
    const cell = Math.ceil(Math.max(minCell, lerp(6.2, 3.8, intensity) * between(rng, 0.95, 1.1)) * 10 - 1e-9) / 10;
    const bar = snap(between(rng, 0.8, 1.3));
    const pitch = cell + bar;
    const span = FALL.arena + 2;
    const drop = lerp(0.1, 0.35, intensity);
    const pinch = lerp(0.15, 0.35, intensity);
    const first = (centre: number) => centre - Math.floor((centre + span) / pitch) * pitch;
    const cellHole = (x: number, y: number, safe: boolean): Hole => ({
      x: snap(x),
      y: snap(y),
      hw: cell / 2,
      hh: cell / 2,
      size: 'wide',
      safe,
    });
    for (let i = 0, x = first(from.x); x <= span; i++, x = first(from.x) + i * pitch) {
      for (let j = 0, y = first(from.y); y <= span; j++, y = first(from.y) + j * pitch) {
        const isSafe = Math.abs(x - from.x) < 1e-6 && Math.abs(y - from.y) < 1e-6;
        if (!isSafe && chance(rng, drop)) continue;
        if (!isSafe && chance(rng, pinch)) {
          // A pinched cell: the same centre, a narrow way through.
          const half = between(rng, 1.0, 1.35);
          holes.push(this.hole(x, y, half, half, false));
          continue;
        }
        holes.push(cellHole(x, y, isSafe));
      }
    }
    if (!holes.some((hole) => hole.safe)) holes.push(cellHole(from.x, from.y, true));
  }

  // ── The air between floors ───────────────────────────────────────────────

  /** How far a point in the plane is from the safe path's line through this section. */
  private fromLine(x: number, y: number): number {
    const { from, to } = this;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSq = dx * dx + dy * dy;
    let t = lengthSq > 0 ? ((x - from.x) * dx + (y - from.y) * dy) / lengthSq : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = from.x + dx * t - x;
    const py = from.y + dy * t - y;
    return Math.sqrt(px * px + py * py);
  }

  /** The depth range free of floors in this section, with a margin (m). */
  private air(margin: number): [number, number] {
    const top = this.k === 0 ? 0 : this.top + MAX_FLOOR_HALF;
    return [top + margin, this.bottom - MAX_FLOOR_HALF - margin];
  }

  private composePillars(): void {
    const { rng, intensity, course } = this;
    const count = Math.round(course.spec.pillars * lerp(2, 9, intensity) * between(rng, 0.6, 1.4));
    const [top, bottom] = this.air(1.5);
    if (bottom - top < 6) return;
    for (let placed = 0, attempt = 0; placed < count && attempt < count * 12; attempt++) {
      const radius = between(rng, 0.9, 2.4);
      const hs = Math.max(FALL.minThickness / 2, between(rng, 0.25, 0.5) * (bottom - top));
      const s = between(rng, top + hs, bottom - hs);
      const x = between(rng, -FALL.arena - 6, FALL.arena + 6);
      const y = between(rng, -FALL.arena - 6, FALL.arena + 6);
      if (this.fromLine(x, y) < radius + CORRIDOR) continue;
      this.forms.push(this.make('prism', 'pillar', { x, y, s, hx: radius, hy: radius, hs }));
      placed++;
    }
  }

  private composeShards(): void {
    const { rng, intensity, course } = this;
    const count = Math.round(course.spec.shards * lerp(1, 6, intensity) * between(rng, 0.5, 1.5));
    const [top, bottom] = this.air(2);
    if (bottom - top < 4) return;
    for (let placed = 0, attempt = 0; placed < count && attempt < count * 12; attempt++) {
      const hx = between(rng, 0.6, 1.6);
      const hy = between(rng, 0.6, 1.6);
      const hs = between(rng, 0.5, 1.6);
      const x = between(rng, -FALL.arena, FALL.arena);
      const y = between(rng, -FALL.arena, FALL.arena);
      const reach = Math.sqrt(hx * hx + hy * hy);
      if (this.fromLine(x, y) < reach + CORRIDOR) continue;
      const yaw = between(rng, -DPI, DPI);
      this.forms.push(this.make('block', 'shard', { x, y, s: between(rng, top + hs, bottom - hs), hx, hy, hs, yaw }));
      placed++;
    }
  }

  /** A ring to fall through: usually a little off the line, for the brave. */
  private composeGate(): void {
    const { rng, course, k } = this;
    const [top, bottom] = this.air(3);
    if (bottom - top < 4) return;
    const s = between(rng, lerp(top, bottom, 0.3), lerp(top, bottom, 0.7));
    const at = course.safeAt(s);
    let x = at.x;
    let y = at.y;
    if (k > 0 && chance(rng, 0.65)) {
      const angle = 2 * DPI * rng();
      const offset = between(rng, 3, 6);
      const limit = FALL.arena - 4;
      x = Math.min(limit, Math.max(-limit, x + offset * dcos(angle)));
      y = Math.min(limit, Math.max(-limit, y + offset * dsin(angle)));
    }
    this.forms.push(this.make('ring', 'gate', { x, y, s, hx: between(rng, 2.6, 3.6), hy: 0, hs: 0.18 }));
  }

  /** Monoliths far out in the sky, falling past: the world beyond the arena. */
  private composeScenery(): void {
    const { rng } = this;
    const count = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const angle = 2 * DPI * rng();
      const distance = between(rng, 52, 120);
      const s = between(rng, this.top, this.bottom);
      // Never hanging more than SCENERY_SPILL below its own section.
      const hs = Math.min(between(rng, 30, 140), this.bottom + SCENERY_SPILL - s);
      this.forms.push(
        this.make('block', 'scenery', {
          x: distance * dcos(angle),
          y: distance * dsin(angle),
          s,
          hx: between(rng, 3, 12),
          hy: between(rng, 3, 12),
          hs,
          yaw: between(rng, -DPI, DPI),
        }),
      );
    }
  }

  // ── Bookkeeping ──────────────────────────────────────────────────────────

  private make(
    kind: FormKind,
    role: FormRole,
    spec: { x: number; y: number; s: number; hx: number; hy: number; hs: number; yaw?: number },
  ): Form {
    const { rng } = this;
    const yaw = spec.yaw ?? 0;
    const id = this.k * ID_STRIDE + this.next++;
    return {
      id,
      group: id,
      kind,
      role,
      x: spec.x,
      y: spec.y,
      s: spec.s,
      hx: spec.hx,
      hy: spec.hy,
      hs: spec.hs,
      yaw,
      cos: yaw === 0 ? 1 : dcos(yaw),
      sin: yaw === 0 ? 0 : dsin(yaw),
      shade: rng(),
      accent: role !== 'gate' && role !== 'scenery' && rng() < 0.1,
      solid: role !== 'gate' && role !== 'scenery',
    };
  }
}
