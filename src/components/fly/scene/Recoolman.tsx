'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { FLIGHT } from '../engine/FlightEngine';
import { WORLD } from '../engine/world';
import { useFlyRuntime } from '../runtime';
import { createRig, type FlyPose } from './rig';

export const RECOOLMAN_URL = '/models/avatar-male.glb';

/** His resting flight: wings open and swept a little toward the feet, a shallow V of legs. */
const POSE = {
  spread: 1.3,
  dihedral: 0.16,
  legSpread: 0.13,
  kneeBend: 0.32,
  arch: 0.1,
};

/** Head a little below the line of flight: he is diving, not gliding level. */
const DIVE_PITCH = Math.atan(WORLD.glideSlope) + 0.1;
const MAX_BANK = 0.7;
const MAX_HEADING = 0.22;
const DROP_HEIGHT = 9;

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function Recoolman() {
  const runtime = useFlyRuntime();
  const { scene } = useGLTF(RECOOLMAN_URL);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0b0b0c',
        metalness: 1,
        roughness: 0.2,
        envMapIntensity: 1.25,
      }),
    [],
  );
  const rig = useMemo(() => createRig(scene, material), [scene, material]);
  useEffect(() => () => material.dispose(), [material]);

  const flyer = useRef<THREE.Group>(null);
  const bank = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const pose = useMemo<FlyPose>(() => ({ ...POSE, tilt: 0, flutter: 0 }), []);
  const motion = useMemo(() => ({ roll: 0, heading: 0, time: 0, tumble: new THREE.Euler(), fallY: 0 }), []);

  useFrame((_, delta) => {
    const { engine, frame, view } = runtime;
    const state = engine.state;
    if (!flyer.current || !bank.current || !body.current) return;
    motion.time += delta;

    // Bank and heading follow his sideways speed, eased so a twitch of the
    // thumb reads as a lean, not a jolt.
    const lean = state.vx / FLIGHT.lateralMaxSpeed;
    const follow = 1 - Math.exp(-delta * 8);
    motion.roll += (-lean * MAX_BANK - motion.roll) * follow;
    motion.heading += (-lean * MAX_HEADING - motion.heading) * follow;

    let y = frame.y(0, view.s);
    if (runtime.dropIn > 0) y += ease(runtime.dropIn) * DROP_HEIGHT;

    if (runtime.crashAge >= 0) {
      // He tumbles out of the flight and falls into the world.
      const age = runtime.crashAge;
      motion.fallY = -0.5 * 9.8 * 0.7 * age * age;
      motion.tumble.set(-2.6 * age, 0, 3.4 * age);
      flyer.current.visible = age < 3;
      pose.spread = Math.max(0.35, POSE.spread - age * 1.4);
    } else {
      motion.fallY = 0;
      motion.tumble.set(0, 0, 0);
      flyer.current.visible = true;
      pose.spread = POSE.spread;
    }

    flyer.current.position.set(view.x, y + motion.fallY, frame.z(view.s));
    flyer.current.rotation.set(0, motion.heading, 0);
    bank.current.rotation.set(motion.tumble.x, 0, motion.roll + motion.tumble.z);
    body.current.rotation.set(-(Math.PI / 2 + DIVE_PITCH), 0, 0);

    // The wings answer the bank and the air.
    const speedShare = Math.min(1, state.speed / FLIGHT.diveTopSpeed);
    pose.tilt = -motion.roll * 0.35;
    pose.flutter = Math.sin(motion.time * (9 + speedShare * 9)) * (0.02 + speedShare * 0.035);
    pose.dihedral = POSE.dihedral + Math.sin(motion.time * 1.3) * 0.04;
    rig.pose(pose);
  });

  return (
    <group ref={flyer}>
      <group ref={bank}>
        <group ref={body}>
          <primitive object={rig.root} position={[-rig.center.x, -rig.center.y, -rig.center.z]} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(RECOOLMAN_URL);
