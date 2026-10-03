/**
 * @jest-environment node
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { dcos, dsin, DPI } from '@/components/fly/engine/detmath';
import { createRng } from '@/components/fly/engine/rng';

/**
 * A run has to replay bit for bit on any phone and on the server that checks
 * it. That holds only while the simulation uses arithmetic IEEE 754 pins down
 * exactly. These tests check the hand-built sine and cosine are accurate, and
 * that nothing in the simulation reaches for the approximate built-ins.
 */

const TOLERANCE = 1e-12;

function points(count: number, range: number, seed: number): number[] {
  const rng = createRng(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push((rng() * 2 - 1) * range);
  return out;
}

/** The largest disagreement with the built-ins over `xs`, and where. */
function worstError(xs: readonly number[]): { error: number; at: number } {
  let error = 0;
  let at = 0;
  for (const x of xs) {
    const e = Math.max(Math.abs(dsin(x) - Math.sin(x)), Math.abs(dcos(x) - Math.cos(x)));
    if (e > error) {
      error = e;
      at = x;
    }
  }
  return { error, at };
}

describe('dsin and dcos', () => {
  it('agree with Math.sin and Math.cos across [-1e4, 1e4]', () => {
    expect(worstError(points(200_000, 1e4, 7)).error).toBeLessThan(TOLERANCE);
  });

  it('agree near zero and across the angles a course uses', () => {
    const near = [...points(20_000, 1, 11), ...points(20_000, 2 * DPI, 12), ...points(2_000, 1e-6, 13)];
    expect(worstError(near).error).toBeLessThan(TOLERANCE);
  });

  it('agree at every quadrant boundary and either side of it', () => {
    // k·π/4 covers both the switch between quadrants and the kernels' own edge.
    const ks: number[] = [];
    for (let k = -200; k <= 200; k++) ks.push(k);
    for (const big of [6364, 6365, 6366, 12730, 12731, 12732]) ks.push(big, -big);
    const xs: number[] = [];
    for (const k of ks) {
      const at = (k * DPI) / 4;
      if (Math.abs(at) > 1e4) continue;
      for (const nudge of [0, 1e-12, -1e-12, 1e-9, -1e-9, 1e-6, -1e-6]) xs.push(at + nudge);
    }
    expect(xs.length).toBeGreaterThan(2800);
    expect(worstError(xs).error).toBeLessThan(TOLERANCE);
  });

  it('are exactly odd and even', () => {
    const broken = points(50_000, 1e4, 17).filter(
      (x) => x !== 0 && (dsin(-x) !== -dsin(x) || dcos(-x) !== dcos(x)),
    );
    expect(broken).toEqual([]);
  });

  it('keep sin² + cos² at one, and hit the landmarks', () => {
    let worst = 0;
    for (const x of points(20_000, 1e4, 19)) {
      const s = dsin(x);
      const c = dcos(x);
      worst = Math.max(worst, Math.abs(s * s + c * c - 1));
    }
    expect(worst).toBeLessThan(1e-15);
    expect(dsin(0)).toBe(0);
    expect(dcos(0)).toBe(1);
    expect(DPI).toBe(Math.PI);
    expect(Math.abs(dsin(DPI))).toBeLessThan(1e-15);
    expect(dcos(DPI)).toBeCloseTo(-1, 15);
    expect(dsin(DPI / 2)).toBeCloseTo(1, 15);
  });
});

// ── The source scan ─────────────────────────────────────────────────────────

const ROOT = join(__dirname, '..');
const ENGINE = join(ROOT, 'components', 'fly', 'engine');
const RULES = [join(ROOT, 'lib', 'fly', 'rules.ts'), join(ROOT, 'lib', 'fly', 'album.ts')];

/**
 * Anything whose result is not fixed bit for bit by IEEE 754, or that reads
 * the clock or the dice. `**` is in the list because engines may compute it
 * through pow.
 */
const UNSAFE =
  /Math\.(sin|cos|tan|exp|log|pow|hypot|atan2?|a?sinh?|a?cosh?|tanh|cbrt|expm1|log1p|log2|log10|random)\b|\*\*|Date\.now|performance\.now/;

/**
 * What the scanned files may import from outside the scan: data, not code
 * that runs in a step. Anything else they import has to be scanned too.
 */
const DATA_IMPORTS = new Set(['@/lib/loop/songs', '../../../data/loop/film/shape.json']);

/** Code without its comments, so prose may name what code must not call. Strings are kept. */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 2;
      out += ' ';
      continue;
    }
    if (c === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      i = end < 0 ? source.length : end;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== c) j += source[j] === '\\' ? 2 : 1;
      out += source.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function engineFiles(): string[] {
  return readdirSync(ENGINE)
    .filter((name) => name.endsWith('.ts'))
    .sort();
}

describe('the simulation never calls an engine-dependent function', () => {
  it('the scanner sees through comments and still catches code', () => {
    expect(UNSAFE.test(stripComments('/** Math.sin is banned */ const a = 1;'))).toBe(false);
    expect(UNSAFE.test(stripComments('// Math.random() here\nconst b = 2;'))).toBe(false);
    expect(UNSAFE.test(stripComments('const c = 2 ** 3;'))).toBe(true);
    expect(UNSAFE.test(stripComments('const d = Math.atan2(1, 2);'))).toBe(true);
    expect(UNSAFE.test(stripComments('const e = Math.sqrt(2); const f = Date.now();'))).toBe(true);
    expect(UNSAFE.test(stripComments("const g = '//'; const h = Math.cos(1);"))).toBe(true);
    expect(UNSAFE.test(stripComments('const i = Math.sqrt(2) + Math.round(1.5) + Math.imul(3, 4);'))).toBe(false);
    // The raw source does name them, in its comments.
    const detmath = readFileSync(join(ENGINE, 'detmath.ts'), 'utf8');
    expect(UNSAFE.test(detmath)).toBe(true);
    expect(UNSAFE.test(stripComments(detmath))).toBe(false);
  });

  const scanned = [...engineFiles().map((name) => join(ENGINE, name)), ...RULES];

  it('scans the engine and the rules', () => {
    const names = scanned.map((file) => file.slice(ROOT.length + 1));
    for (const expected of [
      'components/fly/engine/FallEngine.ts',
      'components/fly/engine/CourseDirector.ts',
      'components/fly/engine/course.ts',
      'components/fly/engine/patterns.ts',
      'components/fly/engine/geometry.ts',
      'components/fly/engine/record.ts',
      'lib/fly/rules.ts',
      'lib/fly/album.ts',
    ]) {
      expect(names).toContain(expected);
    }
  });

  for (const file of scanned) {
    const name = file.slice(ROOT.length + 1);
    it(`${name} uses only exactly specified arithmetic`, () => {
      const code = stripComments(readFileSync(file, 'utf8'));
      const offending = code
        .split('\n')
        .map((line, index) => ({ line: line.trim(), index }))
        .filter(({ line }) => UNSAFE.test(line))
        .map(({ line }) => line);
      expect(offending).toEqual([]);
    });
  }

  it('everything the scanned files import is scanned too, or is data', () => {
    const known = new Set(scanned);
    for (const file of scanned) {
      const code = stripComments(readFileSync(file, 'utf8'));
      const name = file.slice(ROOT.length + 1);
      const unscanned: string[] = [];
      for (const match of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const specifier = match[1];
        if (DATA_IMPORTS.has(specifier)) continue;
        let target: string | null = null;
        if (specifier.startsWith('./')) target = join(file, '..', `${specifier.slice(2)}.ts`);
        else if (specifier.startsWith('@/')) target = join(ROOT, `${specifier.slice(2)}.ts`);
        if (!target || !known.has(target)) unscanned.push(specifier);
      }
      expect({ name, unscanned }).toEqual({ name, unscanned: [] });
    }
  });
});
