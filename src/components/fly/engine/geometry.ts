import type { Form } from './types';

/**
 * Signed distance from a point in path space to a form's surface: positive
 * outside, negative inside. Gates have no surface to hit, so they are
 * infinitely far away.
 *
 * A block's yaw turns it in the x–y plane. Local (lx, ly) maps to path space
 * as x = lx·cos − ly·sin, y = lx·sin + ly·cos, which is exactly what a
 * three.js rotation.y of the same angle does once y is laid along −z (see
 * scene/frame.ts).
 *
 * Only + − × ÷ and Math.sqrt: the same answer in every JavaScript engine.
 */
export function distanceToForm(form: Form, px: number, py: number, ps: number): number {
  const dx = px - form.x;
  const dy = py - form.y;
  const ds = ps - form.s;

  if (form.kind === 'block') {
    const lx = dx * form.cos + dy * form.sin;
    const ly = -dx * form.sin + dy * form.cos;
    return boxDistance(abs(lx) - form.hx, abs(ly) - form.hy, abs(ds) - form.hs);
  }

  if (form.kind === 'prism') {
    const radial = Math.sqrt(dx * dx + dy * dy) - form.hx;
    const along = abs(ds) - form.hs;
    const ro = radial > 0 ? radial : 0;
    const ao = along > 0 ? along : 0;
    const inside = radial > along ? radial : along;
    return Math.sqrt(ro * ro + ao * ao) + (inside < 0 ? inside : 0);
  }

  return Infinity;
}

function boxDistance(qx: number, qy: number, qs: number): number {
  const ox = qx > 0 ? qx : 0;
  const oy = qy > 0 ? qy : 0;
  const os = qs > 0 ? qs : 0;
  const inside = Math.max(qx, qy, qs);
  return Math.sqrt(ox * ox + oy * oy + os * os) + (inside < 0 ? inside : 0);
}

function abs(v: number): number {
  return v < 0 ? -v : v;
}

/** How far a form reaches along the fall from its centre. */
export function reachAlongFall(form: Form): number {
  return form.hs;
}
