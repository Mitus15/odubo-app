import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Recoolman's body, ready to fly.
 *
 * The avatar ships without animations, so every pose is set bone by bone.
 * And the file has a flaw that has to be fixed before any bone can move: its
 * skeleton sits 0.86 m to the side of the mesh it drives (the armature and the
 * body were offset in Blender when it was exported). At rest nobody can tell;
 * the moment an arm turns, it swings about a shoulder in empty air. So the
 * bones are moved onto the body and the skin is re-bound where they land.
 */

const JOINTS = [
  'UpperArmL',
  'ForearmL',
  'UpperArmR',
  'ForearmR',
  'UpperLegL',
  'LowerLegL',
  'UpperLegR',
  'LowerLegR',
  'Chest',
] as const;

type Joint = (typeof JOINTS)[number];

interface JointRest {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  /** The parent's rest orientation in the model's frame, and its inverse. */
  parent: THREE.Quaternion;
  parentInverse: THREE.Quaternion;
}

export interface FlyPose {
  /** How far the arms open from hanging, radians. π/2 is straight out. */
  spread: number;
  /** Wings lifted toward the sky (the back), radians. */
  dihedral: number;
  /** Extra lift on the right wing and drop on the left (a bank), radians. */
  tilt: number;
  /** A small, quick lift and fall of the forearms. */
  flutter: number;
  legSpread: number;
  kneeBend: number;
  /** The chest lifting from the arch, radians. */
  arch: number;
}

export interface Rig {
  root: THREE.Object3D;
  /** The rest pose's centre, so the body can turn about its middle. */
  center: THREE.Vector3;
  height: number;
  pose(pose: FlyPose): void;
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

export function createRig(source: THREE.Object3D, material: THREE.Material): Rig {
  // A private copy: the cached original may be in use elsewhere on the site.
  const root = cloneSkinned(source);
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);

  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) meshes.push(mesh);
  });
  if (meshes.length === 0) throw new Error('Recoolman has no skinned body');
  const skeleton = meshes[0].skeleton;

  // Where the body really renders, skinning included.
  const bodyBox = new THREE.Box3().setFromObject(root, true);
  const bodyCenter = bodyBox.getCenter(new THREE.Vector3());

  // Where the bones are. The body is symmetric about its middle, so the bones'
  // average across and front-to-back should be the body's centre too.
  const bonesCenter = new THREE.Vector3();
  const scratch = new THREE.Vector3();
  const joints = skeleton.bones.filter((bone) => bone.name !== 'neutral_bone');
  for (const bone of joints) bonesCenter.add(bone.getWorldPosition(scratch));
  bonesCenter.divideScalar(joints.length);
  const offset = new THREE.Vector3(bodyCenter.x - bonesCenter.x, 0, bodyCenter.z - bonesCenter.z);

  if (offset.lengthSq() > 1e-6) {
    for (const bone of skeleton.bones) {
      if (bone.parent && (bone.parent as THREE.Bone).isBone) continue;
      const moved = bone.getWorldPosition(new THREE.Vector3()).add(offset);
      bone.parent?.worldToLocal(moved);
      bone.position.copy(moved);
    }
    root.updateMatrixWorld(true);
    // Bind the unchanged skin to the moved bones: at rest nothing moves, and
    // from now on every joint turns where the body actually bends.
    skeleton.calculateInverses();
  }

  for (const mesh of meshes) {
    mesh.material = material;
    // Posed limbs leave the rest bounds; never let the body be culled.
    mesh.frustumCulled = false;
  }

  const rest = {} as Record<Joint, JointRest>;
  for (const name of JOINTS) {
    const bone = skeleton.bones.find((b) => b.name === name);
    if (!bone) throw new Error(`Recoolman has no ${name}`);
    const parent = bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
    rest[name] = {
      bone,
      rest: bone.quaternion.clone(),
      parent,
      parentInverse: parent.clone().invert(),
    };
  }

  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();

  /** Turn a joint by R, expressed in the model's own frame (up +y, facing −z). */
  const turn = (name: Joint, rotation: THREE.Quaternion) => {
    const joint = rest[name];
    joint.bone.quaternion.copy(joint.parentInverse).multiply(rotation).multiply(joint.parent).multiply(joint.rest);
  };

  const axisAngle = (axis: THREE.Vector3, angle: number, out: THREE.Quaternion) => out.setFromAxisAngle(axis, angle);

  return {
    root,
    center: bodyCenter,
    height: bodyBox.max.y - bodyBox.min.y,
    pose(p: FlyPose) {
      // Arms: open sideways (about z), then lift toward the back (about y).
      // His left is −x, so the left arm opens with a negative turn.
      const left = p.dihedral - p.tilt;
      const right = p.dihedral + p.tilt;
      turn('UpperArmL', axisAngle(Y, left, q).multiply(axisAngle(Z, -p.spread, q2)));
      turn('UpperArmR', axisAngle(Y, -right, q).multiply(axisAngle(Z, p.spread, q2)));
      turn('ForearmL', axisAngle(Y, p.flutter, q));
      turn('ForearmR', axisAngle(Y, -p.flutter, q));
      // Legs: a narrow V, knees folding toward the sky.
      turn('UpperLegL', axisAngle(Z, -p.legSpread, q));
      turn('UpperLegR', axisAngle(Z, p.legSpread, q));
      turn('LowerLegL', axisAngle(X, -p.kneeBend, q));
      turn('LowerLegR', axisAngle(X, -p.kneeBend, q));
      turn('Chest', axisAngle(X, p.arch, q));
    },
  };
}
