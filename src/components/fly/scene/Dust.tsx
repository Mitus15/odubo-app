'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRng } from '../engine/rng';
import { useFlyRuntime } from '../runtime';

const COUNT = 360;
/** The box of air the motes fill around the camera (m); tall, because he falls through it. */
const BOX = new THREE.Vector3(44, 120, 44);

const vertexShader = /* glsl */ `
  attribute vec3 aSeed;
  attribute float aTail;
  uniform vec3 uCenter;
  uniform vec3 uBox;
  uniform float uLength;
  varying float vAlpha;
  void main() {
    // Each mote wraps around the moving box, so the air is endless and free.
    vec3 local = mod(aSeed * uBox - uCenter, uBox) - 0.5 * uBox;
    vec3 world = uCenter + local + vec3(0.0, aTail * uLength, 0.0);
    vec4 view = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * view;
    float depth = max(-view.z, 0.01);
    vAlpha = smoothstep(1.0, 5.0, depth) * (1.0 - smoothstep(uBox.y * 0.25, uBox.y * 0.45, depth)) * (1.0 - aTail * 0.85);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float alpha = vAlpha * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <colorspace_fragment>
  }
`;

/** Streaks in the air, stretching with his speed. They are how you feel the fall. */
export function Dust() {
  const runtime = useFlyRuntime();

  const lines = useMemo(() => {
    const rng = createRng(0xd057);
    const seeds = new Float32Array(COUNT * 2 * 3);
    const tails = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i++) {
      const sx = rng();
      const sy = rng();
      const sz = rng();
      for (let end = 0; end < 2; end++) {
        const v = i * 2 + end;
        seeds[v * 3] = sx;
        seeds[v * 3 + 1] = sy;
        seeds[v * 3 + 2] = sz;
        tails[v] = end;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    geometry.setAttribute('aTail', new THREE.BufferAttribute(tails, 1));
    // Positions are computed on the GPU; this attribute only sets the count.
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 2 * 3), 3));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: { value: new THREE.Vector3() },
        uBox: { value: BOX.clone() },
        uLength: { value: 2 },
        uColor: { value: runtime.look.colors.dust },
        uOpacity: { value: 0.55 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.LineSegments(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    return mesh;
  }, [runtime]);

  useEffect(
    () => () => {
      lines.geometry.dispose();
      (lines.material as THREE.Material).dispose();
    },
    [lines],
  );

  const forward = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const material = lines.material as THREE.ShaderMaterial;
    camera.getWorldDirection(forward);
    material.uniforms.uCenter.value.copy(camera.position).addScaledVector(forward, BOX.y * 0.3);
    const speed = runtime.engine.state.speed;
    material.uniforms.uLength.value = speed * 0.06;
    material.uniforms.uOpacity.value = 0.35 + 0.4 * runtime.engine.state.flow;
  });

  return <primitive object={lines} />;
}
