'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { between, createRng } from '../engine/rng';
import { useFlyRuntime } from '../runtime';

const COUNT = 80;
/** Clouds live in a band this long, ahead of the camera, and wrap. */
const SPAN = 820;

interface Cloud {
  x: number;
  y: number;
  s: number;
  width: number;
  height: number;
  sea: boolean;
}

const vertexShader = /* glsl */ `
  attribute float aOpacity;
  attribute float aSeed;
  uniform float uFogDensity;
  varying vec2 vUv;
  varying float vFog;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec3 center = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
    vec4 view = viewMatrix * modelMatrix * vec4(center, 1.0);
    view.xy += position.xy * size; // always faces the camera
    gl_Position = projectionMatrix * view;
    float depth = -view.z;
    vFog = 1.0 - exp(-uFogDensity * uFogDensity * depth * depth * 0.55);
    vAlpha = aOpacity * smoothstep(6.0, 34.0, depth); // thin out as he flies through
    vUv = uv;
    vSeed = aSeed;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uFogColor;
  varying vec2 vUv;
  varying float vFog;
  varying float vAlpha;
  varying float vSeed;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p * vec2(1.0, 1.15)) * 2.0;
    float n = noise(vUv * 3.2 + vSeed * 17.0) * 0.6 + noise(vUv * 7.0 - vSeed * 9.0) * 0.4;
    float body = 1.0 - smoothstep(0.25, 1.0, r + (n - 0.5) * 0.55);
    float alpha = body * body * vAlpha;
    if (alpha < 0.004) discard;
    vec3 color = mix(uColor, uFogColor, vFog * 0.85);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

/**
 * A sea of cloud far below the line, and the odd wisp at his height to fly
 * through. Soft, noisy billboards, one draw call.
 */
export function Clouds() {
  const runtime = useFlyRuntime();
  const { region } = runtime;

  const { mesh, clouds } = useMemo(() => {
    const rng = createRng(0xc10d);
    const geometry = new THREE.PlaneGeometry(1, 1);
    const opacity = new Float32Array(COUNT);
    const seed = new Float32Array(COUNT);
    const list: Cloud[] = [];
    for (let i = 0; i < COUNT; i++) {
      const sea = i < COUNT * 0.8;
      const size = sea ? between(rng, 50, 120) : between(rng, 14, 32);
      list.push({
        x: sea ? between(rng, -180, 180) : between(rng, -70, 70),
        y: sea ? -between(rng, 30, 70) : between(rng, -10, 16),
        s: between(rng, -40, SPAN - 40),
        width: size * (sea ? 1.7 : 1.3),
        height: size,
        sea,
      });
      opacity[i] = sea ? between(rng, 0.45, 0.8) : between(rng, 0.18, 0.34);
      seed[i] = rng();
    }
    geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(opacity, 1));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(region.cloud) },
        uFogColor: { value: new THREE.Color(region.sky.horizon) },
        uFogDensity: { value: region.fogDensity },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const instanced = new THREE.InstancedMesh(geometry, material, COUNT);
    instanced.frustumCulled = false;
    instanced.renderOrder = 2;
    instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return { mesh: instanced, clouds: list };
  }, [region]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );

  const scratch = useMemo(
    () => ({ matrix: new THREE.Matrix4(), rng: createRng(0x5ea), anchored: false }),
    [],
  );

  useFrame(() => {
    const { frame, view } = runtime;
    const { matrix, rng } = scratch;
    // The flight may have started far from where the clouds were laid out.
    if (!scratch.anchored) {
      for (const cloud of clouds) cloud.s += view.s;
      scratch.anchored = true;
    }
    for (let i = 0; i < COUNT; i++) {
      const cloud = clouds[i];
      if (cloud.s < view.s - 40) {
        cloud.s += SPAN;
        cloud.x = cloud.sea ? between(rng, -180, 180) : between(rng, -70, 70);
      }
      matrix.makeScale(cloud.width, cloud.height, 1);
      matrix.setPosition(cloud.x, frame.y(cloud.y, cloud.s), frame.z(cloud.s));
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}
