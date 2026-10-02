'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { FALL } from '@/lib/fly/rules';
import { useFlyRuntime, type FlyRuntime } from '../runtime';
import { Clouds } from './Clouds';
import { Dust } from './Dust';
import { FlightCamera } from './FlightCamera';
import { Ground } from './Ground';
import { createStoneUniforms } from './materials';
import { Ghost, Recoolman } from './Recoolman';
import { createSkyMaterial, Sky } from './Sky';
import { dropped, World } from './World';

/** Fog density: visibility is roughly 1.7 / density metres. Deep floors sink into the dark. */
const FOG = 0.0075;
/** At most this many engine steps per frame; a stalled tab catches up gently. */
const MAX_STEPS = 30;
const HISTORY = 512;

/** Where he was, step by step, so a lagging shadow can follow a beat behind. */
class Trail {
  private ticks = new Float64Array(HISTORY);
  private xs = new Float64Array(HISTORY);
  private ys = new Float64Array(HISTORY);
  private head = -1;
  private count = 0;

  clear(): void {
    this.head = -1;
    this.count = 0;
  }

  push(tick: number, x: number, y: number): void {
    if (this.count > 0 && this.ticks[this.head] === tick) return;
    this.head = (this.head + 1) % HISTORY;
    this.ticks[this.head] = tick;
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.count = Math.min(HISTORY, this.count + 1);
  }

  /** Where he was at `tick` (or the oldest point kept). */
  at(tick: number, out: { x: number; y: number }): void {
    for (let i = 0; i < this.count; i++) {
      const index = (this.head - i + HISTORY) % HISTORY;
      if (this.ticks[index] <= tick || i === this.count - 1) {
        out.x = this.xs[index];
        out.y = this.ys[index];
        return;
      }
    }
  }
}

/** Steps the engine to the run's clock, once per frame, before anything draws. */
function Stepper({ runtime }: { runtime: FlyRuntime }) {
  useFrame((_, delta) => {
    const { engine, view, frame } = runtime;
    runtime.look.update(delta);
    if (runtime.kiss.age >= 0) runtime.kiss.age += delta;
    if (runtime.stratum > 0) runtime.stratum = Math.max(0, runtime.stratum - delta / 1.6);
    if (runtime.paused) return;

    const keys = runtime.keys;
    engine.hold((keys.right ? 1 : 0) - (keys.left ? 1 : 0), (keys.up ? 1 : 0) - (keys.down ? 1 : 0));
    if (runtime.debugFlow !== null && runtime.mode === 'level') engine.state.flow = runtime.debugFlow;

    let seconds: number;
    if (runtime.clock) {
      seconds = runtime.clock();
    } else {
      runtime.attractSeconds += Math.min(delta, 0.1);
      seconds = runtime.attractSeconds;
    }
    const cutscene = runtime.cutscene;
    if (cutscene) {
      cutscene.t = seconds;
      // An interlude passes through a band of cloud between two skies.
      if (cutscene.script === 'stratum') {
        const wave = Math.sin(Math.PI * Math.min(1, Math.max(0, seconds / cutscene.duration)));
        runtime.stratum = Math.max(runtime.stratum, wave * wave * 0.85);
      }
    }
    const target = seconds * FALL.ticksPerSecond;
    const whole = Math.floor(target);
    const behind = whole - engine.state.tick;
    engine.advanceTo(whole, MAX_STEPS);

    // Draw between the last two steps, so motion is smooth at any frame rate.
    const state = engine.state;
    const alpha = behind > MAX_STEPS || engine.done ? 1 : Math.min(1, Math.max(0, target - whole));
    view.s = state.prevS + (state.s - state.prevS) * alpha;
    view.x = state.prevX + (state.x - state.prevX) * alpha;
    view.y = state.prevY + (state.y - state.prevY) * alpha;
    view.tick = state.tick - 1 + alpha;
    frame.follow(view.s);
    const endTick = engine.course.endTick;
    const through = Number.isFinite(endTick) ? Math.min(1, state.tick / endTick) : 0;
    runtime.albumProgress = runtime.albumFrom + runtime.albumSpan * through;

    const events = engine.drainEvents();
    if (events.length > 0) runtime.onEvents(events);
  }, -3);
  return null;
}

/** Feeds the stone where he is, where his shadow falls, and what just happened. */
function StoneDriver({ runtime, uniforms }: { runtime: FlyRuntime; uniforms: ReturnType<typeof createStoneUniforms> }) {
  const trail = useMemo(() => new Trail(), []);
  const seen = useMemo(() => ({ generation: -1, lagged: { x: 0, y: 0 } }), []);
  useFrame(() => {
    const { engine, frame, view } = runtime;
    if (seen.generation !== engine.generation) {
      seen.generation = engine.generation;
      trail.clear();
    }
    trail.push(view.tick, view.x, view.y);
    const playerY = frame.y(view.s);
    uniforms.uPlayer.value.set(view.x, playerY, frame.z(view.y));
    const lagTicks = runtime.shadowLag * FALL.ticksPerSecond;
    trail.at(view.tick - lagTicks, seen.lagged);
    uniforms.uShadow.value.set(seen.lagged.x, playerY, frame.z(seen.lagged.y));
    uniforms.uShadowStrength.value = runtime.mode === 'cutscene' ? 0.4 : 1;
    const kiss = runtime.kiss;
    uniforms.uKiss.value.set(kiss.x, frame.y(kiss.s), frame.z(kiss.y), kiss.age);
    uniforms.uRim.value = 0.18 + 0.22 * engine.state.flow;
  }, -2);
  return null;
}

/** Writes the HUD's numbers straight into the DOM, a few times a second at most. */
function HudDriver({ runtime }: { runtime: FlyRuntime }) {
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const scratch = useMemo(
    () => ({
      point: new THREE.Vector3(),
      ghost: { x: 0, y: 0, s: 0 },
      last: { depth: '', delta: '', total: '', flow: '', progress: '' },
      clock: 0,
      frames: 0,
      fpsClock: 0,
    }),
    [],
  );

  useFrame(({ camera }, delta) => {
    const { engine, frame, view, hud } = runtime;
    const state = engine.state;

    scratch.point.set(view.x, frame.y(view.s) - 1.2, frame.z(view.y)).project(camera);
    runtime.flyerScreen.x = (scratch.point.x * 0.5 + 0.5) * size.width;
    runtime.flyerScreen.y = (-scratch.point.y * 0.5 + 0.5) * size.height;

    scratch.clock += delta;
    if (scratch.clock > 0.06) {
      scratch.clock = 0;
      const write = (element: HTMLElement | null, key: keyof typeof scratch.last, text: string) => {
        if (!element || scratch.last[key] === text) return;
        element.textContent = text;
        scratch.last[key] = text;
      };
      write(hud.depth, 'depth', Math.floor(view.s).toLocaleString('en-US'));
      if (runtime.albumBase !== null) {
        write(hud.total, 'total', `Album ${Math.floor(runtime.albumBase + view.s).toLocaleString('en-US')}`);
      }
      const ghost = runtime.mode === 'level' ? runtime.ghost?.at(view.tick, scratch.ghost) : null;
      const ahead = ghost ? Math.round(view.s - ghost.s) : null;
      write(hud.ghostDelta, 'delta', ahead === null ? '' : `${ahead >= 0 ? '+' : '−'}${Math.abs(ahead).toLocaleString('en-US')}`);
      const flow = `${(state.flow * 100).toFixed(1)}%`;
      if (hud.flow && scratch.last.flow !== flow) {
        hud.flow.style.width = flow;
        hud.flow.style.opacity = String(0.35 + 0.65 * state.flow);
        scratch.last.flow = flow;
      }
      const endTick = engine.course.endTick;
      const progress = Number.isFinite(endTick) ? `${((100 * state.tick) / endTick).toFixed(2)}%` : '0%';
      if (hud.progress && scratch.last.progress !== progress) {
        hud.progress.style.width = progress;
        scratch.last.progress = progress;
      }
    }

    if (hud.debug) {
      scratch.frames += 1;
      scratch.fpsClock += delta;
      if (scratch.fpsClock > 0.5) {
        const fps = scratch.frames / scratch.fpsClock;
        const info = gl.info.render;
        hud.debug.textContent = `${fps.toFixed(0)} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(1)}k tris · dpr ${gl
          .getPixelRatio()
          .toFixed(2)} · ${engine.director.formCount} forms · ${dropped.count} dropped · ${state.speed.toFixed(0)} m/s · flow ${state.flow.toFixed(2)}`;
        scratch.frames = 0;
        scratch.fpsClock = 0;
      }
    }
  });
  return null;
}

/** Recoolman's chrome reflects this: the sky he is falling through. */
function Reflections() {
  const runtime = useFlyRuntime();
  const material = useMemo(() => createSkyMaterial(runtime.look), [runtime]);
  return (
    <Environment frames={Infinity} resolution={32}>
      <mesh material={material}>
        <sphereGeometry args={[10, 24, 12]} />
      </mesh>
    </Environment>
  );
}

/**
 * Light from straight above (heaven), the sky's own colour from all around.
 * A directional light only has a direction, so it never needs to follow him.
 */
function Lights() {
  const runtime = useFlyRuntime();
  const hemi = useRef<THREE.HemisphereLight>(null);
  useEffect(() => {
    if (hemi.current) {
      hemi.current.color = runtime.look.colors.zenith;
      hemi.current.groundColor = runtime.look.colors.nadir;
    }
  }, [runtime]);
  return (
    <>
      <hemisphereLight ref={hemi} intensity={0.85} />
      <directionalLight color="#fff6e8" intensity={1.45} position={[6, 100, -12]} />
    </>
  );
}

/** The fog is the song's air; between skies it thickens into a band of cloud. */
function Air({ fogDensity }: { fogDensity: { value: number } }) {
  const runtime = useFlyRuntime();
  const scene = useThree((state) => state.scene);
  const fog = useMemo(() => new THREE.FogExp2(runtime.look.colors.nadir.getHex(), FOG), [runtime]);
  useEffect(() => {
    fog.color = runtime.look.colors.nadir;
    scene.fog = fog;
    scene.background = runtime.look.colors.nadir;
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene, fog, runtime]);
  useFrame(() => {
    fog.density = FOG * (1 + runtime.stratum * 6);
    fogDensity.value = fog.density;
  });
  return null;
}

export function FlyScene() {
  const runtime = useFlyRuntime();
  const uniforms = useMemo(() => createStoneUniforms(runtime.look), [runtime]);
  const fogDensity = useMemo(() => ({ value: FOG }), []);

  return (
    <>
      <Stepper runtime={runtime} />
      <StoneDriver runtime={runtime} uniforms={uniforms} />
      <Air fogDensity={fogDensity} />
      <Lights />
      <FlightCamera />
      <Sky />
      <World uniforms={uniforms} />
      <Ground uniforms={uniforms} />
      <Clouds fogDensity={fogDensity} />
      <Dust />
      <Suspense fallback={null}>
        <Reflections />
        <Recoolman />
        <Ghost />
      </Suspense>
      <HudDriver runtime={runtime} />
    </>
  );
}
