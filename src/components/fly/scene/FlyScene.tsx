'use client';

import { Suspense, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useFlyRuntime } from '../runtime';
import { Clouds } from './Clouds';
import { Dust } from './Dust';
import { FlightCamera } from './FlightCamera';
import { Recoolman } from './Recoolman';
import { createSkyMaterial, Sky, SUN_DIRECTION } from './Sky';
import { World } from './World';

/** Metres per second the arrow keys steer at, on a desktop. */
const KEY_STEER = 15;

/** Steps the engine once per frame, before anything draws. */
function Stepper() {
  const runtime = useFlyRuntime();
  useFrame((_, delta) => {
    const { engine, keys, view, frame } = runtime;
    const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (direction !== 0) engine.steerBy(direction * KEY_STEER * delta);

    const alpha = engine.update(delta);
    const state = engine.state;
    view.s = state.prevS + (state.s - state.prevS) * alpha;
    view.x = state.prevX + (state.x - state.prevX) * alpha;
    frame.follow(view.s);

    if (runtime.dropIn > 0) runtime.dropIn = Math.max(0, runtime.dropIn - delta / 0.9);
    if (runtime.crashAge >= 0) runtime.crashAge += delta;

    const events = engine.drainEvents();
    if (events.length > 0) runtime.onEvents(events);
  }, -3);
  return null;
}

/** Writes the HUD's numbers straight into the DOM, a few times a second at most. */
function HudDriver() {
  const runtime = useFlyRuntime();
  const size = useThree((state) => state.size);
  const scratch = useMemo(
    () => ({ point: new THREE.Vector3(), lastScore: '', lastChain: '', clock: 0, frames: 0, fpsClock: 0 }),
    [],
  );
  const gl = useThree((state) => state.gl);

  useFrame(({ camera }, delta) => {
    const { engine, frame, view, hud } = runtime;
    const state = engine.state;

    scratch.clock += delta;
    if (scratch.clock > 0.08 && hud.score) {
      scratch.clock = 0;
      const text =
        state.rules === 'drift'
          ? formatClock(state.t)
          : Math.floor(state.score).toLocaleString('en-US');
      if (text !== scratch.lastScore) {
        hud.score.textContent = text;
        scratch.lastScore = text;
      }
    }

    // Where he is on screen; the live chain rides just under him, as in the clip.
    scratch.point.set(view.x, frame.y(-1.4, view.s), frame.z(view.s)).project(camera);
    runtime.flyerScreen.x = (scratch.point.x * 0.5 + 0.5) * size.width;
    runtime.flyerScreen.y = (-scratch.point.y * 0.5 + 0.5) * size.height;
    if (hud.chain) {
      const chain = Math.round(state.chain);
      const show = engine.scoring && chain > 0;
      const label = show ? String(chain) : '';
      if (label !== scratch.lastChain) {
        hud.chain.textContent = label;
        hud.chain.style.opacity = show ? '1' : '0';
        scratch.lastChain = label;
      }
      if (show) {
        const { x, y } = runtime.flyerScreen;
        hud.chain.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, 0)`;
      }
    }

    if (hud.debug) {
      scratch.frames += 1;
      scratch.fpsClock += delta;
      if (scratch.fpsClock > 0.5) {
        const fps = scratch.frames / scratch.fpsClock;
        const info = gl.info.render;
        hud.debug.textContent = `${fps.toFixed(0)} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(1)}k tris · dpr ${gl.getPixelRatio().toFixed(2)} · ${engine.director.forms.length} forms`;
        scratch.frames = 0;
        scratch.fpsClock = 0;
      }
    }
  });
  return null;
}

/** 83 seconds reads as 1:23. */
export function formatClock(seconds: number): string {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

/** Recoolman's chrome reflects this: the region's own sky, rendered once. */
function Reflections() {
  const runtime = useFlyRuntime();
  const material = useMemo(() => createSkyMaterial(runtime.region), [runtime.region]);
  return (
    <Environment frames={1} resolution={64}>
      <mesh material={material}>
        <sphereGeometry args={[10, 32, 16]} />
      </mesh>
    </Environment>
  );
}

export function FlyScene() {
  const runtime = useFlyRuntime();
  const { region } = runtime;
  const sun = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(100), []);

  return (
    <>
      <color attach="background" args={[region.sky.horizon]} />
      <fogExp2 attach="fog" args={[region.sky.horizon, region.fogDensity]} />
      <hemisphereLight args={[region.light.hemiSky, region.light.hemiGround, region.light.hemi]} />
      <directionalLight position={sun} color={region.light.sun} intensity={region.light.sunIntensity} />
      <Stepper />
      <FlightCamera />
      <Sky region={region} />
      <World />
      <Clouds />
      <Dust />
      <Suspense fallback={null}>
        <Reflections />
        <Recoolman />
      </Suspense>
      <HudDriver />
    </>
  );
}
