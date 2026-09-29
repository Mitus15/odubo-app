import type { Form } from './types';

/**
 * Distance from Recoolman, flying at (x, s) on the glide line, to a form.
 *
 * He always flies at y = 0 in path space. The renderer shears every form
 * along the glide (verticals stay vertical, flat faces fall with the line),
 * so path space is exact: what you hit is exactly what you see.
 */
export function distanceFromFlight(form: Form, x: number, s: number): number {
  return distanceToForm(form, x, 0, s);
}

/**
 * Signed distance from a point in path space to a form's surface: positive
 * outside, negative inside. Rings have no surface to hit, so they are
 * infinitely far away.
 *
 * Yaw turns a form about the vertical axis. Local (lx, ls) maps to path space
 * as x = lx·cos − ls·sin, s = lx·sin + ls·cos, which is exactly what a
 * three.js rotation.y of the same angle does once s is laid along −z.
 */
export function distanceToForm(form: Form, px: number, py: number, ps: number): number {
  const dx = px - form.x;
  const dy = py - form.y;
  const ds = ps - form.s;

  if (form.kind === 'block') {
    const cos = Math.cos(form.yaw);
    const sin = Math.sin(form.yaw);
    const lx = dx * cos + ds * sin;
    const ls = -dx * sin + ds * cos;
    return boxDistance(Math.abs(lx) - form.hx, Math.abs(dy) - form.hy, Math.abs(ls) - form.hs);
  }

  if (form.kind === 'prism') {
    const radial = Math.hypot(dx, ds) - form.hx;
    const vertical = Math.abs(dy) - form.hy;
    const outside = Math.hypot(Math.max(radial, 0), Math.max(vertical, 0));
    return outside + Math.min(Math.max(radial, vertical), 0);
  }

  return Infinity;
}

function boxDistance(qx: number, qy: number, qz: number): number {
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  return outside + Math.min(Math.max(qx, qy, qz), 0);
}

/**
 * How far a form reaches along the flight from its centre, for culling.
 * A yawed block can reach further than its half length.
 */
export function reachAlongFlight(form: Form): number {
  if (form.kind === 'block') {
    return Math.abs(form.hx * Math.sin(form.yaw)) + Math.abs(form.hs * Math.cos(form.yaw));
  }
  return form.hx + (form.kind === 'ring' ? form.hy : 0);
}
