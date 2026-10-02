/**
 * @jest-environment node
 */
import { ATTRACT_COURSE, LEVELS, type CourseSpec } from '@/lib/fly/album';
import { COURSE_VERSION, FALL } from '@/lib/fly/rules';
import { Course, CORRIDOR, PATH_MARGIN, type PathPoint } from '@/components/fly/engine/course';
import { cutFloor, holeContains, type Rect } from '@/components/fly/engine/floor';
import { composeSection, ID_STRIDE, MAX_FLOOR_HALF, safeWidth, type Section } from '@/components/fly/engine/patterns';
import { createRng, type Rng } from '@/components/fly/engine/rng';
import type { Form, Hole } from '@/components/fly/engine/types';

/**
 * The course is the same stone for everyone who falls a song, and every floor
 * can be threaded. These tests hold the composer to that: sections are pure,
 * the safe path is always reachable and always open, floors are watertight,
 * nothing solid sits in the corridor or between two floors' stone, and the
 * courses themselves are pinned so a change to them cannot slip out unnoticed.
 */

const SECTIONS = 120;
const EPS = 1e-9;

const COURSES: { name: string; spec: CourseSpec }[] = [
  ...LEVELS.map((level) => ({ name: level.slug, spec: level.course })),
  { name: 'attract', spec: ATTRACT_COURSE },
];

function buildAll(spec: CourseSpec, count = SECTIONS): Section[] {
  const course = new Course(spec);
  const sections: Section[] = [];
  for (let k = 0; k < count; k++) sections.push(composeSection(course, k));
  return sections;
}

/** Exact: JSON writes every double as its shortest round-trip form. */
function fingerprint(section: Section): string {
  return JSON.stringify(section);
}

function shuffled(count: number, rng: Rng): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function distanceToSegment(x: number, y: number, a: PathPoint, b: PathPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq > 0 ? ((x - a.x) * dx + (y - a.y) * dy) / lengthSq : 0;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(a.x + dx * t - x, a.y + dy * t - y);
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

function area(r: Rect): number {
  return (r.x1 - r.x0) * (r.y1 - r.y0);
}

function rectOfHole(hole: Hole): Rect {
  return { x0: hole.x - hole.hw, x1: hole.x + hole.hw, y0: hole.y - hole.hh, y1: hole.y + hole.hh };
}

function rectOfPiece(form: Form): Rect {
  return { x0: form.x - form.hx, x1: form.x + form.hx, y0: form.y - form.hy, y1: form.y + form.hy };
}

function clip(r: Rect, reach: number): Rect {
  return {
    x0: Math.max(-reach, r.x0),
    x1: Math.min(reach, r.x1),
    y0: Math.max(-reach, r.y0),
    y1: Math.min(reach, r.y1),
  };
}

/**
 * Problems with a floor's tiling, or [] when the pieces and the holes cover
 * the square [−reach, reach]² exactly once: every piece inside it, no piece
 * over a hole or another piece, and the areas adding up.
 */
function tilingProblems(reach: number, holes: readonly Hole[], pieces: readonly Rect[]): string[] {
  const problems: string[] = [];
  const side = 2 * reach;
  const holeRects = holes.map((hole) => clip(rectOfHole(hole), reach)).filter((r) => r.x1 > r.x0 && r.y1 > r.y0);
  let covered = 0;
  for (const r of holeRects) covered += area(r);
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    covered += area(piece);
    if (piece.x1 - piece.x0 <= 0 || piece.y1 - piece.y0 <= 0) problems.push(`piece ${i} is empty`);
    if (piece.x0 < -reach - EPS || piece.x1 > reach + EPS || piece.y0 < -reach - EPS || piece.y1 > reach + EPS) {
      problems.push(`piece ${i} leaves the square`);
    }
    for (const hole of holeRects) {
      if (overlapArea(piece, hole) > EPS) problems.push(`piece ${i} covers a hole`);
    }
    for (let j = i + 1; j < pieces.length; j++) {
      if (overlapArea(piece, pieces[j]) > EPS) problems.push(`pieces ${i} and ${j} overlap`);
    }
  }
  if (Math.abs(covered - side * side) > 1e-9 * side * side) {
    problems.push(`area ${covered} of ${side * side}`);
  }
  return problems;
}

/** The gap between two holes' rectangles: negative when they overlap. */
function holeGap(a: Hole, b: Hole): number {
  const gx = Math.abs(a.x - b.x) - a.hw - b.hw;
  const gy = Math.abs(a.y - b.y) - a.hh - b.hh;
  return Math.max(gx, gy);
}

// ── Sections are pure ──────────────────────────────────────────────────────

describe('a section is the same whatever order it is built in', () => {
  for (const { name, spec } of COURSES) {
    it(name, () => {
      const inOrder = buildAll(spec).map(fingerprint);

      const reversed = new Course(spec);
      const backwards: string[] = [];
      for (let k = SECTIONS - 1; k >= 0; k--) backwards[k] = fingerprint(composeSection(reversed, k));

      const scrambled = new Course(spec);
      const shuffledPrints: string[] = [];
      for (const k of shuffled(SECTIONS, createRng(spec.key))) shuffledPrints[k] = fingerprint(composeSection(scrambled, k));

      const again = buildAll(spec).map(fingerprint);

      const differ = (other: string[]) => inOrder.map((print, k) => (print === other[k] ? -1 : k)).filter((k) => k >= 0);
      expect(differ(backwards)).toEqual([]);
      expect(differ(shuffledPrints)).toEqual([]);
      expect(differ(again)).toEqual([]);

      for (const k of [0, 1, 11, 37, SECTIONS - 1]) {
        expect(fingerprint(composeSection(new Course(spec), k))).toBe(inOrder[k]);
      }
      // And rebuilding one section on the same course gives it back, deep-equal.
      const course = new Course(spec);
      expect(composeSection(course, 23)).toEqual(composeSection(course, 23));
    });
  }
});

// ── The safe path ──────────────────────────────────────────────────────────

describe('the safe path', () => {
  for (const { name, spec } of COURSES) {
    it(`${name}: starts at the centre, moves at most maxShift a floor and stays in the arena`, () => {
      const course = new Course(spec);
      const limit = FALL.arena - PATH_MARGIN;
      expect(course.pathAt(0)).toEqual({ x: 0, y: 0 });
      expect(course.shift).toBeGreaterThan(0);
      const tooFar: number[] = [];
      const outside: number[] = [];
      for (let k = 0; k <= SECTIONS; k++) {
        const a = course.pathAt(k);
        const b = course.pathAt(k + 1);
        if (Math.hypot(b.x - a.x, b.y - a.y) > course.shift + EPS) tooFar.push(k);
        if (Math.abs(b.x) > limit + EPS || Math.abs(b.y) > limit + EPS) outside.push(k + 1);
      }
      expect(tooFar).toEqual([]);
      expect(outside).toEqual([]);
    });
  }
});

// ── Floors ─────────────────────────────────────────────────────────────────

describe('floors', () => {
  for (const { name, spec } of COURSES) {
    describe(name, () => {
      const course = new Course(spec);
      const sections = buildAll(spec);
      const floored = sections.filter((section) => section.floor !== null);

      it('has floors to check', () => {
        expect(floored.length).toBeGreaterThan(SECTIONS / 3);
        expect(sections[0].floor).toBeNull();
      });

      it('every floor has exactly one safe hole, on the path and wide enough', () => {
        const minHalf = (safeWidth(1) / 2) * 0.92;
        for (const { k, floor } of floored) {
          if (!floor) continue;
          const safe = floor.holes.filter((hole) => hole.safe);
          expect({ k, safe: safe.length }).toEqual({ k, safe: 1 });
          const hole = safe[0];
          const path = course.pathAt(k);
          expect(holeContains(hole, path.x, path.y)).toBe(true);
          expect(Math.abs(hole.x - path.x)).toBeLessThan(1e-6);
          expect(Math.abs(hole.y - path.y)).toBeLessThan(1e-6);
          expect(hole.hw).toBeGreaterThanOrEqual(minHalf - EPS);
          expect(hole.hh).toBeGreaterThanOrEqual(minHalf - EPS);
          expect(floor.s).toBe(course.floorS(k));
          expect(floor.id).toBe(k);
          expect(floor.hs).toBeGreaterThanOrEqual(FALL.minThickness / 2);
          expect(floor.hs).toBeLessThanOrEqual(MAX_FLOOR_HALF);
        }
      });

      it('holes never overlap, and keep stone between them', () => {
        const clashes: string[] = [];
        let tightest = Infinity;
        for (const { k, floor } of floored) {
          if (!floor) continue;
          for (let i = 0; i < floor.holes.length; i++) {
            for (let j = i + 1; j < floor.holes.length; j++) {
              const gap = holeGap(floor.holes[i], floor.holes[j]);
              if (gap < tightest) tightest = gap;
              if (gap < 0.5) clashes.push(`floor ${k}: holes ${i} and ${j} are ${gap.toFixed(3)} m apart`);
            }
          }
        }
        expect(clashes).toEqual([]);
        expect(tightest).toBeGreaterThan(0);
      });

      it('the stone and the holes tile the floor exactly', () => {
        for (const { k, floor, forms } of floored) {
          if (!floor) continue;
          const pieces = forms.filter((form) => form.role === 'floor');
          expect(pieces.length).toBeGreaterThan(0);
          for (const piece of pieces) {
            expect(piece.kind).toBe('block');
            expect(piece.yaw).toBe(0);
            expect(piece.solid).toBe(true);
            expect(piece.group).toBe(k * ID_STRIDE);
            expect(piece.s).toBe(floor.s);
            expect(piece.hs).toBe(floor.hs);
          }
          const reach = Math.max(...pieces.map((p) => Math.max(Math.abs(p.x) + p.hx, Math.abs(p.y) + p.hy)));
          expect(reach).toBeGreaterThanOrEqual(FALL.floorReach - 2);
          expect({ k, problems: tilingProblems(reach, floor.holes, pieces.map(rectOfPiece)) }).toEqual({ k, problems: [] });
        }
      });
    });
  }
});

describe('cutFloor', () => {
  function randomHoles(rng: Rng, reach: number, count: number, gap: number): Hole[] {
    const holes: Hole[] = [];
    for (let attempt = 0; holes.length < count && attempt < count * 40; attempt++) {
      const hw = 0.3 + rng() * 6;
      const hh = 0.3 + rng() * 6;
      // Some reach past the square's edge, and are cut by it.
      const x = (rng() * 2 - 1) * (reach + 3);
      const y = (rng() * 2 - 1) * (reach + 3);
      const hole: Hole = { x, y, hw, hh, size: 'wide', safe: holes.length === 0 };
      if (holes.some((other) => holeGap(hole, other) < gap)) continue;
      holes.push(hole);
    }
    return holes;
  }

  it('an uncut floor is one piece', () => {
    expect(cutFloor(40, [])).toEqual([{ x0: -40, x1: 40, y0: -40, y1: 40 }]);
  });

  it('tiles the square exactly around random holes', () => {
    const rng = createRng(4242);
    for (let trial = 0; trial < 400; trial++) {
      const reach = 8 + rng() * 40;
      const holes = randomHoles(rng, reach, Math.floor(rng() * 26), trial % 4 === 0 ? 0 : 0.05 + rng() * 2);
      const pieces = cutFloor(reach, holes);
      expect({ trial, problems: tilingProblems(reach, holes, pieces) }).toEqual({ trial, problems: [] });
    }
  });

  it('tiles around holes that touch edge to edge, and around one bigger than the floor', () => {
    const lattice: Hole[] = [];
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        if ((i + j) % 2 !== 0) continue;
        lattice.push({ x: i * 4, y: j * 4, hw: 2, hh: 2, size: 'medium', safe: i === 0 && j === 0 });
      }
    }
    expect(tilingProblems(30, lattice, cutFloor(30, lattice))).toEqual([]);
    const huge: Hole = { x: 0, y: 0, hw: 50, hh: 50, size: 'wide', safe: true };
    expect(cutFloor(30, [huge])).toEqual([]);
    expect(tilingProblems(30, [huge], [])).toEqual([]);
  });
});

// ── The air between floors ─────────────────────────────────────────────────

describe('the air between floors', () => {
  it('a step at top speed is shorter than any solid form is thick, with his body', () => {
    expect(FALL.maxSpeed * FALL.step).toBeLessThan(FALL.minThickness + 2 * FALL.playerRadius);
  });

  for (const { name, spec } of COURSES) {
    describe(name, () => {
      const course = new Course(spec);
      const sections = buildAll(spec);
      const all = sections.flatMap((section) => section.forms.map((form) => ({ k: section.k, form })));

      it('composes pillars, shards and gates to check', () => {
        const roles = new Set(all.map(({ form }) => form.role));
        if (spec.pillars > 0) expect(roles.has('pillar')).toBe(true);
        if (spec.shards > 0) expect(roles.has('shard')).toBe(true);
        if (spec.gates > 0) expect(roles.has('gate')).toBe(true);
      });

      it('nothing solid comes within the corridor of the safe path', () => {
        const intruders: string[] = [];
        for (const { k, form } of all) {
          if (form.role !== 'pillar' && form.role !== 'shard') continue;
          const reach = form.role === 'pillar' ? form.hx : Math.hypot(form.hx, form.hy);
          const distance = distanceToSegment(form.x, form.y, course.pathAt(k), course.pathAt(k + 1));
          if (distance < CORRIDOR + reach - EPS) intruders.push(`${form.role} ${form.id}: ${distance.toFixed(3)} m`);
        }
        expect(intruders).toEqual([]);
      });

      it('every solid form is thick enough not to be stepped through', () => {
        const thin = all.filter(({ form }) => form.solid && form.hs < FALL.minThickness / 2 - EPS);
        expect(thin.map(({ form }) => form.id)).toEqual([]);
      });

      it('pillars, shards and gates stay clear of both floors', () => {
        const strays: string[] = [];
        for (const { k, form } of all) {
          if (form.role !== 'pillar' && form.role !== 'shard' && form.role !== 'gate') continue;
          const top = k === 0 ? 0 : course.floorS(k) + MAX_FLOOR_HALF;
          const bottom = course.floorS(k + 1) - MAX_FLOOR_HALF;
          if (form.s - form.hs <= top || form.s + form.hs >= bottom) {
            strays.push(`${form.role} ${form.id} spans ${form.s - form.hs}..${form.s + form.hs}, air ${top}..${bottom}`);
          }
        }
        expect(strays).toEqual([]);
      });

      it('ids are unique and stay inside their section', () => {
        const ids = all.map(({ form }) => form.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const { k, form } of all) {
          expect(Math.floor(form.id / ID_STRIDE)).toBe(k);
        }
        expect(all.every(({ form }) => form.solid === (form.role !== 'gate' && form.role !== 'scenery'))).toBe(true);
      });
    });
  }
});

// ── The courses, pinned ────────────────────────────────────────────────────

/**
 * A checksum of each course's first 60 sections, to 0.1 mm. If one of these
 * fails, the stone of that course has changed: every stored best and ghost was
 * flown on the old stone. If that was meant, bump COURSE_VERSION in
 * src/lib/fly/rules.ts (which resets stored ghosts and bests) and re-pin these
 * values for the new version, all in the same change.
 */
const GOLDEN: { version: number; sums: Record<string, string> } = {
  version: 1,
  sums: {
    '1984': 'e8ae4aa8',
    hallucinogen: 'f7d8c76f',
    'in-the-court': '99a24bbd',
    newspeak: 'a78e33e2',
    rap: 'd0a38e98',
    makunahea: 'c1f32d2d',
    'the-other-side': '673b698b',
    'the-mind-pt-1': '338a0c03',
    'the-mind-pt-2': '068135e1',
    'ghost-world': '817b4064',
    attract: '6ce101e3',
  },
};

const GOLDEN_SECTIONS = 60;

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function checksum(spec: CourseSpec): string {
  const course = new Course(spec);
  const r = (v: number) => Math.round(v * 1e4);
  const parts: string[] = [];
  for (let k = 0; k < GOLDEN_SECTIONS; k++) {
    const p = course.pathAt(k);
    parts.push(`p${k}:${r(p.x)},${r(p.y)}`);
    const section = composeSection(course, k);
    if (section.floor) {
      const f = section.floor;
      parts.push(`f${f.id}:${r(f.s)},${r(f.hs)}`);
      for (const h of f.holes) parts.push(`h:${r(h.x)},${r(h.y)},${r(h.hw)},${r(h.hh)},${h.size},${h.safe}`);
    }
    for (const f of section.forms) {
      parts.push(
        [f.id, f.group, f.kind, f.role, r(f.x), r(f.y), r(f.s), r(f.hx), r(f.hy), r(f.hs), r(f.yaw), r(f.shade), f.accent, f.solid].join(','),
      );
    }
  }
  return fnv1a(parts.join('|'));
}

describe('the courses are pinned', () => {
  it('the pinned values are for this COURSE_VERSION', () => {
    if (GOLDEN.version !== COURSE_VERSION) {
      throw new Error(
        `COURSE_VERSION is ${COURSE_VERSION} but the pinned course checksums are for version ${GOLDEN.version}. ` +
          'Re-pin GOLDEN in flyCourse.test.ts with the values this test prints for the new version.',
      );
    }
  });

  const actual: Record<string, string> = {};
  for (const { name, spec } of COURSES) actual[name] = checksum(spec);

  for (const { name } of COURSES) {
    it(`${name} has not changed`, () => {
      if (GOLDEN.version !== COURSE_VERSION) return;
      if (GOLDEN.sums[name] !== actual[name]) {
        throw new Error(
          `The course "${name}" changed (checksum ${actual[name]}, pinned ${GOLDEN.sums[name]}). ` +
            'The courses changed: every stored best and ghost was flown on the old stone. ' +
            'If this was meant, bump COURSE_VERSION in src/lib/fly/rules.ts (stored ghosts and bests reset with it) ' +
            `and re-pin GOLDEN in flyCourse.test.ts. All current checksums: ${JSON.stringify(actual)}`,
        );
      }
    });
  }
});
