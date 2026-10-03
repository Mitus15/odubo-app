'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { between, createRng } from '../engine/rng';
import { useFlyRuntime } from '../runtime';

const COUNT = 110;
/** Bands of cloud lie across the fall this far apart (m). */
const BAND = 420;
/** Clouds are recycled through this much depth ahead of him. */
const SPAN = BAND * 3;

interface Cloud {
  x: number;
  y: number;
  s: number;
  width: number;
  height: number;
  band: boolean;
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
    vAlpha = aOpacity * smoothstep(4.0, 30.0, depth); // thin out as he falls through
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

function place(cloud: Cloud, rng: () => number, band: number): void {
  cloud.x = between(rng, -170, 170);
  cloud.y = between(rng, -170, 170);
  cloud.s = cloud.band ? band * BAND + between(rng, -14, 14) : band * BAND + between(rng, 0, BAND);
}

/**
 * Bands of cloud across the fall, every few hundred metres, and the odd wisp
 * between them: you fall through the sky's layers. Soft, noisy billboards in
 * the look's cloud colour, one draw call.
 */
export function Clouds({ fogDensity }: { fogDensity: { value: number } }) {
  const runtime = useFlyRuntime();

  const { mesh, clouds } = useMemo(() => {
    const rng = createRng(0xc10d);
    const geometry = new THREE.PlaneGeometry(1, 1);
    const opacity = new Float32Array(COUNT);
    const seed = new Float32Array(COUNT);
    const list: Cloud[] = [];
    for (let i = 0; i < COUNT; i++) {
      const band = i < COUNT * 0.8;
      const size = band ? between(rng, 40, 95) : between(rng, 12, 28);
      const cloud: Cloud = { x: 0, y: 0, s: 0, width: size * (band ? 1.6 : 1.3), height: size, band };
      place(cloud, rng, 1 + (i % 3));
      list.push(cloud);
      opacity[i] = band ? between(rng, 0.5, 0.85) : between(rng, 0.18, 0.34);
      seed[i] = rng();
    }
    geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(opacity, 1));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: runtime.look.colors.cloud },
        uFogColor: { value: runtime.look.colors.nadir },
        uFogDensity: fogDensity,
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
  }, [runtime, fogDensity]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );

  const scratch = useMemo(() => ({ matrix: new THREE.Matrix4(), rng: createRng(0x5ea), generation: -1 }), []);

  useFrame(() => {
    const { frame, view, engine } = runtime;
    const { matrix, rng } = scratch;
    // A new run starts back at the top: lay the bands out below him again.
    if (scratch.generation !== engine.generation) {
      scratch.generation = engine.generation;
      clouds.forEach((cloud, i) => place(cloud, rng, Math.floor(view.s / BAND) + 1 + (i % 3)));
    }
    for (let i = 0; i < COUNT; i++) {
      const cloud = clouds[i];
      if (cloud.s < view.s - 30) {
        // Its own band, three bands further down (a wisp: the stretch below its band).
        const band = cloud.band ? Math.round(cloud.s / BAND) : Math.floor(cloud.s / BAND);
        place(cloud, rng, band + SPAN / BAND);
      }
      matrix.makeScale(cloud.width, cloud.height, 1);
      matrix.setPosition(cloud.x, frame.y(cloud.s), frame.z(cloud.y));
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}
