'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { FALL } from '@/lib/fly/rules';
import type { TrajectoryPoint } from '../engine/record';
import { useFlyRuntime } from '../runtime';
import { createRig, type FlyPose, type Rig } from './rig';

export const RECOOLMAN_URL = '/models/avatar-male.glb';

/** His resting fall: arms open and swept a little toward the feet, a shallow V of legs. */
const POSE = {
  spread: 1.3,
  dihedral: 0.16,
  legSpread: 0.13,
  kneeBend: 0.32,
  arch: 0.1,
};
/** Arms fold toward the body as flow builds: a bird closing its wings to dive. */
const TUCKED_SPREAD = 0.45;
/** Arms closed to his sides: a seed falling, before Welcome lets go. */
const CLOSED_SPREAD = 0.12;
/** Head-down angle at no flow and at full flow (radians): 20° to 65°. */
const PITCH_EASY = 0.35;
const PITCH_DIVE = 1.13;
const MAX_ROLL = 0.6;

/** What drives a falling body this frame. */
export interface FlyerMotion {
  /** Sideways velocity across the screen (m/s): +x right, +y up the screen. */
  vx: number;
  vy: number;
  flow: number;
  speed: number;
  /** Seconds of stumble left (he tumbles while it lasts). */
  stumble: number;
  /** 1: arms closed to his sides, a seed falling (Welcome, before it lets go). */
  closed: number;
}

interface Groups {
  flyer: THREE.Group;
  bank: THREE.Group;
  body: THREE.Group;
}

interface Smoothed {
  roll: number;
  pitch: number;
  spread: number;
  time: number;
  tumble: number;
}

/**
 * Turn a body to fall the way the motion says. Shared by Recoolman and his
 * ghost, so the best run you are racing moves exactly like you do.
 *
 * The model stands up +y facing −z; laid belly-down (rotation.x = −π/2) his
 * head points up the screen (−z), his back to the camera above. The bank group
 * then pitches him head-down and rolls him into his turns.
 */
function applyFall(groups: Groups, rig: Rig, pose: FlyPose, smoothed: Smoothed, motion: FlyerMotion, delta: number): void {
  smoothed.time += delta;
  const cap = Math.max(FALL.minLateral, FALL.glide * motion.speed);
  const leanX = Math.max(-1, Math.min(1, motion.vx / cap));
  const leanY = Math.max(-1, Math.min(1, motion.vy / cap));
  const follow = 1 - Math.exp(-delta * 7);
  smoothed.roll += (-leanX * MAX_ROLL - smoothed.roll) * follow;
  const pitchTarget = PITCH_EASY + (PITCH_DIVE - PITCH_EASY) * motion.flow - leanY * 0.25;
  smoothed.pitch += (pitchTarget - smoothed.pitch) * follow;
  const openTarget = POSE.spread + (TUCKED_SPREAD - POSE.spread) * motion.flow;
  const spreadTarget = openTarget + (CLOSED_SPREAD - openTarget) * motion.closed;
  smoothed.spread += (spreadTarget - smoothed.spread) * (1 - Math.exp(-delta * 3));

  if (motion.stumble > 0) smoothed.tumble += delta * 9;
  else smoothed.tumble *= Math.exp(-delta * 6);

  groups.bank.rotation.set(-smoothed.pitch + Math.sin(smoothed.tumble) * 0.5, 0, smoothed.roll + smoothed.tumble);
  groups.body.rotation.set(-Math.PI / 2, 0, 0);

  const speedShare = Math.min(1, motion.speed / FALL.maxSpeed);
  pose.spread = motion.stumble > 0 ? 0.6 : smoothed.spread;
  pose.tilt = -smoothed.roll * 0.35;
  pose.flutter = Math.sin(smoothed.time * (9 + speedShare * 11)) * (0.02 + speedShare * 0.04);
  pose.dihedral = POSE.dihedral + Math.sin(smoothed.time * 1.3) * 0.04;
  pose.arch = POSE.arch + motion.flow * 0.12;
  rig.pose(pose);
}

function useBody(material: THREE.Material): { rig: Rig; pose: FlyPose; smoothed: Smoothed } {
  const { scene } = useGLTF(RECOOLMAN_URL);
  const rig = useMemo(() => createRig(scene, material), [scene, material]);
  const pose = useMemo<FlyPose>(() => ({ ...POSE, tilt: 0, flutter: 0 }), []);
  const smoothed = useMemo<Smoothed>(() => ({ roll: 0, pitch: PITCH_EASY, spread: POSE.spread, time: 0, tumble: 0 }), []);
  return { rig, pose, smoothed };
}

function Body({ rig, refs }: { rig: Rig; refs: { flyer: React.RefObject<THREE.Group | null>; bank: React.RefObject<THREE.Group | null>; body: React.RefObject<THREE.Group | null> } }) {
  return (
    <group ref={refs.flyer}>
      <group ref={refs.bank}>
        <group ref={refs.body}>
          <primitive object={rig.root} position={[-rig.center.x, -rig.center.y, -rig.center.z]} />
        </group>
      </group>
    </group>
  );
}

export function Recoolman() {
  const runtime = useFlyRuntime();
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
  useEffect(() => () => material.dispose(), [material]);
  const { rig, pose, smoothed } = useBody(material);
  const refs = { flyer: useRef<THREE.Group>(null), bank: useRef<THREE.Group>(null), body: useRef<THREE.Group>(null) };
  const motion = useMemo<FlyerMotion>(() => ({ vx: 0, vy: 0, flow: 0, speed: FALL.baseSpeed, stumble: 0, closed: 0 }), []);

  useFrame((_, delta) => {
    const { engine, frame, view } = runtime;
    const flyer = refs.flyer.current;
    const bank = refs.bank.current;
    const body = refs.body.current;
    if (!flyer || !bank || !body) return;
    const state = engine.state;
    motion.vx = state.vx;
    motion.vy = state.vy;
    motion.flow = state.flow;
    motion.speed = state.speed;
    motion.stumble = state.stumble;
    const cutscene = runtime.mode === 'cutscene' ? runtime.cutscene : null;
    motion.closed = cutscene && cutscene.script === 'welcome' && cutscene.t < cutscene.letGo ? 1 : 0;
    flyer.position.set(view.x, frame.y(view.s), frame.z(view.y));
    applyFall({ flyer, bank, body }, rig, pose, smoothed, motion, delta);
  });

  return <Body rig={rig} refs={refs} />;
}

/**
 * The ghost of the best run on this level, falling alongside: the same body,
 * glass in the rim colour. Seen only while it is near enough to race.
 */
export function Ghost() {
  const runtime = useFlyRuntime();
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: runtime.look.colors.rim,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    [runtime],
  );
  useEffect(() => () => material.dispose(), [material]);
  const { rig, pose, smoothed } = useBody(material);
  const refs = { flyer: useRef<THREE.Group>(null), bank: useRef<THREE.Group>(null), body: useRef<THREE.Group>(null) };
  const scratch = useMemo(
    () => ({
      now: { x: 0, y: 0, s: 0 } as TrajectoryPoint,
      before: { x: 0, y: 0, s: 0 } as TrajectoryPoint,
      motion: { vx: 0, vy: 0, flow: 0, speed: FALL.baseSpeed, stumble: 0, closed: 0 } as FlyerMotion,
    }),
    [],
  );

  useFrame((_, delta) => {
    const flyer = refs.flyer.current;
    const bank = refs.bank.current;
    const body = refs.body.current;
    if (!flyer || !bank || !body) return;
    material.color = runtime.look.colors.rim;
    const ghost = runtime.mode === 'level' ? runtime.ghost : null;
    const at = ghost?.at(runtime.view.tick, scratch.now);
    if (!ghost || !at || Math.abs(at.s - runtime.view.s) > 80) {
      flyer.visible = false;
      return;
    }
    flyer.visible = true;
    const before = ghost.at(Math.max(0, runtime.view.tick - 12), scratch.before);
    const seconds = 12 / FALL.ticksPerSecond;
    const motion = scratch.motion;
    if (before) {
      motion.vx = (at.x - before.x) / seconds;
      motion.vy = (at.y - before.y) / seconds;
      motion.speed = Math.max(FALL.baseSpeed * 0.5, (at.s - before.s) / seconds);
      motion.flow = Math.max(0, Math.min(1, (motion.speed - FALL.baseSpeed) / (FALL.maxSpeed - FALL.baseSpeed)));
    }
    const { frame } = runtime;
    flyer.position.set(at.x, frame.y(at.s), frame.z(at.y));
    applyFall({ flyer, bank, body }, rig, pose, smoothed, motion, delta);
  });

  return <Body rig={rig} refs={refs} />;
}

useGLTF.preload(RECOOLMAN_URL);
