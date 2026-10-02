/**
 * Sine and cosine that give the same bits in every JavaScript engine.
 *
 * `Math.sin` and `Math.cos` are only approximately specified, and Safari,
 * Chrome and Node may disagree in the last bit. The simulation has to produce
 * the same run on a phone and on the server that checks it, so it never calls
 * them: it uses these, built only from + − × ÷ and Math.round, which IEEE 754
 * fixes exactly.
 *
 * Range reduction is Cody-Waite with π/2 split in two (fdlibm's PIO2_1 and
 * PIO2_1T); the kernels are fdlibm's minimax polynomials on [−π/4, π/4].
 * Accurate to well under 1e-12 for |x| up to 1e4, far more than a course needs.
 */

const TWO_OVER_PI = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417;
const PIO2_1T = 6.07710050650619224932e-11;

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.08757232129817482790e-9;
const C6 = -1.13596475577881948265e-11;

function kernelSin(r: number): number {
  const z = r * r;
  return r + r * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))));
}

function kernelCos(r: number): number {
  const z = r * r;
  return 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
}

/** x = k·π/2 + r with |r| ≤ π/4; returns the quadrant k mod 4 and r. */
function reduce(x: number): { quadrant: number; r: number } {
  const k = Math.round(x * TWO_OVER_PI);
  const r = x - k * PIO2_1 - k * PIO2_1T;
  return { quadrant: ((k % 4) + 4) % 4, r };
}

export function dsin(x: number): number {
  const { quadrant, r } = reduce(x);
  switch (quadrant) {
    case 0:
      return kernelSin(r);
    case 1:
      return kernelCos(r);
    case 2:
      return -kernelSin(r);
    default:
      return -kernelCos(r);
  }
}

export function dcos(x: number): number {
  const { quadrant, r } = reduce(x);
  switch (quadrant) {
    case 0:
      return kernelCos(r);
    case 1:
      return -kernelSin(r);
    case 2:
      return -kernelCos(r);
    default:
      return kernelSin(r);
  }
}

export const DPI = 3.14159265358979311600;
