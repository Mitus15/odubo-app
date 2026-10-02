/**
 * @jest-environment node
 */
import { levelBySlug } from '@/lib/fly/album';
import { COURSE_VERSION } from '@/lib/fly/rules';
import { Course } from '@/components/fly/engine/course';
import { FallEngine } from '@/components/fly/engine/FallEngine';
import { InputCursor, InputLog, SAMPLE_EVERY, Trajectory, type TrajectoryPoint } from '@/components/fly/engine/record';
import { createRng } from '@/components/fly/engine/rng';

/**
 * What a run leaves behind: the InputLog that re-flies it and the Trajectory
 * that draws its ghost. A ghost must come back exactly as it was stored, and
 * a stored one from another version or a broken string must be refused, not
 * drawn wrong.
 */

function bytesOf(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function textOf(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** A long fall: wandering across the arena, between 15 and 70 m/s. */
function longFall(samples: number): { trajectory: Trajectory; points: TrajectoryPoint[] } {
  const rng = createRng(31);
  const trajectory = new Trajectory();
  const points: TrajectoryPoint[] = [];
  let s = 0;
  for (let i = 0; i < samples; i++) {
    const point = { x: (rng() * 2 - 1) * 18, y: (rng() * 2 - 1) * 18, s };
    trajectory.push(point.x, point.y, point.s);
    points.push(point);
    s += (15 + rng() * 55) * (SAMPLE_EVERY / 120);
  }
  return { trajectory, points };
}

describe('Trajectory', () => {
  it('round-trips 8000 samples: positions to the centimetre, depth exact, no drift', () => {
    const { trajectory, points } = longFall(8000);
    const decoded = Trajectory.decode(trajectory.encode());
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    expect(decoded.count).toBe(8000);
    expect(decoded.xs).toEqual(trajectory.xs);
    expect(decoded.ys).toEqual(trajectory.ys);
    expect(decoded.ss).toEqual(trajectory.ss);

    let worst = 0;
    const depthOff: number[] = [];
    for (let i = 0; i < points.length; i++) {
      worst = Math.max(worst, Math.abs(decoded.xs[i] / 100 - points[i].x), Math.abs(decoded.ys[i] / 100 - points[i].y));
      if (decoded.ss[i] !== Math.round(points[i].s * 100)) depthOff.push(i);
    }
    expect(worst).toBeLessThanOrEqual(0.005 + 1e-9);
    expect(depthOff).toEqual([]);
    // Thousands of samples in, the depth is still the centimetre it was.
    const last = points[points.length - 1].s;
    expect(last).toBeGreaterThan(20_000);
    expect(decoded.depth).toBe(Math.round(last * 100) / 100);
  });

  it('round-trips a real run', () => {
    const level = levelBySlug('1984')!;
    const engine = new FallEngine(new Course(level.course), 'auto');
    engine.advanceTo(Infinity);
    const trajectory = engine.trajectory;
    expect(trajectory.count).toBe(Math.floor(engine.state.tick / SAMPLE_EVERY) + 1);
    const decoded = Trajectory.decode(trajectory.encode());
    expect(decoded?.xs).toEqual(trajectory.xs);
    expect(decoded?.ys).toEqual(trajectory.ys);
    expect(decoded?.ss).toEqual(trajectory.ss);
    expect(Math.abs((decoded?.depth ?? 0) - engine.state.s)).toBeLessThan(70 * (SAMPLE_EVERY / 120));
  });

  it('round-trips an empty trajectory', () => {
    const decoded = Trajectory.decode(new Trajectory().encode());
    expect(decoded?.count).toBe(0);
    expect(decoded?.depth).toBe(0);
  });

  it('refuses garbage, a wrong version and a wrong length', () => {
    const good = longFall(20).trajectory.encode();
    expect(Trajectory.decode(good)).not.toBeNull();

    expect(Trajectory.decode('')).toBeNull();
    expect(Trajectory.decode('not a ghost, not even base64 ¿')).toBeNull();
    expect(Trajectory.decode(btoa('hello, world'))).toBeNull();

    const tamper = (change: (bytes: Uint8Array, view: DataView) => Uint8Array | void): Trajectory | null => {
      const bytes = bytesOf(good);
      const view = new DataView(bytes.buffer);
      return Trajectory.decode(textOf(change(bytes, view) ?? bytes));
    };
    expect(tamper((_, view) => view.setUint8(0, 0x47))).toBeNull();
    expect(tamper((_, view) => view.setUint8(1, SAMPLE_EVERY + 1))).toBeNull();
    expect(tamper((_, view) => view.setUint16(2, COURSE_VERSION + 1, true))).toBeNull();
    expect(tamper((_, view) => view.setUint32(4, 21, true))).toBeNull();
    expect(tamper((bytes) => bytes.slice(0, bytes.length - 6))).toBeNull();
    expect(tamper((bytes) => {
      const longer = new Uint8Array(bytes.length + 1);
      longer.set(bytes);
      return longer;
    })).toBeNull();
    expect(tamper((bytes) => bytes.slice(0, 7))).toBeNull();
  });

  it('interpolates between samples, and holds at either end', () => {
    const trajectory = new Trajectory();
    const out: TrajectoryPoint = { x: 0, y: 0, s: 0 };
    expect(trajectory.at(0, out)).toBeNull();

    trajectory.push(0, 0, 0);
    trajectory.push(1.6, -0.8, 2);
    trajectory.push(3.2, 0, 4.5);
    const at = (tick: number) => {
      const point = trajectory.at(tick, out);
      return point ? { x: point.x, y: point.y, s: point.s } : null;
    };
    const close = (tick: number, x: number, y: number, s: number) => {
      const point = at(tick);
      expect(point).not.toBeNull();
      expect(point?.x).toBeCloseTo(x, 12);
      expect(point?.y).toBeCloseTo(y, 12);
      expect(point?.s).toBeCloseTo(s, 12);
    };
    close(0, 0, 0, 0);
    close(SAMPLE_EVERY / 2, 0.8, -0.4, 1);
    close(SAMPLE_EVERY / 4, 0.4, -0.2, 0.5);
    close(SAMPLE_EVERY, 1.6, -0.8, 2);
    close(SAMPLE_EVERY * 1.5, 2.4, -0.4, 3.25);
    close(SAMPLE_EVERY * 2, 3.2, 0, 4.5);
    close(SAMPLE_EVERY * 40, 3.2, 0, 4.5);
    // Before the first sample (a shadow a beat behind, at the start) it waits at the start.
    close(-SAMPLE_EVERY / 2, 0, 0, 0);
    close(-SAMPLE_EVERY * 3, 0, 0, 0);
    expect(trajectory.depth).toBe(4.5);
  });
});

describe('InputLog', () => {
  it('records only the steps where the aim changed', () => {
    const log = new InputLog();
    log.record(0, 0, 0);
    log.record(1, 0, 0);
    log.record(2, 5, 0);
    log.record(3, 5, 0);
    log.record(4, 5, -1);
    log.record(5, 5, -1);
    expect(log.entries).toEqual([0, 0, 0, 2, 5, 0, 4, 5, -1]);
    expect(log.length).toBe(3);
    log.clear();
    expect(log.length).toBe(0);
    log.record(9, 0, 0);
    expect(log.entries).toEqual([9, 0, 0]);
  });

  it('a hands-off run is one entry long', () => {
    const engine = new FallEngine(new Course(levelBySlug('rap')!.course), 'player');
    engine.advanceTo(120 * 30);
    expect(engine.inputs.entries).toEqual([0, 0, 0]);
  });
});

describe('InputCursor', () => {
  it('plays a log back in order, holding each aim until the next', () => {
    const log = new InputLog();
    log.record(3, 10, -10);
    log.record(5, 11, -10);
    log.record(9, 11, 12);
    const cursor = new InputCursor(log);
    const seen: [number, number][] = [];
    for (let tick = 0; tick <= 12; tick++) {
      cursor.at(tick);
      seen.push([cursor.qx, cursor.qy]);
    }
    expect(seen).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
      [10, -10],
      [10, -10],
      [11, -10],
      [11, -10],
      [11, -10],
      [11, -10],
      [11, 12],
      [11, 12],
      [11, 12],
      [11, 12],
    ]);
  });

  it('catches up when ticks are skipped', () => {
    const log = new InputLog();
    log.record(0, 1, 1);
    log.record(4, 2, 2);
    log.record(8, 3, 3);
    const cursor = new InputCursor(log);
    cursor.at(6);
    expect([cursor.qx, cursor.qy]).toEqual([2, 2]);
    cursor.at(100);
    expect([cursor.qx, cursor.qy]).toEqual([3, 3]);
  });
});
