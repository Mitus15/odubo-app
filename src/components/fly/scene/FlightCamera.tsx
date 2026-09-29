'use client';

import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FLIGHT } from '../engine/FlightEngine';
import { SCORING } from '@/lib/fly/scoring';
import { WORLD } from '../engine/world';
import { useFlyRuntime } from '../runtime';

/** Behind and above him, looking down the dive. */
const BACK = 6.6;
const UP = 3.1;
const LOOK_AHEAD = 15;
const LOOK_BELOW = 2.2;
/** How much of the width a phone held upright should see, degrees. */
const TARGET_HFOV = 74;
const MIN_VFOV = 56;
const MAX_VFOV = 86;

/**
 * The camera trails a little behind his turns, so you see him lean into them,
 * and widens slightly with speed. Its lag is kept in path space, so it survives
 * the world being re-centred.
 */
export function FlightCamera() {
  const runtime = useFlyRuntime();
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const size = useThree((state) => state.size);
  const lag = useMemo(() => ({ x: 0, roll: 0, crane: 0, primed: false, time: 0 }), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const { engine, frame, view } = runtime;
    const state = engine.state;
    if (!lag.primed) {
      lag.x = view.x;
      lag.primed = true;
    }
    lag.time += delta;

    lag.x += (view.x - lag.x) * (1 - Math.exp(-delta * 4.5));
    const lean = state.vx / FLIGHT.lateralMaxSpeed;
    lag.roll += (-lean * 0.12 - lag.roll) * (1 - Math.exp(-delta * 5));

    // Shake: a hum while grazing (closer is stronger), a jolt on impact.
    const motionScale = runtime.reducedMotion ? 0 : 1;
    const graze =
      state.grazing && state.alive
        ? 1 - Math.min(1, Math.max(0, (state.nearest - WORLD.playerRadius) / (SCORING.grazeBand - WORLD.playerRadius)))
        : 0;
    runtime.shake = Math.max(0, runtime.shake - delta * 2.2);
    const amount = (graze * 0.06 + runtime.shake * 0.5) * motionScale;
    const shakeX = amount * Math.sin(lag.time * 47.0);
    const shakeY = amount * Math.sin(lag.time * 59.0 + 1.3);

    // After a crash the camera cranes up and back, over the world he fell into.
    const craneTarget = runtime.crashAge >= 0 ? Math.min(1, runtime.crashAge / 2.2) : 0;
    lag.crane += (craneTarget - lag.crane) * (1 - Math.exp(-delta * 2.4));
    const up = UP + lag.crane * 24;
    const back = BACK + lag.crane * 12;

    const s = view.s;
    camera.position.set(lag.x * 0.82 + view.x * 0.18 + shakeX, frame.y(up, s - back) + shakeY, frame.z(s - back));
    target.set(view.x * 0.75 + lag.x * 0.25, frame.y(-LOOK_BELOW, s + LOOK_AHEAD), frame.z(s + LOOK_AHEAD));
    camera.up.set(Math.sin(lag.roll), Math.cos(lag.roll), 0);
    camera.lookAt(target);

    // Portrait phones need a wider view across; landscape needs less.
    const aspect = size.width / Math.max(1, size.height);
    const speedShare = Math.min(1, Math.max(0, (state.speed - FLIGHT.diveStartSpeed) / (FLIGHT.diveTopSpeed - FLIGHT.diveStartSpeed)));
    const fromWidth = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(TARGET_HFOV / 2)) / aspect));
    const fov = THREE.MathUtils.clamp(fromWidth, MIN_VFOV, MAX_VFOV) + speedShare * 6 * motionScale;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, -1);

  return null;
}
