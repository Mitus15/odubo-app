'use client';

import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CutsceneScript } from '@/lib/fly/album';
import { useFlyRuntime } from '../runtime';

/** Above him, and a little over his head (up the screen), in metres: he sits in the lower third and the floors rise from the middle. */
const UP = 8.5;
const OVER = 5.5;
/** It looks this far down the fall, and a little up the screen. */
const LOOK_DOWN = 30;
const LOOK_AHEAD = 2;
/** How much of the width a phone held upright should see, degrees. */
const TARGET_HFOV = 88;
const MIN_VFOV = 55;
const MAX_VFOV = 92;

/** In the falling view, up the screen is −Z (path +y). */
const DOWN_SCREEN_UP = new THREE.Vector3(0, 0, -1);

const FOLLOW_DISTANCE = Math.hypot(UP, OVER);
const FOLLOW_ELEVATION = Math.atan2(UP, OVER);
/** Over his head is −Z: azimuth π in the orbit below. */
const FOLLOW_AZIMUTH = Math.PI;

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

interface Orbit {
  /** Radians above his horizon (negative is below him, looking up). */
  elevation: number;
  /** Radians around him; 0 is +Z (the bottom of the screen), π is over his head. */
  azimuth: number;
  distance: number;
}

/**
 * Where the camera sits during a cutscene, `u` of the way through it.
 * Welcome: below him, looking up into heaven's light as he comes down, then
 * round to the side and up into the falling view. A stratum (the interludes):
 * out to his side to watch him cross a band of cloud, then back.
 */
function cutsceneOrbit(script: CutsceneScript, u: number): Orbit {
  if (script === 'welcome') {
    const rise = smooth((u - 0.35) / 0.55);
    return {
      elevation: -1.25 + (FOLLOW_ELEVATION + 1.25) * rise,
      azimuth: FOLLOW_AZIMUTH + 0.9 * Math.sin(Math.PI * smooth(u / 0.95)),
      distance: 26 + (FOLLOW_DISTANCE - 26) * smooth((u - 0.2) / 0.75),
    };
  }
  const out = Math.sin(Math.PI * smooth(u));
  return {
    elevation: FOLLOW_ELEVATION + (0.25 - FOLLOW_ELEVATION) * out,
    azimuth: FOLLOW_AZIMUTH + 1.35 * out,
    distance: FOLLOW_DISTANCE + 9 * out,
  };
}

/**
 * The camera hangs above him and looks down the fall, trailing a little
 * behind his moves so you see him lean into them. The frame stays square to
 * the world (no roll worth the name): a steady frame is what makes the slide
 * of a finger map cleanly onto where he goes.
 */
export function FlightCamera() {
  const runtime = useFlyRuntime();
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const size = useThree((state) => state.size);
  const lag = useMemo(() => ({ x: 0, y: 0, primed: false, time: 0, generation: -1 }), []);
  const scratch = useMemo(
    () => ({
      target: new THREE.Vector3(),
      player: new THREE.Vector3(),
      follow: new THREE.Vector3(),
      orbit: new THREE.Vector3(),
      look: new THREE.Vector3(),
    }),
    [],
  );

  useFrame((_, delta) => {
    const { engine, frame, view } = runtime;
    if (!lag.primed || lag.generation !== engine.generation) {
      lag.x = view.x;
      lag.y = view.y;
      lag.primed = true;
      lag.generation = engine.generation;
    }
    lag.time += delta;
    const follow = 1 - Math.exp(-delta * 5);
    lag.x += (view.x - lag.x) * follow;
    lag.y += (view.y - lag.y) * follow;

    const motionScale = runtime.reducedMotion ? 0 : 1;
    runtime.shake = Math.max(0, runtime.shake - delta * 2.4);
    const amount = runtime.shake * 0.45 * motionScale;
    const shakeX = amount * Math.sin(lag.time * 47.0);
    const shakeZ = amount * Math.sin(lag.time * 59.0 + 1.3);

    const playerY = frame.y(view.s);
    const cx = lag.x * 0.85 + view.x * 0.15;
    const cy = lag.y * 0.85 + view.y * 0.15;
    scratch.follow.set(cx + shakeX, playerY + UP, frame.z(cy) - OVER + shakeZ);
    scratch.target.set(view.x * 0.8 + lag.x * 0.2, playerY - LOOK_DOWN, frame.z(view.y * 0.8 + lag.y * 0.2) - OVER - LOOK_AHEAD);
    camera.up.set(0, 0, -1);

    const cutscene = runtime.mode === 'cutscene' ? runtime.cutscene : null;
    if (cutscene) {
      const u = cutscene.t / Math.max(0.001, cutscene.duration);
      const orbit = cutsceneOrbit(cutscene.script, u);
      scratch.player.set(view.x, playerY, frame.z(view.y));
      const ce = Math.cos(orbit.elevation);
      scratch.orbit.set(
        scratch.player.x + orbit.distance * ce * Math.sin(orbit.azimuth),
        scratch.player.y + orbit.distance * Math.sin(orbit.elevation),
        scratch.player.z + orbit.distance * ce * Math.cos(orbit.azimuth),
      );
      // Settle into the falling view over the last stretch, so the level begins with no cut.
      const settle = smooth((u - 0.82) / 0.18);
      camera.position.copy(scratch.orbit).lerp(scratch.follow, settle);
      scratch.look.copy(scratch.player).lerp(scratch.target, settle);
      // Looking straight up or down needs an up vector off the view axis.
      if (orbit.elevation < 0) camera.up.set(0, 1, 0).lerp(DOWN_SCREEN_UP, settle).normalize();
      camera.lookAt(scratch.look);
    } else {
      camera.position.copy(scratch.follow);
      camera.lookAt(scratch.target);
    }

    // Portrait phones need a wider view; the flow widens it a touch more.
    const aspect = size.width / Math.max(1, size.height);
    const fromWidth = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(TARGET_HFOV / 2)) / aspect));
    const fov = THREE.MathUtils.clamp(fromWidth, MIN_VFOV, MAX_VFOV) + engine.state.flow * 6 * motionScale;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, -1);

  return null;
}
