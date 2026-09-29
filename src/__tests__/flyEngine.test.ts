import { FlightEngine, FLIGHT } from '@/components/fly/engine/FlightEngine';
import { WorldDirector } from '@/components/fly/engine/WorldDirector';
import { distanceToForm } from '@/components/fly/engine/geometry';
import { reachAlongFlight } from '@/components/fly/engine/geometry';
import type { FlightEvent, Form } from '@/components/fly/engine/types';
import { WORLD } from '@/components/fly/engine/world';
import { SCORING, multiplierFor } from '@/lib/fly/scoring';

/** A world that composes nothing, so a test can place exactly what it needs. */
class StillWorld extends WorldDirector {
  update(): void {}
}

function form(spec: Partial<Form> & Pick<Form, 'kind' | 'x' | 's'>): Form {
  const made: Form = {
    id: Math.floor(Math.random() * 1e9),
    y: 0,
    hx: 1,
    hy: 1,
    hs: 1,
    yaw: 0,
    roll: 0,
    shade: 0.5,
    accent: false,
    solid: spec.kind !== 'ring',
    reach: 0,
    ...spec,
  };
  made.reach = reachAlongFlight(made);
  return made;
}

function stillEngine(rules: 'dive' | 'drift', forms: Form[]): FlightEngine {
  const engine = new FlightEngine(7, new StillWorld(7));
  engine.restart({ rules, pilot: 'player' });
  engine.director.forms.splice(0, engine.director.forms.length, ...forms);
  return engine;
}

function fly(engine: FlightEngine, seconds: number): FlightEvent[] {
  const events: FlightEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    engine.update(1 / 60);
    events.push(...engine.drainEvents());
  }
  return events;
}

describe('distanceToForm', () => {
  it('measures to the faces of a block, negative inside', () => {
    const block = form({ kind: 'block', x: 0, s: 0, hx: 2, hy: 2, hs: 2 });
    expect(distanceToForm(block, 5, 0, 0)).toBeCloseTo(3);
    expect(distanceToForm(block, 0, 0, 0)).toBeCloseTo(-2);
    expect(distanceToForm(block, 5, 0, 6)).toBeCloseTo(5);
  });

  it('turns with yaw the way three.js does once s runs along -z', () => {
    // A long thin block turned a quarter turn lies across the flight.
    const block = form({ kind: 'block', x: 0, s: 0, hx: 10, hy: 5, hs: 0.5, yaw: Math.PI / 2 });
    expect(distanceToForm(block, 0, 0, 9)).toBeLessThan(0);
    expect(distanceToForm(block, 9, 0, 0)).toBeCloseTo(8.5);
  });

  it('measures a prism radially', () => {
    const prism = form({ kind: 'prism', x: 0, s: 0, hx: 1.5, hy: 10 });
    expect(distanceToForm(prism, 4, 0, 0)).toBeCloseTo(2.5);
    expect(distanceToForm(prism, 0, 12, 0)).toBeCloseTo(2);
  });
});

describe('multiplierFor', () => {
  it('steps up at each chain length', () => {
    expect(multiplierFor(0)).toBe(1);
    expect(multiplierFor(2.9)).toBe(1);
    expect(multiplierFor(3)).toBe(2);
    expect(multiplierFor(6.5)).toBe(3);
    expect(multiplierFor(10)).toBe(4);
    expect(multiplierFor(60)).toBe(5);
  });
});

describe('FlightEngine', () => {
  it('flies the same run from the same seed and the same hands', () => {
    const a = new FlightEngine(42);
    const b = new FlightEngine(42);
    a.restart({ rules: 'dive', pilot: 'player' });
    b.restart({ rules: 'dive', pilot: 'player' });
    for (let i = 0; i < 600; i++) {
      const slide = Math.sin(i / 40) * 0.3;
      a.steerBy(slide);
      b.steerBy(slide);
      a.update(1 / 60);
      b.update(1 / 60);
    }
    expect(a.state).toEqual(b.state);
    expect(a.director.forms.map((f) => [f.kind, f.x, f.s])).toEqual(b.director.forms.map((f) => [f.kind, f.x, f.s]));
  });

  it('grows a chain along a wall, then banks it with a multiplier once clear', () => {
    // A wall 2 m to his right, 110 m long: about four and a half seconds of graze.
    const wall = form({ kind: 'block', x: 3, s: 55, hx: 1, hy: 50, hs: 55 });
    const engine = stillEngine('dive', [wall]);
    const events = fly(engine, 7);

    expect(events.some((e) => e.type === 'chain-start')).toBe(true);
    const bank = events.find((e) => e.type === 'bank');
    expect(bank).toBeDefined();
    if (bank?.type !== 'bank') throw new Error('no bank');
    expect(bank.multiplier).toBe(2);
    expect(bank.points).toBeGreaterThan(100);
    expect(engine.state.bestChain).toBe(bank.points);
    // Distance plus the chain.
    expect(engine.state.score).toBeGreaterThan(bank.points + engine.state.s * SCORING.perMetre * 0.9);
    expect(engine.state.alive).toBe(true);
  });

  it('pays more the closer he flies', () => {
    const far = stillEngine('dive', [form({ kind: 'block', x: 3.3, s: 30, hx: 1, hy: 50, hs: 30 })]);
    const close = stillEngine('dive', [form({ kind: 'block', x: 1.8, s: 30, hx: 1, hy: 50, hs: 30 })]);
    fly(far, 1.5);
    fly(close, 1.5);
    expect(close.state.chain).toBeGreaterThan(far.state.chain * 2);
  });

  it('ends a Dive on the first touch and loses the open chain', () => {
    const wall = form({ kind: 'block', x: 0, s: 40, hx: 30, hy: 50, hs: 2 });
    const engine = stillEngine('dive', [wall]);
    const events = fly(engine, 3);
    expect(events.filter((e) => e.type === 'crash')).toHaveLength(1);
    expect(engine.state.alive).toBe(false);
    expect(engine.state.chain).toBe(0);
  });

  it('forgives a Drift: a stumble, slower, then on again', () => {
    const wall = form({ kind: 'block', x: 0, s: 40, hx: 30, hy: 50, hs: 2 });
    const engine = stillEngine('drift', [wall]);
    const events = fly(engine, 3);
    expect(events.filter((e) => e.type === 'stumble')).toHaveLength(1);
    expect(events.some((e) => e.type === 'crash')).toBe(false);
    expect(engine.state.alive).toBe(true);
    expect(engine.state.s).toBeGreaterThan(50);
  });

  it('counts a portal only when he flies through it', () => {
    const through = stillEngine('dive', [form({ kind: 'ring', x: 0, s: 30, hx: 4.6, hy: 0.3, hs: 0.3 })]);
    const past = stillEngine('dive', [form({ kind: 'ring', x: 9, s: 30, hx: 4.6, hy: 0.3, hs: 0.3 })]);
    const a = fly(through, 2);
    const b = fly(past, 2);
    expect(a.filter((e) => e.type === 'portal')).toHaveLength(1);
    expect(through.state.portals).toBe(1);
    expect(b.some((e) => e.type === 'portal')).toBe(false);
  });

  it('keeps no score on the title flight', () => {
    const engine = new FlightEngine(3);
    fly(engine, 10);
    expect(engine.state.score).toBe(0);
    expect(engine.state.pilot).toBe('auto');
  });

  it('speeds a Dive up over time', () => {
    const engine = stillEngine('dive', []);
    fly(engine, 5);
    const early = engine.state.speed;
    fly(engine, 60);
    expect(early).toBeGreaterThan(FLIGHT.diveStartSpeed * 0.9);
    expect(engine.state.speed).toBeGreaterThan(early + 5);
  });
});

describe('the world is always flyable', () => {
  // A good pilot aims a little ahead, as a thumb learns to.
  const lead = 2 / FLIGHT.lateralOmega;

  it.each([1, 2, 3, 4, 5, 6])('seed %i: two minutes of Dive on the safe line never touch a surface', (seed) => {
    const engine = new FlightEngine(seed);
    engine.restart({ rules: 'dive', pilot: 'player' });
    let crashed = false;
    for (let i = 0; i < 120 * 60; i++) {
      const s = engine.state;
      engine.steerBy(engine.director.safeXAt(s.s + s.speed * lead) - s.targetX);
      engine.update(1 / 60);
      if (engine.drainEvents().some((e) => e.type === 'crash')) crashed = true;
    }
    expect(crashed).toBe(false);
    expect(engine.state.s).toBeGreaterThan(3000);
  });

  it('never starts a run inside anything', () => {
    const engine = new FlightEngine(11);
    for (let i = 0; i < 30; i++) {
      engine.update(0.5);
      engine.restart({ rules: 'dive', pilot: 'player' });
      const nearest = Math.min(
        ...engine.director.forms.filter((f) => f.solid).map((f) => distanceToForm(f, engine.state.x, 0, engine.state.s)),
      );
      expect(nearest).toBeGreaterThan(WORLD.playerRadius);
    }
  });

  it('retires what is behind and keeps composing ahead', () => {
    const engine = new FlightEngine(9);
    fly(engine, 60);
    const s = engine.state.s;
    const forms = engine.director.forms;
    expect(forms.length).toBeGreaterThan(40);
    expect(Math.min(...forms.map((f) => f.s + f.reach))).toBeGreaterThan(s - WORLD.behind - 10);
    expect(Math.max(...forms.map((f) => f.s))).toBeGreaterThan(s + WORLD.ahead - WORLD.segment * 2);
  });
});
