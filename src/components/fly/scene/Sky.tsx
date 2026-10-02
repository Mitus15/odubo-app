'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Region } from '../engine/regions';

/** Where the sun sits: ahead, high and to the left, so the stone is backlit. */
export const SUN_DIRECTION = new THREE.Vector3(-0.38, 0.5, -0.78).normalize();

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
  uniform vec3 uHorizon;
  uniform vec3 uNadir;
  uniform vec3 uSun;
  uniform vec3 uSunDirection;
  varying vec3 vDirection;
  void main() {
    vec3 d = normalize(vDirection);
    float h = d.y;
    vec3 color = h > 0.0
      ? mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.6))
      : mix(uHorizon, uNadir, pow(clamp(-h, 0.0, 1.0), 0.5));
    // A band of haze sits on the horizon, where the fog meets the sky.
    color = mix(color, uHorizon, exp(-abs(h) * 16.0) * 0.7);
    float sun = max(dot(d, uSunDirection), 0.0);
    color += uSun * (pow(sun, 420.0) * 0.9 + pow(sun, 12.0) * 0.18);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createSkyMaterial(region: Region): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color(region.sky.zenith) },
      uHorizon: { value: new THREE.Color(region.sky.horizon) },
      uNadir: { value: new THREE.Color(region.sky.nadir) },
      uSun: { value: new THREE.Color(region.sky.sun) },
      uSunDirection: { value: SUN_DIRECTION.clone() },
    },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

/** The sky dome. It travels with the camera, so it is always infinitely far. */
export function Sky({ region }: { region: Region }) {
  const material = useMemo(() => createSkyMaterial(region), [region]);
  const geometry = useMemo(() => new THREE.SphereGeometry(1000, 32, 16), []);
  const dome = useRef<THREE.Mesh>(null);

  useFrame(({ camera }) => {
    dome.current?.position.copy(camera.position);
  });

  return <mesh ref={dome} geometry={geometry} material={material} renderOrder={-1} frustumCulled={false} />;
}
