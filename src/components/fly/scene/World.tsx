'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Form, FormKind } from '../engine/types';
import { WORLD } from '../engine/world';
import { useFlyRuntime } from '../runtime';
import { createFormMaterial, createFormUniforms } from './materials';
import type { WorldFrame } from './frame';

const CAPACITY: Record<FormKind, number> = { block: 520, prism: 180, ring: 16 };

/**
 * One instanced mesh per kind of form, so the whole world is three draw calls.
 * Forms never move once placed; slots are only written when a form arrives,
 * leaves, or the world is re-centred.
 */
class FormPool {
  readonly mesh: THREE.InstancedMesh;
  private free: number[] = [];
  private slots = new Map<number, number>();
  private forms = new Map<number, Form>();

  constructor(kind: FormKind, geometry: THREE.BufferGeometry, material: THREE.Material) {
    const capacity = CAPACITY[kind];
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
    for (let i = capacity - 1; i >= 0; i--) {
      this.free.push(i);
      this.mesh.setMatrixAt(i, HIDDEN);
    }
  }

  add(form: Form, frame: WorldFrame, color: THREE.Color): void {
    const slot = this.free.pop();
    if (slot === undefined) return; // A full pool drops scenery; the corridor is never scenery-only.
    this.slots.set(form.id, slot);
    this.forms.set(form.id, form);
    this.mesh.setMatrixAt(slot, composeMatrix(form, frame));
    this.mesh.setColorAt(slot, color);
    this.touch();
  }

  remove(form: Form): void {
    const slot = this.slots.get(form.id);
    if (slot === undefined) return;
    this.slots.delete(form.id);
    this.forms.delete(form.id);
    this.mesh.setMatrixAt(slot, HIDDEN);
    this.free.push(slot);
    this.touch();
  }

  /** Rewrite every placed form, after the world is re-centred. */
  rewrite(frame: WorldFrame): void {
    for (const [id, slot] of this.slots) {
      const form = this.forms.get(id);
      if (form) this.mesh.setMatrixAt(slot, composeMatrix(form, frame));
    }
    this.touch();
  }

  clear(): void {
    for (const form of [...this.forms.values()]) this.remove(form);
  }

  private touch(): void {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YZX');
const _scale = new THREE.Vector3();
const _shear = new THREE.Matrix4();
const _matrix = new THREE.Matrix4();

/**
 * Place a form: scale, turn, then shear along the glide so its flat faces fall
 * with the line he flies (see distanceFromFlight), then move into the frame.
 */
function composeMatrix(form: Form, frame: WorldFrame): THREE.Matrix4 {
  _position.set(form.x, frame.y(form.y, form.s), frame.z(form.s));
  if (form.kind === 'ring') {
    // A ring faces the flight; tip it forward to meet the falling line square on.
    _euler.set(-Math.atan(WORLD.glideSlope), 0, 0);
    _scale.setScalar(form.hx);
    return _matrix.compose(_position, _quaternion.setFromEuler(_euler), _scale);
  }
  _euler.set(0, form.yaw, form.roll);
  _scale.set(form.hx, form.hy, form.kind === 'prism' ? form.hx : form.hs);
  _matrix.compose(_position.set(0, 0, 0), _quaternion.setFromEuler(_euler), _scale);
  // y += slope · z: further along the flight (more negative z) sits lower.
  _shear.set(1, 0, 0, 0, 0, 1, WORLD.glideSlope, 0, 0, 0, 1, 0, 0, 0, 0, 1);
  _matrix.premultiply(_shear);
  _matrix.setPosition(form.x, frame.y(form.y, form.s), frame.z(form.s));
  return _matrix;
}

export function World() {
  const runtime = useFlyRuntime();
  const { region } = runtime;

  const uniforms = useMemo(() => createFormUniforms(region.sky.sun), [region]);
  const palette = useMemo(
    () => ({
      light: new THREE.Color(region.form.light),
      dark: new THREE.Color(region.form.dark),
      accent: new THREE.Color(region.form.accent),
      portal: new THREE.Color(region.portal),
    }),
    [region],
  );

  const pools = useMemo(() => {
    const stone = createFormMaterial(uniforms);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: true });
    return {
      block: new FormPool('block', new THREE.BoxGeometry(2, 2, 2), stone),
      prism: new FormPool('prism', new THREE.CylinderGeometry(1, 1, 2, 7, 1), stone),
      ring: new FormPool('ring', new THREE.TorusGeometry(1, 0.07, 10, 64), ringMaterial),
    };
  }, [uniforms]);

  useEffect(
    () => () => {
      for (const pool of Object.values(pools)) {
        pool.mesh.geometry.dispose();
        (pool.mesh.material as THREE.Material).dispose();
        pool.mesh.dispose();
      }
    },
    [pools],
  );

  // Everything already composed arrives as one batch on the first frame.
  const seen = useMemo(() => ({ version: -1, primed: false }), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const { engine, frame } = runtime;
    const director = engine.director;

    if (!seen.primed) {
      director.drainChanges();
      for (const form of director.forms) pools[form.kind].add(form, frame, colorFor(form, palette, color));
      seen.primed = true;
      seen.version = frame.version;
      return;
    }

    const { added, removed } = director.drainChanges();
    for (const form of removed) pools[form.kind].remove(form);
    for (const form of added) pools[form.kind].add(form, frame, colorFor(form, palette, color));

    if (seen.version !== frame.version) {
      seen.version = frame.version;
      for (const pool of Object.values(pools)) pool.rewrite(frame);
    }
  }, -1);

  return (
    <>
      <primitive object={pools.block.mesh} />
      <primitive object={pools.prism.mesh} />
      <primitive object={pools.ring.mesh} />
    </>
  );
}

function colorFor(
  form: Form,
  palette: { light: THREE.Color; dark: THREE.Color; accent: THREE.Color; portal: THREE.Color },
  out: THREE.Color,
): THREE.Color {
  if (form.kind === 'ring') return out.copy(palette.portal);
  if (form.accent) return out.copy(palette.accent);
  // Most stone sits near the light tone; a few pieces go deep.
  return out.copy(palette.light).lerp(palette.dark, form.shade * form.shade);
}
