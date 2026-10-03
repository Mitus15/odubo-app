'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Form, FormKind } from '../engine/types';
import { useFlyRuntime } from '../runtime';
import type { WorldFrame } from './frame';
import { POOL_CAPACITY } from './capacity';
import { createGateMaterial, createStoneMaterial, type StoneUniforms } from './materials';

/** Forms that had to wait for room since the run began, for ?debug. Should stay 0. */
export const dropped = { count: 0 };

/**
 * One instanced mesh per kind of form, so the whole world is three draw calls.
 * Forms never move once placed; slots are only written when a form arrives,
 * leaves, or the world is re-centred.
 *
 * Every form the director holds is solid stone he can hit, so none may go
 * undrawn: a form with no free slot waits and takes the next one freed.
 */
class FormPool {
  readonly mesh: THREE.InstancedMesh;
  private free: number[] = [];
  private slots = new Map<number, number>();
  private forms = new Map<number, Form>();
  private waiting = new Map<number, Form>();

  constructor(kind: FormKind, geometry: THREE.BufferGeometry, material: THREE.Material) {
    const capacity = POOL_CAPACITY[kind];
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    for (let i = capacity - 1; i >= 0; i--) {
      this.free.push(i);
      this.mesh.setMatrixAt(i, HIDDEN);
    }
  }

  add(form: Form, frame: WorldFrame): void {
    if (this.slots.has(form.id) || this.waiting.has(form.id)) return;
    const slot = this.free.pop();
    if (slot === undefined) {
      dropped.count += 1;
      this.waiting.set(form.id, form);
      return;
    }
    this.place(form, slot, frame);
  }

  private place(form: Form, slot: number, frame: WorldFrame): void {
    this.slots.set(form.id, slot);
    this.forms.set(form.id, form);
    this.mesh.setMatrixAt(slot, composeMatrix(form, frame));
    // Data, not colour: the stone shader turns these into the sky's tones.
    _data.setRGB(form.shade, form.accent ? 1 : 0, form.role === 'scenery' ? 1 : 0);
    this.mesh.setColorAt(slot, _data);
    this.touch();
  }

  remove(form: Form, frame: WorldFrame): void {
    if (this.waiting.delete(form.id)) return;
    const slot = this.slots.get(form.id);
    if (slot === undefined) return;
    this.slots.delete(form.id);
    this.forms.delete(form.id);
    // A form waiting for room takes the slot at once; otherwise it is hidden and freed.
    const next = this.waiting.values().next();
    if (!next.done) {
      this.waiting.delete(next.value.id);
      this.place(next.value, slot, frame);
      return;
    }
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

  clear(frame: WorldFrame): void {
    this.waiting.clear();
    for (const form of [...this.forms.values()]) this.remove(form, frame);
  }

  private touch(): void {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const _data = new THREE.Color();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const RING_TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));

/**
 * Place a form in the scene. Path (x, y, s) is world (x, −(s − origin), −y);
 * the fall is the Y axis, so a block's half thickness along the fall (hs) is
 * its Y scale, and its yaw turns it about Y. Pillars are cylinders along Y.
 * Rings lie flat across the fall.
 */
function composeMatrix(form: Form, frame: WorldFrame): THREE.Matrix4 {
  _position.set(form.x, frame.y(form.s), frame.z(form.y));
  if (form.kind === 'ring') {
    _scale.setScalar(form.hx);
    return _matrix.compose(_position, RING_TILT, _scale);
  }
  if (form.kind === 'prism') {
    _scale.set(form.hx, form.hs, form.hx);
    return _matrix.compose(_position, _quaternion.identity(), _scale);
  }
  _euler.set(0, form.yaw, 0);
  // A floor is drawn as its pieces, each a hair larger than it is, so the joins
  // between them never show as seams. Only the drawing: collisions use the form.
  const overlap = form.role === 'floor' ? SEAM_OVERLAP : 0;
  _scale.set(form.hx + overlap, form.hs, form.hy + overlap);
  return _matrix.compose(_position, _quaternion.setFromEuler(_euler), _scale);
}

/** How much larger each floor piece is drawn than it is (m). */
const SEAM_OVERLAP = 0.02;

export function World({ uniforms }: { uniforms: StoneUniforms }) {
  const runtime = useFlyRuntime();

  const pools = useMemo(() => {
    const stone = createStoneMaterial(uniforms);
    const gates = createGateMaterial(uniforms);
    return {
      block: new FormPool('block', new THREE.BoxGeometry(2, 2, 2), stone),
      prism: new FormPool('prism', new THREE.CylinderGeometry(1, 1, 2, 10, 1), stone),
      ring: new FormPool('ring', new THREE.TorusGeometry(1, 0.06, 8, 56), gates),
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

  const seen = useMemo(() => ({ generation: -1, version: -1 }), []);

  useFrame(() => {
    const { engine, frame } = runtime;
    const director = engine.director;

    // A new run: start the world over from what the director holds now.
    if (seen.generation !== engine.generation) {
      seen.generation = engine.generation;
      director.drainChanges();
      for (const pool of Object.values(pools)) pool.clear(frame);
      dropped.count = 0;
      for (const form of director.forms()) pools[form.kind].add(form, frame);
      seen.version = frame.version;
      return;
    }

    const { added, removed } = director.drainChanges();
    for (const form of removed) pools[form.kind].remove(form, frame);
    for (const form of added) pools[form.kind].add(form, frame);

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
