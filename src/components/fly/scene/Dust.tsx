'use client';

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createRng } from '../engine/rng';
import { useFlyRuntime } from '../runtime';

const COUNT = 420;
/** The box of air the motes fill, around and ahead of the camera (m). */
const BOX = new THREE.Vector3(36, 22, 90);

const vertexShader = /* glsl */ `
  attribute vec3 aSeed;
  uniform vec3 uCenter;
  uniform vec3 uBox;
  uniform float uSize;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    // Each mote wraps around the moving box, so the air is endless and free.
    vec3 local = mod(aSeed * uBox - uCenter, uBox) - 0.5 * uBox;
    vec4 view = viewMatrix * vec4(uCenter + local, 1.0);
    gl_Position = projectionMatrix * view;
    float depth = max(-view.z, 0.01);
    gl_PointSize = clamp(uSize * uScale / depth, 1.0, 5.0);
    vAlpha = smoothstep(0.6, 3.0, depth) * (1.0 - smoothstep(uBox.z * 0.3, uBox.z * 0.48, depth));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = (1.0 - smoothstep(0.4, 1.0, r)) * vAlpha * 0.75;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <colorspace_fragment>
  }
`;

/** Motes in the air. They are how you feel the speed. */
export function Dust() {
  const runtime = useFlyRuntime();
  const { region } = runtime;
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  const points = useMemo(() => {
    const rng = createRng(0xd057);
    const seeds = new Float32Array(COUNT * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    // Positions are computed on the GPU; this attribute only sets the count.
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: { value: new THREE.Vector3() },
        uBox: { value: BOX.clone() },
        uSize: { value: 0.05 },
        uScale: { value: 400 },
        uColor: { value: new THREE.Color(region.dust) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Points(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    return mesh;
  }, [region]);

  useEffect(
    () => () => {
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
    },
    [points],
  );

  const forward = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const material = points.material as THREE.ShaderMaterial;
    const perspective = camera as THREE.PerspectiveCamera;
    camera.getWorldDirection(forward);
    material.uniforms.uCenter.value.copy(camera.position).addScaledVector(forward, BOX.z * 0.4);
    material.uniforms.uScale.value =
      (size.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2));
  });

  return <primitive object={points} />;
}
