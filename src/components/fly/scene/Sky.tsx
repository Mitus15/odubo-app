'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LiveLook } from './look';
import { useFlyRuntime } from '../runtime';

const vertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = clip.xyww; // pinned to the far plane: always behind everything
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uField;
  uniform vec3 uNadir;
  uniform vec3 uEarth;
  uniform float uEarthRadius;
  varying vec3 vDirection;
  void main() {
    vec3 d = normalize(vDirection);
    float h = d.y;
    // Heaven above, the song's air all around, the deep below.
    vec3 color = h > 0.0
      ? mix(uField, uZenith, pow(clamp(h, 0.0, 1.0), 0.55))
      : mix(uField, uNadir, pow(clamp(-h, 0.0, 1.0), 0.8));
    // The light he was sent from: straight up.
    float heaven = max(h, 0.0);
    color += vec3(1.0, 0.97, 0.9) * (pow(heaven, 260.0) * 1.2 + pow(heaven, 9.0) * 0.22);
    // The Earth, straight down: small at the start of the album, filling the view at the end.
    float angle = acos(clamp(-h, -1.0, 1.0));
    float disc = 1.0 - smoothstep(uEarthRadius * 0.92, uEarthRadius * 1.08, angle);
    float haze = smoothstep(uEarthRadius * 0.4, uEarthRadius * 1.0, angle) * 0.55;
    color = mix(color, mix(uEarth, uField, haze), disc);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createSkyMaterial(look: LiveLook, earthRadius = { value: 0.04 }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: look.colors.zenith },
      uField: { value: look.colors.field },
      uNadir: { value: look.colors.nadir },
      uEarth: { value: look.colors.earth },
      uEarthRadius: earthRadius,
    },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

/** The Earth's angular radius (radians) this far through the album, 0..1. */
export function earthRadiusAt(progress: number): number {
  const start = THREE.MathUtils.degToRad(2);
  const end = THREE.MathUtils.degToRad(40);
  const p = Math.min(1, Math.max(0, progress));
  return start + (end - start) * p * p;
}

/** The sky dome. It travels with the camera, so it is always infinitely far. */
export function Sky() {
  const runtime = useFlyRuntime();
  const earthRadius = useMemo(() => ({ value: earthRadiusAt(0) }), []);
  const material = useMemo(() => createSkyMaterial(runtime.look, earthRadius), [runtime, earthRadius]);
  const geometry = useMemo(() => new THREE.SphereGeometry(1000, 32, 24), []);
  const dome = useRef<THREE.Mesh>(null);

  useFrame(({ camera }, delta) => {
    dome.current?.position.copy(camera.position);
    const target = earthRadiusAt(runtime.albumProgress);
    earthRadius.value += (target - earthRadius.value) * (1 - Math.exp(-delta * 0.8));
  });

  return <mesh ref={dome} geometry={geometry} material={material} renderOrder={-1} frustumCulled={false} />;
}
