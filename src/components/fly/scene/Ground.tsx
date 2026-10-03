'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FALL } from '@/lib/fly/rules';
import { useFlyRuntime } from '../runtime';
import { createStoneMaterial, type StoneUniforms } from './materials';

/** He touches down this far above the ground's surface (m): his own height, lying flat. */
const TOUCHDOWN = 1.1;

/**
 * The ground, at the end of the album. From the moment Ghost World lets go it
 * rises out of the deep to meet him, close enough by the last second that he
 * lands on it, his shadow falling back into step beneath him. It is drawn in
 * the stone's own material, so the shadow and the glow are the same as
 * everywhere else.
 */
export function Ground({ uniforms }: { uniforms: StoneUniforms }) {
  const runtime = useFlyRuntime();
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    const stone = createStoneMaterial(uniforms);
    stone.color = runtime.look.colors.earth;
    return stone;
  }, [uniforms, runtime]);
  const geometry = useMemo(() => new THREE.CircleGeometry(900, 72).rotateX(-Math.PI / 2), []);
  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry],
  );

  useFrame(() => {
    const ground = mesh.current;
    if (!ground) return;
    const { engine, frame, view } = runtime;
    const from = runtime.landingFrom;
    if (runtime.mode !== 'level' || from === null || view.tick < from) {
      ground.visible = false;
      return;
    }
    const end = engine.course.endTick;
    const left = Math.max(0, (end - view.tick) / FALL.ticksPerSecond);
    // The distance he would cover at his speed in the time left, eased in from the deep.
    const below = TOUCHDOWN + left * Math.max(engine.state.speed, FALL.stumbleFloor) * 0.9;
    ground.visible = true;
    ground.position.set(0, frame.y(view.s) - below, 0);
  });

  return <mesh ref={mesh} geometry={geometry} material={material} visible={false} />;
}
